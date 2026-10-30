// 進行不能バグ修正の E2E 検証（PORT=3100 node server.js を起動してから node test_progress_fix.js）
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:3100';
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('✅ ' + name); } else { fail++; console.log('❌ ' + name); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = p => p.evaluate(() => document.querySelector('.screen.active').id);
const visible = (p, id) => p.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);

async function newPlayer(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(URL);
  return { ctx, page };
}
async function createRoom(page, name) {
  await page.fill('#input-name', name);
  await page.click('#btn-create-room');
  await page.waitForSelector('#screen-lobby.active');
  return (await page.textContent('#display-room-code')).trim();
}
async function joinRoom(page, name, code) {
  await page.fill('#input-name', name);
  await page.fill('#input-room-code', code);
  await page.click('#btn-join-room');
}
async function setTopic(host) {
  await host.waitForSelector('#screen-topic.active');
  await host.fill('#input-topic-char', 'あ');
  await host.fill('#input-topic-word', '食べ物といえば？');
  await host.click('#btn-set-topic');
}
async function draw(page) {
  await page.waitForSelector('#screen-submitting.active');
  await page.evaluate(() => {
    const c = document.getElementById('answer-canvas');
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(50 + Math.random() * 100, 50, 200, 200);
  });
}
async function submit(page) { await draw(page); await page.click('#btn-submit-answer'); }
async function startGame(browser, names) {
  const players = [];
  for (const n of names) players.push(await newPlayer(browser));
  const code = await createRoom(players[0].page, names[0]);
  for (let i = 1; i < names.length; i++) {
    await joinRoom(players[i].page, names[i], code);
    await players[i].page.waitForSelector('#screen-lobby.active');
  }
  await players[0].page.click('#btn-start-game');
  await setTopic(players[0].page);
  return { players, code };
}

