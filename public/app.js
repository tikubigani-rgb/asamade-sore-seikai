// 朝までそれ正解 - クライアントサイドJS
'use strict';

// ======================================
// 初期化
// ======================================
const socket = io();

// ゲーム状態
let myPlayerId = null;
let myRoomId = null;
let hostPlayerId = null;    // ルーム内のホストのID（ロビー用）
let isHost = false;
let selectedRounds = 5;
let totalPlayers = 0;
let currentRoundNum = 1;
let totalRoundsNum = 5;
let revealedCount = 0;
let totalAnswers = 0;
let allAnswers = []; // 公開された回答の配列 {playerName, answer, isCorrect}
let revealScreenInitialized = false; // 公開画面が初期化済みかどうか

// ======================================
// 画面切り替え
// ======================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    // 画面上部へスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ======================================
// トースト通知
// ======================================
let toastTimer = null;
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ======================================
// XSS対策：テキストをエスケープ
// ======================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ======================================
// ローカルストレージ
// ======================================
function savePlayerName(name) {
  try {
    localStorage.setItem('asamade_player_name', name);
  } catch (e) { /* 無視 */ }
}

function loadPlayerName() {
  try {
    return localStorage.getItem('asamade_player_name') || '';
  } catch (e) { return ''; }
}

// ======================================
// URLハッシュ操作
// ======================================
function setHashRoomCode(roomId) {
  if (roomId) {
    history.replaceState(null, '', '#' + roomId);
  } else {
    history.replaceState(null, '', window.location.pathname);
  }
}

function getHashRoomCode() {
  const hash = window.location.hash.replace('#', '').toUpperCase().trim();
  return hash.length === 6 ? hash : '';
}

// ======================================
// プレイヤーリスト描画（ロビー）
// ======================================
function renderLobbyPlayers(players) {
  const list = document.getElementById('lobby-player-list');
  const countEl = document.getElementById('player-count');
  if (!list) return;

  list.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    const initial = escapeHTML(player.name.charAt(0).toUpperCase());
    const name = escapeHTML(player.name);
    // ホストIDが分かる場合はそれで判定、分からない場合は先頭プレイヤーをホスト扱い
    const playerIsHost = hostPlayerId
      ? player.id === hostPlayerId
      : player.id === players[0].id;

    if (playerIsHost) {
      li.className = 'is-host';
    }

    li.innerHTML = `
      <span class="player-icon">${initial}</span>
      <span class="player-name">${name}</span>
    `;
    list.appendChild(li);
  });

  if (countEl) countEl.textContent = players.length;
  totalPlayers = players.length;
}

// ======================================
// スコアリスト描画
// ======================================
function renderScoreList(scores, containerId) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = '';

  const medals = ['🥇', '🥈', '🥉'];

  scores.forEach((player, index) => {
    const li = document.createElement('li');
    li.className = 'score-item';
    const rankDisplay = medals[index] !== undefined ? medals[index] : String(index + 1);
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    li.innerHTML = `
      <span class="score-rank ${rankClass}">${escapeHTML(rankDisplay)}</span>
      <span class="score-name">${escapeHTML(player.name)}</span>
      <span class="score-points">${escapeHTML(String(player.score))}</span>
    `;
    list.appendChild(li);
  });
}

// ======================================
// 回答公開画面の初期化（ホスト・ゲスト共通）
// ======================================
function initRevealScreen() {
  if (revealScreenInitialized) return; // 二重初期化防止
  revealScreenInitialized = true;

  const list = document.getElementById('revealed-answers-list');
  if (list) list.innerHTML = '';
  allAnswers = [];
  revealedCount = 0;

  // ラウンドバッジ更新
  const badge = document.getElementById('revealing-round-badge');
  if (badge) {
    badge.textContent = `第${currentRoundNum}ラウンド / 全${totalRoundsNum}ラウンド`;
  }

  // ホスト用コントロール
  const hostControls = document.getElementById('host-reveal-controls');
  const endRoundBtn = document.getElementById('btn-end-round');
  const revealNextBtn = document.getElementById('btn-reveal-next');

  if (isHost) {
    hostControls.style.display = 'flex';
    endRoundBtn.style.display = 'none';
    revealNextBtn.style.display = 'block';
    revealNextBtn.disabled = false;
  } else {
    hostControls.style.display = 'none';
  }

  showScreen('screen-revealing');
}

// ======================================
// 初期化処理（ページ読み込み時）
// ======================================
document.addEventListener('DOMContentLoaded', () => {
  // 前回の名前を復元
  const savedName = loadPlayerName();
  const nameInput = document.getElementById('input-name');
  if (savedName && nameInput) {
    nameInput.value = savedName;
  }

  // URLハッシュからルームコードを復元
  const hashCode = getHashRoomCode();
  if (hashCode) {
    const roomCodeInput = document.getElementById('input-room-code');
    if (roomCodeInput) roomCodeInput.value = hashCode;
  }

  // ラウンドセレクター
  document.querySelectorAll('.btn-round-select').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-round-select').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRounds = parseInt(btn.dataset.rounds);
    });
  });

  // ===== ホーム画面 =====

  // ルーム作成ボタン
  document.getElementById('btn-create-room').addEventListener('click', () => {
    const name = (document.getElementById('input-name').value || '').trim();
    if (!name) {
      showToast('名前を入力してください');
      document.getElementById('input-name').focus();
      return;
    }
    savePlayerName(name);
    socket.emit('create-room', { playerName: name });
  });

  // ルーム参加ボタン
  document.getElementById('btn-join-room').addEventListener('click', () => {
    const name = (document.getElementById('input-name').value || '').trim();
    const code = (document.getElementById('input-room-code').value || '').trim().toUpperCase();
    if (!name) {
      showToast('名前を入力してください');
      document.getElementById('input-name').focus();
      return;
    }
    if (!code || code.length !== 6) {
      showToast('6文字のルームコードを入力してください');
      document.getElementById('input-room-code').focus();
      return;
    }
    savePlayerName(name);
    socket.emit('join-room', { roomId: code, playerName: name });
  });

  // Enterキーで参加（ルームコード入力欄）
  document.getElementById('input-room-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join-room').click();
  });

  // ===== ロビー画面 =====

  // コードコピーボタン
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('display-room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('コードをコピーしました！');
    }).catch(() => {
      // フォールバック：選択してコピーを促す
      showToast('コード: ' + code);
    });
  });

  // ゲームスタートボタン
  document.getElementById('btn-start-game').addEventListener('click', () => {
    socket.emit('start-game', { totalRounds: selectedRounds });
  });

  // ===== お題設定画面 =====

  // ランダムお題ボタン
  document.getElementById('btn-random-topic').addEventListener('click', () => {
    socket.emit('get-random-topic');
  });

  // お題確定ボタン
  document.getElementById('btn-set-topic').addEventListener('click', () => {
    const topic = (document.getElementById('input-topic').value || '').trim();
    if (!topic) {
      showToast('お題を入力してください');
      document.getElementById('input-topic').focus();
      return;
    }
    socket.emit('set-topic', { topic });
  });

  // ===== 回答入力画面 =====

  // 回答送信ボタン（1か所のみに集約）
  document.getElementById('btn-submit-answer').addEventListener('click', () => {
    const btn = document.getElementById('btn-submit-answer');
    const answer = (document.getElementById('input-answer').value || '').trim();
    if (!answer) {
      showToast('回答を入力してください');
      document.getElementById('input-answer').focus();
      return;
    }
    socket.emit('submit-answer', { answer });
    // 送信後UI更新
    document.getElementById('answer-form').style.display = 'none';
    document.getElementById('submitted-message').style.display = 'block';
    btn.disabled = true;
  });

  // ===== 回答公開画面 =====

  // 次の回答を公開ボタン
  document.getElementById('btn-reveal-next').addEventListener('click', () => {
    const btn = document.getElementById('btn-reveal-next');
    btn.disabled = true; // 二重クリック防止
    socket.emit('reveal-next');
    // サーバーからの応答後に再有効化
    setTimeout(() => { btn.disabled = false; }, 500);
  });

  // ラウンド終了ボタン
  document.getElementById('btn-end-round').addEventListener('click', () => {
    socket.emit('end-round');
  });

  // ===== ラウンド結果画面 =====

  // 次のラウンドへボタン
  document.getElementById('btn-next-round').addEventListener('click', () => {
    socket.emit('next-round');
  });

  // ===== ゲーム終了画面 =====

  // もう一度遊ぶボタン
  document.getElementById('btn-play-again').addEventListener('click', () => {
    // 状態リセット
    myPlayerId = null;
    myRoomId = null;
    hostPlayerId = null;
    isHost = false;
    selectedRounds = 5;
    revealScreenInitialized = false;
    setHashRoomCode('');
    showScreen('screen-home');
  });
});