(async () => {
  const browser = await chromium.launch();

  // --- A: 一時切断→自動再入室→回答→公開→正解選択まで進める ---
  {
    const { players } = await startGame(browser, ['ホストA', 'ゲストB']);
    const [A, B] = players.map(p => p.page);
    await draw(B);
    await B.evaluate(() => socket.io.engine.close()); // 通信断を再現
    await sleep(3000);
    check('A: 再接続後も回答画面のまま', await active(B) === 'screen-submitting');
    const kept = await B.evaluate(() => !isCanvasEmpty(document.getElementById('answer-canvas')));
    check('A: 描きかけの絵が残っている', kept);
    await B.click('#btn-submit-answer');
    await submit(A);
    await A.waitForSelector('#screen-revealing.active', { timeout: 5000 }).catch(() => {});
    check('A: ホストが公開画面へ進む', await active(A) === 'screen-revealing');
    check('A: ゲストが公開画面へ進む', await active(B) === 'screen-revealing');
    await A.click('#btn-open-my-flip');
    await B.click('#btn-open-my-flip');
    await sleep(800);
    check('A: ホストに正解選択エリアが出る', await visible(A, 'host-correct-area'));
    // --- D: 連打で二重加点・ラウンド飛ばしが起きない ---
    await A.click('#card-' + (await B.evaluate(() => myPlayerId)));
    await sleep(300);
    await A.evaluate(() => { const b = document.getElementById('btn-end-round'); b.click(); b.click(); b.click(); });
    await A.waitForSelector('#screen-round-result.active');
    await sleep(500);
    const pts = await A.evaluate(() => [...document.querySelectorAll('#round-score-list .score-points')].map(e => +e.textContent));
    check('D: 連打しても1点しか加点されない（' + pts.join(',') + '）', Math.max(...pts) === 1);
    await A.evaluate(() => { const b = document.getElementById('btn-next-round'); b.click(); b.click(); b.click(); });
    await A.waitForSelector('#screen-topic.active');
    await sleep(500);
    const badge = await A.textContent('#topic-round-badge');
    check('D: 連打してもラウンドが飛ばない（' + badge + '）', badge.includes('第2ラウンド'));
    for (const p of players) await p.ctx.close();
  }

  // --- B: 回答済みの人が抜けても公開が完了する ---
  {
    const { players } = await startGame(browser, ['ホストA', 'ゲストB', 'ゲストC']);
    const [A, B, C] = players.map(p => p.page);
    await submit(B);
    await sleep(300);
    await players[1].ctx.close(); // B が回答後に離脱
    await submit(A);
    await submit(C);
    await A.waitForSelector('#screen-revealing.active', { timeout: 8000 }).catch(() => {});
    check('B: 離脱者がいても公開画面へ進む', await active(A) === 'screen-revealing');
    await A.click('#btn-open-my-flip');
    await C.click('#btn-open-my-flip');
    await sleep(800);
    check('B: 離脱者のフリップが自動公開され正解選択できる', await visible(A, 'host-correct-area'));
    await players[0].ctx.close(); await players[2].ctx.close();
  }

  // --- C: 公開中にホストが再読み込み→同名で再参加しても正解選択できる ---
  {
    const { players, code } = await startGame(browser, ['ホストA', 'ゲストB']);
    const [A, B] = players.map(p => p.page);
    await submit(A); await submit(B);
    await A.waitForSelector('#screen-revealing.active');
    await A.click('#btn-open-my-flip'); await B.click('#btn-open-my-flip');
    await sleep(800);
    await A.reload();
    await joinRoom(A, 'ホストA', code);
    await A.waitForSelector('#screen-revealing.active', { timeout: 5000 }).catch(() => {});
    await sleep(800);
    check('C: 再参加後に公開画面へ戻る', await active(A) === 'screen-revealing');
    const flipped = await A.evaluate(() => document.querySelectorAll('.flip-card-inner.flipped').length);
    check('C: 公開済みカードが復元される（' + flipped + '枚）', flipped === 2);
    check('C: ホストの正解選択エリアが復元される', await visible(A, 'host-correct-area'));

    // --- E: 接続中のプレイヤーを同名の別ブラウザで乗っ取れない ---
    const X = await newPlayer(browser);
    await joinRoom(X.page, 'ゲストB', code);
    await sleep(800);
    check('E: 同名の別人は参加できない', await active(X.page) === 'screen-home');
    await X.ctx.close();
    for (const p of players) await p.ctx.close();
  }

  // --- F: ロビーで再読み込みしても同じ名前で戻れる ---
  {
    const A = await newPlayer(browser), B = await newPlayer(browser);
    const code = await createRoom(A.page, 'ホストA');
    await joinRoom(B.page, 'ゲストB', code);
    await B.page.waitForSelector('#screen-lobby.active');
    await B.page.reload();
    await joinRoom(B.page, 'ゲストB', code);
    await sleep(800);
    check('F: ロビー再読み込み後に同名で戻れる', await active(B.page) === 'screen-lobby');
    const count = await A.page.evaluate(() => roomPlayers.length);
    check('F: 人数が重複しない（' + count + '人）', count === 2);
    await A.ctx.close(); await B.ctx.close();
  }

  // --- G: 公開中、旧接続が残ったまま同じブラウザから再入室しても他者のカードが公開される ---
  {
    const { players, code } = await startGame(browser, ['ホストA', 'ゲストB']);
    const [A, B] = players.map(p => p.page);
    await submit(A); await submit(B);
    await A.waitForSelector('#screen-revealing.active');
    await A.click('#btn-open-my-flip');
    const B2 = await players[1].ctx.newPage(); // 同じトークンの別タブ（旧接続は生きたまま）
    await B2.goto(URL);
    await joinRoom(B2, 'ゲストB', code);
    await sleep(1000);
    const flipped = await A.evaluate(() => document.querySelectorAll('.flip-card-inner.flipped').length);
    check('G: ホスト画面で再入室者のカードが公開される（' + flipped + '枚）', flipped === 2);
    check('G: ホストに正解選択エリアが出る', await visible(A, 'host-correct-area'));
    // トークンなしでの同名再入室は拒否される
    const ok = await A.evaluate(c => new Promise(res => {
      const s = io({ transports: ['websocket'], forceNew: true });
      s.on('rejoin-success', () => res('success'));
      s.on('rejoin-error', () => res('rejected'));
      s.emit('rejoin-room', { roomId: c, playerName: 'ホストA' });
      setTimeout(() => res('timeout'), 3000);
    }), code);
    check('G: トークンなしの同名再入室は拒否（' + ok + '）', ok === 'rejected');
    for (const p of players) await p.ctx.close();
  }

  // --- H: 開かない人がいてもホストが「全員のフリップを開く」で進められる ---
  {
    const { players } = await startGame(browser, ['ホストA', 'ゲストB', 'ゲストC']);
    const [A, B, C] = players.map(p => p.page);
    await submit(A); await submit(B); await submit(C);
    await A.waitForSelector('#screen-revealing.active');
    check('H: ゲストには全員公開ボタンが出ない', !(await visible(B, 'btn-open-all-flips')));
    await A.click('#btn-open-my-flip');
    await A.click('#btn-open-all-flips');
    await sleep(800);
    check('H: 全員公開後に正解選択エリアが出る', await visible(A, 'host-correct-area'));
    for (const p of players) await p.ctx.close();
  }

  await browser.close();
  console.log(`\n結果: ${pass} 成功 / ${fail} 失敗`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