// ======================================
// Socket.ioイベントハンドラー
// ======================================

// --- ルーム作成完了 ---
socket.on('room-created', ({ roomId, playerId }) => {
  myPlayerId = playerId;
  myRoomId = roomId;
  hostPlayerId = playerId; // 自分がホスト
  isHost = true;

  // ルームコード表示
  document.getElementById('display-room-code').textContent = roomId;
  setHashRoomCode(roomId);

  // プレイヤーリスト（自分だけ）
  const savedName = loadPlayerName();
  renderLobbyPlayers([{ id: playerId, name: savedName, score: 0 }]);

  // ホスト用コントロールを表示
  document.getElementById('host-controls').style.display = 'block';
  document.getElementById('guest-waiting').style.display = 'none';

  showScreen('screen-lobby');
});

// --- ルーム参加完了 ---
socket.on('room-joined', ({ roomId, players, isHost: hostFlag, playerId }) => {
  myPlayerId = playerId;
  myRoomId = roomId;
  isHost = hostFlag;
  // 参加時のホストは先頭プレイヤー（サーバーがホスト情報を渡さないため）
  hostPlayerId = players.length > 0 ? players[0].id : null;

  document.getElementById('display-room-code').textContent = roomId;
  setHashRoomCode(roomId);

  renderLobbyPlayers(players);
  totalPlayers = players.length;

  // ゲスト用UI
  document.getElementById('host-controls').style.display = 'none';
  document.getElementById('guest-waiting').style.display = 'block';

  showScreen('screen-lobby');
});

// --- 他のプレイヤーが参加 ---
socket.on('player-joined', ({ players }) => {
  renderLobbyPlayers(players);
  totalPlayers = players.length;
  showToast('新しいプレイヤーが参加しました');
});

// --- プレイヤーが退出 ---
socket.on('player-left', ({ players }) => {
  renderLobbyPlayers(players);
  totalPlayers = players.length;
  showToast('プレイヤーが退出しました');
});

// --- ホスト昇格 ---
socket.on('host-promoted', ({ message }) => {
  isHost = true;
  hostPlayerId = myPlayerId;
  showToast(message, 3500);

  // 現在の画面に応じてホスト用UIを表示
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen) return;

  const screenId = activeScreen.id;
  if (screenId === 'screen-lobby') {
    document.getElementById('host-controls').style.display = 'block';
    document.getElementById('guest-waiting').style.display = 'none';
  } else if (screenId === 'screen-topic') {
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
    document.getElementById('topic-guest-waiting').style.display = 'none';
  } else if (screenId === 'screen-revealing') {
    const hostControls = document.getElementById('host-reveal-controls');
    hostControls.style.display = 'flex';
    // 既公開分に正解チェックを追加（公開済み回答をホスト用に再描画）
    rebuildRevealListForHost();
  } else if (screenId === 'screen-round-result') {
    document.getElementById('result-host-controls').style.display = 'block';
    document.getElementById('result-guest-waiting').style.display = 'none';
  }
});

// --- ゲーム開始 ---
socket.on('game-started', ({ currentRound, totalRounds, isHost: hostFlag }) => {
  isHost = hostFlag !== undefined ? hostFlag : isHost;
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;

  if (isHost) {
    // ホスト：お題設定画面へ
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
    document.getElementById('topic-guest-waiting').style.display = 'none';
    document.getElementById('input-topic').value = '';
    showScreen('screen-topic');
  } else {
    // ゲスト：待機画面
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'none';
    document.getElementById('topic-guest-waiting').style.display = 'block';
    showScreen('screen-topic');
  }
});

// --- ランダムお題が届いた ---
socket.on('random-topic', ({ topic }) => {
  document.getElementById('input-topic').value = topic;
});

// --- お題確定・回答入力開始 ---
socket.on('topic-set', ({ topic, currentRound, totalRounds }) => {
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;

  // 回答フォームをリセット
  document.getElementById('input-answer').value = '';
  document.getElementById('answer-form').style.display = 'block';
  document.getElementById('submitted-message').style.display = 'none';

  // 送信ボタンを再有効化
  const submitBtn = document.getElementById('btn-submit-answer');
  if (submitBtn) submitBtn.disabled = false;

  // お題・ラウンド表示（回答入力画面）
  document.getElementById('submitting-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
  document.getElementById('submitting-topic').textContent = topic;

  // 回答公開画面のお題も更新しておく
  const revealingTopic = document.getElementById('revealing-topic');
  if (revealingTopic) revealingTopic.textContent = topic;

  // 回答数リセット
  document.getElementById('submitted-count').textContent = '0';
  document.getElementById('total-count').textContent = totalPlayers;
  document.getElementById('answer-progress-bar').style.width = '0%';

  // 公開画面初期化フラグをリセット
  revealScreenInitialized = false;

  showScreen('screen-submitting');
});

// --- 回答数更新 ---
socket.on('answer-count', ({ submitted, total }) => {
  document.getElementById('submitted-count').textContent = submitted;
  document.getElementById('total-count').textContent = total;
  const pct = total > 0 ? (submitted / total) * 100 : 0;
  document.getElementById('answer-progress-bar').style.width = pct + '%';
  totalPlayers = total;
});

// --- 全員回答完了（ホストへ）---
socket.on('all-submitted', () => {
  if (isHost) {
    showToast('全員が回答しました！公開を開始しましょう');
    // 公開画面へ初期化して遷移
    initRevealScreen();
  }
});

// --- 回答公開イベント ---
socket.on('answer-revealed', ({ playerName, answer, revealedCount: rc, total }) => {
  revealedCount = rc;
  totalAnswers = total;

  // ゲストは最初の回答公開で画面遷移（まだ公開画面にいない場合）
  if (!revealScreenInitialized) {
    initRevealScreen();
  }

  allAnswers.push({ playerName, answer, isCorrect: false });

  const list = document.getElementById('revealed-answers-list');
  if (!list) return;

  const li = buildAnswerListItem(playerName, answer, rc);
  list.appendChild(li);

  // 全回答公開済みならホストに終了ボタンを表示
  if (isHost && rc >= total) {
    document.getElementById('btn-reveal-next').style.display = 'none';
    document.getElementById('btn-end-round').style.display = 'block';
  }
});

// 回答アイテムのDOM要素を生成（ホスト/ゲスト共通）
function buildAnswerListItem(playerName, answer, index) {
  const li = document.createElement('li');
  li.className = 'answer-item';
  li.dataset.answer = answer;

  if (isHost) {
    // ホスト：チェックボックス付き
    const checkboxId = `correct-${escapeHTML(String(index))}`;
    li.innerHTML = `
      <div class="answer-item-host">
        <div class="answer-item-content">
          <div class="answer-player-name">${escapeHTML(playerName)}</div>
          <div class="answer-text">${escapeHTML(answer)}</div>
        </div>
        <label class="correct-checkbox-label" for="${checkboxId}">
          <input type="checkbox" id="${checkboxId}" class="correct-check">
          正解
        </label>
      </div>
    `;
    // チェックボックスのイベント
    const checkbox = li.querySelector('.correct-check');
    checkbox.addEventListener('change', () => {
      socket.emit('mark-correct', { answer });
    });
  } else {
    // ゲスト：シンプル表示
    li.innerHTML = `
      <div class="answer-player-name">${escapeHTML(playerName)}</div>
      <div class="answer-text">${escapeHTML(answer)}</div>
    `;
  }

  return li;
}

// ホスト昇格時：既存のゲスト用リストをホスト用に再描画
function rebuildRevealListForHost() {
  const list = document.getElementById('revealed-answers-list');
  if (!list) return;

  list.innerHTML = '';
  allAnswers.forEach((item, index) => {
    const li = buildAnswerListItem(item.playerName, item.answer, index + 1);
    if (item.isCorrect) {
      li.classList.add('correct-answer');
      const checkbox = li.querySelector('.correct-check');
      if (checkbox) checkbox.checked = true;
    }
    list.appendChild(li);
  });

  // ボタン状態を更新
  const revealNextBtn = document.getElementById('btn-reveal-next');
  const endRoundBtn = document.getElementById('btn-end-round');
  if (revealedCount >= totalAnswers && totalAnswers > 0) {
    revealNextBtn.style.display = 'none';
    endRoundBtn.style.display = 'block';
  } else {
    revealNextBtn.style.display = 'block';
    endRoundBtn.style.display = 'none';
  }
}

// --- 正解マーク更新 ---
socket.on('correct-marked', ({ answer, marked }) => {
  // 該当する回答アイテムにクラスを付与/削除
  const items = document.querySelectorAll('#revealed-answers-list .answer-item');
  items.forEach(item => {
    if (item.dataset.answer === answer) {
      if (marked) {
        item.classList.add('correct-answer');
      } else {
        item.classList.remove('correct-answer');
      }
      // ホストのチェックボックスも同期
      const checkbox = item.querySelector('.correct-check');
      if (checkbox) checkbox.checked = marked;
    }
  });

  // allAnswers内の状態も更新
  allAnswers.forEach(a => {
    if (a.answer === answer) a.isCorrect = marked;
  });
});

// --- ラウンド終了 ---
socket.on('round-ended', ({ scores, correctAnswers, currentRound, totalRounds }) => {
  // 正解回答表示
  const correctDisplay = document.getElementById('correct-answers-display');
  correctDisplay.innerHTML = '';

  if (correctAnswers.length === 0) {
    const p = document.createElement('p');
    p.textContent = '今回は正解なし';
    p.style.color = 'var(--color-gray)';
    p.style.textAlign = 'center';
    correctDisplay.appendChild(p);
  } else {
    correctAnswers.forEach(ans => {
      const badge = document.createElement('div');
      badge.className = 'correct-answer-badge';
      badge.textContent = ans;
      correctDisplay.appendChild(badge);
    });
  }

  // スコア表示
  renderScoreList(scores, 'round-score-list');

  // ラウンドバッジ
  document.getElementById('result-round-badge').textContent = `第${currentRound}ラウンド 結果`;

  // ホスト/ゲストで表示切り替え
  if (isHost) {
    document.getElementById('result-host-controls').style.display = 'block';
    document.getElementById('result-guest-waiting').style.display = 'none';
  } else {
    document.getElementById('result-host-controls').style.display = 'none';
    document.getElementById('result-guest-waiting').style.display = 'block';
  }

  // 公開画面の初期化フラグをリセット（次ラウンドに備える）
  revealScreenInitialized = false;

  showScreen('screen-round-result');
});

// --- 次のラウンド開始 ---
socket.on('next-round-started', ({ currentRound, totalRounds, isHost: hostFlag }) => {
  isHost = hostFlag !== undefined ? hostFlag : isHost;
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;

  // 公開画面初期化フラグをリセット
  revealScreenInitialized = false;

  if (isHost) {
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
    document.getElementById('topic-guest-waiting').style.display = 'none';
    document.getElementById('input-topic').value = '';
    showScreen('screen-topic');
  } else {
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'none';
    document.getElementById('topic-guest-waiting').style.display = 'block';
    showScreen('screen-topic');
  }

  // 送信ボタンを再有効化
  const submitBtn = document.getElementById('btn-submit-answer');
  if (submitBtn) submitBtn.disabled = false;
});

// --- ゲーム終了 ---
socket.on('game-ended', ({ finalScores }) => {
  // 1位表示
  const winner = finalScores[0];
  const winnerEl = document.getElementById('final-winner');
  if (winner) {
    winnerEl.innerHTML = `
      <span class="winner-crown">👑</span>
      <div class="winner-name">${escapeHTML(winner.name)}</div>
      <div class="winner-score">${escapeHTML(String(winner.score))}ポイント</div>
    `;
  }

  renderScoreList(finalScores, 'final-score-list');
  showScreen('screen-finished');
});

// --- エラー ---
socket.on('error', ({ message }) => {
  showToast('エラー：' + message, 3000);
});

// --- 接続断 ---
socket.on('disconnect', () => {
  showToast('サーバーとの接続が切れました。再接続しています...', 4000);
});

// --- 再接続 ---
socket.on('connect', () => {
  if (myRoomId) {
    showToast('再接続しました');
  }
});
