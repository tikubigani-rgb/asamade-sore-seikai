// 朝までそれ正解 - サーバー
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ポート設定（Render対応）
const PORT = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// ヘルスチェック用エンドポイント
app.get('/ping', (req, res) => res.send('pong'));

// ルーム管理
const rooms = new Map();

// お題リスト（178問）
const TOPICS = [
  '部下に慕われる上司の条件は？',
  '怖いものは？',
  '名作映画は？',
  'お金持ちが持っているものは？',
  'かわいい生き物は？',
  'さらりと言えたらかっこいい言葉は？',
  '彼氏に言われてキュンとくる一言は？',
  '日本を代表するアイドルは？',
  '今流行っているものは？',
  '人としてやってはいけない事は？',
  '日本が世界に誇れるものは？',
  '母親がよく言う一言は？',
  '時代劇でよく聞く言葉は？',
  'お酒に合うおつまみは？',
  '唇がセクシーな芸能人は？',
  '日本の名曲は？',
  '学校にあるものは？',
  'ＯＬが好きな甘い食べ物は？',
  'お正月のイベントは？',
  'デートの後のかっこいい一言は？',
  '人に言われて傷つく言葉は？',
  '新婚旅行で行きたい観光スポットは？',
  '体によさそうなものは？',
  '大人が抱えるコンプレックスは？',
  '独身女性が求める結婚相手の条件は？',
  '芸能人に必要なものは？',
  '芸人にとって大事なことは？',
  'お母さん役が似合う女優は？',
  '中華料理の定番メニューは？',
  '心が癒されることは？',
  '女の子に言われて傷つくことは？',
  '大人としてやってはいけないことは？',
  'キスの後のかっこいい一言は？',
  '主婦の生活必需品は？',
  'お酒のおつまみは？',
  'ＯＬが好きなオシャレな飲み物は？',
  '大人の飲み物は？',
  'モテる女性の条件は？',
  '女性に言われたらショックな言葉は？',
  '昭和を代表するアーティストは？',
  '日本の名作漫画は？',
  '子どもが好きなキャラクターは？',
  '日本が世界に誇れるものは？',
  'かわいいものは？',
  '腹立たしい行為は？',
  '女性が好きなものは？',
  'テンションの上がる出来事は？',
  '人にあげて喜ばれるものは？',
  '日本の名作漫画は？',
  '大物ミュージシャンは？',
  '小学校にあるものは？',
  '実力派俳優は？',
  '女性が好きな食べ物は？',
  'プロスポーツ選手に必要なものは？',
  '相手を不快にさせる行為は？',
  '人に言われたら腹立つことは？',
  'メガネが似合う有名人は？',
  '焼いて食べると旨いものは？',
  '名曲は？',
  '恋人に作って欲しい料理は？',
  '人に言われると悲しい言葉は？',
  '日本が世界に誇れるものは？',
  '若者に人気のある女性有名人は？',
  '居酒屋の食べ物のメニューは？',
  '超一流スポーツ選手は？',
  'バレると奥さんに怒られることは？',
  '冬に飲みたくなる飲み物は？',
  'テレビ番組に必要なものは？',
  '女性の家にあるものは？',
  'キレイな熟女芸能人は？',
  'テンションがあがるものは？',
  '政治家に必要なものは？',
  '怖いものは？',
  '人気者は？',
  '子供が喜ぶものは？',
  '若い女性が好きなことは？',
  'アメリカ人が好きな食べ物は？',
  'キスシーンが見たい女優は？',
  '日本の名曲といえば？',
  '今使うと恥ずかしい死語は？',
  '不良がよく言うセリフは？',
  'お年寄りが大好きなものといえば？',
  '女性が憧れる女性有名人は？',
  '日本人の大好きな食べ物は？',
  'ハリウッドスターは？',
  'オシャレな男が持っているものは？',
  '怖いものは？',
  '恋人にしたい女性有名人は？',
  '女性に贈ると喜ばれる物は？',
  'お弁当に入っていてうれしいおかずは？',
  '人として最低な行為は？',
  'デカい人といえば？',
  '小腹が空いた時食べたくなるスイーツは？',
  '強い生き物は？',
  '卒業式で言いたい言葉は？',
  '人から言われて嬉しい言葉は？',
  '主婦がスーパーで買うものは？',
  'セクシーな男性芸能人は？',
  '人としてやってはいけない事は？',
  'お洒落な人が飲むドリンクは？',
  '自宅にあったらカッコイイものは？',
  '女性がカラオケで歌うと可愛く見える曲は？',
  '渋い役者は？',
  'アニメ界のマドンナといえば？',
  '夏休みの定番行事といえば？',
  'お嫁さんにしたい女性芸能人は？',
  '滅多に食べられないご馳走は？',
  'イケてる男の部屋にあるものは？',
  '朝の食卓に欠かせない物は？',
  '売れっ子アイドルの条件は？',
  '日本の大ヒットテレビドラマは？',
  '外国人が喜ぶ日本のおみやげは？',
  'ヒーローの名前は？',
  'コンビニでよく買うモノは？',
  'カラオケで女性に歌って欲しいアーティストは？',
  '朝食に食べたいものは？',
  '女子高生のカバンに入っているものは？',
  '初老男性の悩みといえば？',
  '夏休みに行きたくなる人気スポットは？',
  '奥様方が好きな事は？',
  '夏の風物詩は？',
  'かわいいモノは？',
  '昭和の大ヒットＴＶアニメは？',
  'モテる男の条件は？',
  '強い生き物は？',
  'かっこいい職業は？',
  'おしゃれなものは？',
  'おいしい和食は？',
  'カラオケで盛り上がる曲は？',
  '女性が抱かれたい芸能人は？',
  '健康に良いことは？',
  '昭和の伝説的テレビ番組は？',
  '人としてダメなことは？',
  '居酒屋の定番メニューは？',
  '頭の良さそうな芸能人は？',
  '女の子が憧れる職業は？',
  '名俳優は？',
  '癒されるものは？',
  'お金では買えないものは？',
  'かっこいい言葉は？',
  '女性に嫌われることは？',
  'サラリーマンがよく使う言葉は？',
  '女の子に作って欲しい料理は？',
  'オシャレな趣味は？',
  '"男らしい"芸能人は？',
  '学校の先生がよく言うことは？',
  '男子中高生が好きそうな女性有名人は？',
  '頭が良さそうな言葉は？',
  '日本が世界に誇れるものは？',
  '子供が大好きなものは？',
  '名作映画は？',
  'プレイボーイの名前は？',
  '毎日することは？',
  'かっこいい街は？',
  'キスの後のかっこいい一言は？',
  'お金持ちの家にあるものは？',
  'ご飯にのせたら美味しいものは？',
  'いい女の条件は？',
  '子供のころ流行った遊びは？',
  '王道アイドルは？',
  '名作映画は？',
  '美味しい食べ物は？',
  '女性の部屋に必ずあるものは？',
  'オシャレな言葉は？',
  '懐かしい流行語は？',
  '男なら持っていなければならないものは？',
  'カラオケで盛り上がるアーティストは？',
  'やってはいけないことは？',
  '女性が貰って喜ぶものは？',
  'セクシーな言葉は？',
  'ケンカが強そうな芸能人は？',
  '触るとやわらかいものは？',
  '格好良い芸能人は？',
  '女性と部屋にいる時ムードが盛り上がる曲は？',
  '清楚なイメージのある女性芸能人は？',
  '男らしい言葉は？',
  'かわいいものは？',
  '美味しい食べ物は？',
];

// ランダムなルームID生成（6文字英数字）
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ランダムひらがな取得
function getRandomHiragana() {
  const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ';
  return hiragana.charAt(Math.floor(Math.random() * hiragana.length));
}

// ランダムお題取得
function getRandomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

// ユニークなルームIDを生成（既存と重複しない）
function createUniqueRoomId() {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));
  return roomId;
}

// 切断中プレイヤーのセッションを一時保持するMap
// key: playerName + ':' + roomId, value: { timer, playerId, roomId, playerName }
const disconnectSessions = new Map();
const DISCONNECT_TIMEOUT_MS = 30000; // 30秒間セッション保持

// Socket.io接続処理
io.on('connection', (socket) => {
  console.log(`プレイヤー接続: ${socket.id}`);

  // --- ルーム作成 ---
  socket.on('create-room', ({ playerName }) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      socket.emit('error', { message: 'プレイヤー名を入力してください' });
      return;
    }

    const roomId = createUniqueRoomId();
    const player = {
      id: socket.id,
      name: playerName.trim().substring(0, 20), // 最大20文字
      score: 0
    };

    // ルームState初期化
    const roomState = {
      roomId,
      hostId: socket.id,
      players: [player],
      gameState: 'waiting',
      currentRound: 0,
      totalRounds: 5,
      topic: '',
      answers: new Map(),
      revealedAnswers: [],
      correctAnswers: new Set(), // 複数正解対応
      openedFlips: new Set() // 変更2: フリップ公開済みplayerIdのSet
    };

    rooms.set(roomId, roomState);
    socket.join(roomId);
    socket.roomId = roomId;

    socket.emit('room-created', { roomId, playerId: socket.id });
    console.log(`ルーム作成: ${roomId} by ${playerName}`);
  });

  // --- ルーム参加 ---
  socket.on('join-room', ({ roomId, playerName }) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      socket.emit('error', { message: 'プレイヤー名を入力してください' });
      return;
    }

    const upperRoomId = (roomId || '').toUpperCase().trim();
    const room = rooms.get(upperRoomId);

    if (!room) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    if (room.gameState !== 'waiting') {
      socket.emit('error', { message: 'ゲームはすでに開始されています' });
      return;
    }

    // 同名チェック
    const existingName = room.players.find(
      p => p.name === playerName.trim()
    );
    if (existingName) {
      socket.emit('error', { message: 'その名前はすでに使われています' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName.trim().substring(0, 20),
      score: 0
    };

    room.players.push(player);
    socket.join(upperRoomId);
    socket.roomId = upperRoomId;

    // 参加者本人へ
    socket.emit('room-joined', {
      roomId: upperRoomId,
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      isHost: false,
      playerId: socket.id,
      hostId: room.hostId
    });

    // 既存参加者へ通知
    socket.to(upperRoomId).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      hostId: room.hostId
    });

    console.log(`プレイヤー参加: ${playerName} → ルーム ${upperRoomId}`);
  });

  // --- ゲーム開始（ホストのみ） ---
  socket.on('start-game', ({ totalRounds }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみゲームを開始できます' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: '2人以上で遊べます' });
      return;
    }

    const rounds = parseInt(totalRounds);
    if ([3, 5, 7, 10].includes(rounds)) {
      room.totalRounds = rounds;
    }

    room.gameState = 'topic-setting';
    room.currentRound = 1;

    // ホストにお題設定画面へ
    socket.emit('game-started', {
      topic: '',
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      isHost: true
    });

    // 他プレイヤーは待機
    socket.to(socket.roomId).emit('game-started', {
      topic: '',
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      isHost: false
    });

    console.log(`ゲーム開始: ルーム ${socket.roomId} / ${room.totalRounds}ラウンド`);
  });

  // --- お題設定（ホストのみ） ---
  socket.on('set-topic', ({ topic }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみお題を設定できます' });
      return;
    }

    const trimmedTopic = (topic || '').trim();
    if (!trimmedTopic) {
      socket.emit('error', { message: 'お題を入力してください' });
      return;
    }

    room.topic = trimmedTopic.substring(0, 200); // base64対応のため上限を拡張
    room.answers = new Map();
    room.revealedAnswers = [];
    room.correctAnswers = new Set();
    room.openedFlips = new Set(); // フリップ公開済みをリセット
    room.gameState = 'submitting';
    room.submittingStartedAt = Date.now(); // 5分タイマー開始時刻を記録

    // 以前の回答タイムアウトをクリア
    if (room.submitTimeout5min) {
      clearTimeout(room.submitTimeout5min);
      room.submitTimeout5min = null;
    }

    // 5分（300秒）後に強制的にrevealingフェーズへ（描画タイマー）
    room.submitTimeout5min = setTimeout(() => {
      const currentRoom = rooms.get(socket.roomId);
      if (!currentRoom || currentRoom.gameState !== 'submitting') return;

      console.log(`回答タイムアウト（5分）→ revealing へ強制移行: ルーム ${socket.roomId}`);
      currentRoom.gameState = 'revealing';
      currentRoom.openedFlips = new Set();
      const activePlayers = currentRoom.players.filter(p => !p.disconnected);
      io.to(socket.roomId).emit('all-submitted', {
        players: activePlayers.map(p => ({ id: p.id, name: p.name }))
      });
    }, 300000);

    // 全員に回答入力画面へ
    io.to(socket.roomId).emit('topic-set', {
      topic: room.topic,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      submittingStartedAt: room.submittingStartedAt
    });

    console.log(`お題設定: 「${room.topic}」 ルーム ${socket.roomId}`);
  });

  // --- 回答送信（base64画像対応） ---
  socket.on('submit-answer', ({ answer, roomId: payloadRoomId }) => {
    let room = rooms.get(socket.roomId);
    let resolvedRoomId = socket.roomId;

    // Socket.io v4 は再接続時に send buffer を reconnect イベントより先にフラッシュするため
    // submit-answer が rejoin-room より先に届く場合がある。
    // その場合 payloadRoomId でルームを特定し、socket をルームに参加させてから処理を続ける。
    // rejoin-room が後で届いた際、既存の回答ID付け替えロジック（rejoin-room ハンドラ内）が
    // new socket.id で保存された回答を正しく処理する。
    if (!room && payloadRoomId) {
      room = rooms.get(payloadRoomId);
      resolvedRoomId = payloadRoomId;
      if (room) {
        socket.roomId = resolvedRoomId;
        socket.join(resolvedRoomId);
        console.log(`submit-answer フォールバック: roomId=${payloadRoomId} (rejoin-room より先に到達)`);
      }
    }

    if (!room || !resolvedRoomId) return;

    if (room.gameState !== 'submitting') {
      socket.emit('error', { message: '回答受付中ではありません' });
      return;
    }

    // 画像データ（base64）はtrimしない
    const isImage = typeof answer === 'string' && answer.startsWith('data:image/');
    const processedAnswer = isImage ? answer : (answer || '').trim();

    if (!processedAnswer) {
      socket.emit('error', { message: '回答を入力してください' });
      return;
    }

    // 上書き可能（送信前なら修正OK）
    // テキストは100文字、画像はそのまま保存
    room.answers.set(socket.id, isImage ? processedAnswer : processedAnswer.substring(0, 100));

    const submitted = room.answers.size;
    const total = room.players.length;
    const activePlayers = room.players.filter(p => !p.disconnected);
    const activeSubmitted = activePlayers.filter(p => room.answers.has(p.id)).length;

    // 全員に回答数を通知
    io.to(resolvedRoomId).emit('answer-count', { submitted, total });

    // アクティブプレイヤー全員回答完了（または全員回答完了）
    if (submitted >= total || (activePlayers.length > 0 && activeSubmitted >= activePlayers.length)) {
      // タイムアウトをクリア
      if (room.submitTimeout5min) {
        clearTimeout(room.submitTimeout5min);
        room.submitTimeout5min = null;
      }
      room.gameState = 'revealing';
      room.openedFlips = new Set(); // フリップ公開済みをリセット
      // 全員に通知（アクティブプレイヤー情報付き）
      io.to(resolvedRoomId).emit('all-submitted', {
        players: activePlayers.map(p => ({ id: p.id, name: p.name }))
      });
    }

    console.log(`回答受付: ${submitted}/${total} ルーム ${resolvedRoomId}`);
  });

  // --- フリップ公開（各プレイヤーが任意のタイミングで自分の回答を公開）---
  socket.on('open-flip', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.gameState !== 'revealing') return;
    if (room.openedFlips.has(socket.id)) return; // 二重公開防止

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // 5分タイムアウト等で強制移行後、未送信の場合も null で公開可能にする
    const answer = room.answers.get(socket.id) || null;

    room.openedFlips.add(socket.id);

    // 全員に公開
    io.to(socket.roomId).emit('flip-opened', {
      playerId: socket.id,
      playerName: player.name,
      answer: answer,
      openedCount: room.openedFlips.size,
      total: room.players.length
    });
  });

  // --- 正解マーク（ホストのみ、複数選択トグル） ---
  socket.on('mark-correct', ({ answer }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみ正解を選べます' });
      return;
    }

    if (room.correctAnswers.has(answer)) {
      room.correctAnswers.delete(answer);
    } else {
      room.correctAnswers.add(answer);
    }

    io.to(socket.roomId).emit('correct-marked', {
      answer,
      selected: room.correctAnswers.has(answer),
      selectedAnswers: Array.from(room.correctAnswers)
    });
  });

  // --- ラウンド終了（ホストのみ） ---
  socket.on('end-round', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみラウンドを終了できます' });
      return;
    }

    room.players.forEach(player => {
      const playerAnswer = room.answers.get(player.id);
      if (room.correctAnswers.size > 0 && playerAnswer && room.correctAnswers.has(playerAnswer)) {
        player.score += 1;
      }
    });

    const scores = room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score
    })).sort((a, b) => b.score - a.score);

    room.gameState = 'results';

    io.to(socket.roomId).emit('round-ended', {
      scores,
      correctAnswers: Array.from(room.correctAnswers),
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });

    console.log(`ラウンド終了: ${room.currentRound}/${room.totalRounds} ルーム ${socket.roomId}`);
  });

  // --- 次のラウンド（ホストのみ） ---
  socket.on('next-round', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみ次のラウンドへ進めます' });
      return;
    }

    if (room.currentRound >= room.totalRounds) {
      // ゲーム終了
      room.gameState = 'finished';
      const finalScores = room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      })).sort((a, b) => b.score - a.score);

      io.to(socket.roomId).emit('game-ended', { finalScores });
      console.log(`ゲーム終了: ルーム ${socket.roomId}`);
    } else {
      // 次のラウンド
      room.currentRound += 1;
      room.gameState = 'topic-setting';
      room.answers = new Map();
      room.revealedAnswers = [];
      room.correctAnswers = new Set();
      room.openedFlips = new Set(); // フリップ公開済みをリセット
      room.topic = '';
      room.submittingStartedAt = null;
      if (room.submitTimeout5min) {
        clearTimeout(room.submitTimeout5min);
        room.submitTimeout5min = null;
      }

      // ホストにお題設定画面へ
      socket.emit('next-round-started', {
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        isHost: true
      });

      socket.to(socket.roomId).emit('next-round-started', {
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        isHost: false
      });
    }
  });

  // --- 途中入室（再入室） ---
  socket.on('rejoin-room', ({ roomId, playerName }) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      socket.emit('rejoin-error', { message: 'プレイヤー名を入力してください' });
      return;
    }

    const upperRoomId = (roomId || '').toUpperCase().trim();
    const room = rooms.get(upperRoomId);

    if (!room) {
      socket.emit('rejoin-error', { message: 'ルームが見つかりません。ルームIDをご確認ください。' });
      return;
    }

    if (room.gameState === 'finished') {
      socket.emit('rejoin-error', { message: 'ゲームはすでに終了しています' });
      return;
    }

    const trimmedName = playerName.trim().substring(0, 20);

    // 既存プレイヤーかどうか確認（同名で再入室）
    const existingPlayer = room.players.find(p => p.name === trimmedName);
    let wasHost = false;
    let hasSubmitted = false;

    if (existingPlayer) {
      // 切断セッションのタイムアウトをキャンセル
      const sessionKey = trimmedName + ':' + upperRoomId;
      if (disconnectSessions.has(sessionKey)) {
        clearTimeout(disconnectSessions.get(sessionKey).timer);
        disconnectSessions.delete(sessionKey);
        console.log(`切断セッションキャンセル（再入室）: ${trimmedName}`);
      }

      // ID更新前に回答済みかチェック（古いIDで保存されているため）
      hasSubmitted = room.answers.has(existingPlayer.id);
      // 回答がある場合は新しいIDに紐付け直す
      if (hasSubmitted) {
        const existingAnswer = room.answers.get(existingPlayer.id);
        room.answers.delete(existingPlayer.id);
        room.answers.set(socket.id, existingAnswer);
      }
      // openedFlipsも更新
      if (room.openedFlips && room.openedFlips.has(existingPlayer.id)) {
        room.openedFlips.delete(existingPlayer.id);
        room.openedFlips.add(socket.id);
      }
      // ホストが再入室した場合は room.hostId も更新
      if (room.hostId === existingPlayer.id) {
        wasHost = true;
        room.hostId = socket.id;
      }
      // 既存プレイヤーのソケットIDを更新（再接続扱い）＆切断フラグ解除
      existingPlayer.id = socket.id;
      existingPlayer.disconnected = false;
    } else {
      // 新規として追加（途中参加）
      room.players.push({
        id: socket.id,
        name: trimmedName,
        score: 0
      });
    }

    socket.join(upperRoomId);
    socket.roomId = upperRoomId;

    // ホスト判定
    const isRejoinHost = room.hostId === socket.id;

    // 現在のゲーム状態を送信
    const gameStateInfo = {
      roomId: upperRoomId,
      playerId: socket.id,
      hostId: room.hostId,
      isHost: isRejoinHost,
      gameState: room.gameState,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      topic: room.topic,
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      hasSubmitted: hasSubmitted,
      submittedCount: room.answers.size,
      totalCount: room.players.length,
      openedFlipCount: room.openedFlips ? room.openedFlips.size : 0,
      submittingStartedAt: room.submittingStartedAt || null
    };

    socket.emit('rejoin-success', gameStateInfo);

    // submitting状態でかつ全アクティブプレイヤーが回答済みなら all-submitted を発火
    if (room.gameState === 'submitting') {
      const activePlayers = room.players.filter(p => !p.disconnected);
      const activeSubmitted = activePlayers.filter(p => room.answers.has(p.id)).length;
      if (activePlayers.length > 0 && activeSubmitted >= activePlayers.length) {
        if (room.submitTimeout5min) {
          clearTimeout(room.submitTimeout5min);
          room.submitTimeout5min = null;
        }
        room.gameState = 'revealing';
        room.openedFlips = new Set();
        io.to(upperRoomId).emit('all-submitted', {
          players: activePlayers.map(p => ({ id: p.id, name: p.name }))
        });
        console.log(`rejoin後 全員提出完了: ルーム ${upperRoomId}`);
      }
    }

    // 既存プレイヤーに通知
    socket.to(upperRoomId).emit('player-rejoined', {
      playerName: trimmedName,
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      hostId: room.hostId
    });

    console.log(`プレイヤー再入室: ${trimmedName} → ルーム ${upperRoomId} (状態: ${room.gameState})`);
  });

  // --- 切断処理 ---
  socket.on('disconnect', () => {
    console.log(`プレイヤー切断: ${socket.id}`);
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // 切断プレイヤーの名前を取得
    const disconnectedPlayer = room.players.find(p => p.id === socket.id);
    if (!disconnectedPlayer) return;

    const sessionKey = disconnectedPlayer.name + ':' + roomId;

    // 既存のタイムアウトがあればクリア（二重切断対策）
    if (disconnectSessions.has(sessionKey)) {
      clearTimeout(disconnectSessions.get(sessionKey).timer);
    }

    // プレイヤーを「切断中」フラグにする（リストからは削除しない）
    disconnectedPlayer.disconnected = true;

    // 他プレイヤーに切断を通知（ゲームは継続）
    io.to(roomId).emit('player-disconnected', {
      playerName: disconnectedPlayer.name,
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score, disconnected: p.disconnected || false }))
    });

    // submitting フェーズで切断プレイヤーをスキップ（デッドロック防止）
    if (room.gameState === 'submitting') {
      const activePlayers = room.players.filter(p => !p.disconnected);
      const activeSubmitted = activePlayers.filter(p => room.answers.has(p.id)).length;
      const total = room.players.length;
      const submitted = room.answers.size;

      io.to(roomId).emit('answer-count', { submitted, total });

      // アクティブプレイヤー全員が回答済みなら次のフェーズへ
      if (activePlayers.length > 0 && activeSubmitted >= activePlayers.length) {
        room.gameState = 'revealing';
        room.openedFlips = new Set();
        io.to(roomId).emit('all-submitted', {
          players: room.players.filter(p => !p.disconnected).map(p => ({ id: p.id, name: p.name }))
        });
      }
    }

    // revealing フェーズで未公開の場合、自動でフリップ公開して進行を継続
    if (room.gameState === 'revealing') {
      const answer = room.answers.get(socket.id);
      if (answer && !room.openedFlips.has(socket.id)) {
        room.openedFlips.add(socket.id);
        const activePlayers = room.players.filter(p => !p.disconnected);
        io.to(roomId).emit('flip-opened', {
          playerId: socket.id,
          playerName: disconnectedPlayer.name,
          answer: answer,
          openedCount: room.openedFlips.size,
          total: activePlayers.length
        });
      }
    }

    // 30秒後にセッションを本当に削除
    const timer = setTimeout(() => {
      disconnectSessions.delete(sessionKey);

      const currentRoom = rooms.get(roomId);
      if (!currentRoom) return;

      // まだ切断中のままなら本当に退出処理
      const stillDisconnected = currentRoom.players.find(
        p => p.name === disconnectedPlayer.name && p.disconnected
      );
      if (!stillDisconnected) return;

      console.log(`セッションタイムアウト・退出: ${disconnectedPlayer.name} ルーム ${roomId}`);

      const playerId = stillDisconnected.id;

      // プレイヤーをリストから削除
      currentRoom.players = currentRoom.players.filter(p => p.name !== disconnectedPlayer.name);
      currentRoom.answers.delete(playerId);
      if (currentRoom.openedFlips) currentRoom.openedFlips.delete(playerId);

      if (currentRoom.players.length === 0) {
        rooms.delete(roomId);
        console.log(`ルーム削除（全員退出）: ${roomId}`);
        return;
      }

      // ホストが完全退出した場合、アクティブなプレイヤーをホストに昇格
      if (currentRoom.hostId === playerId) {
        const nextActive = currentRoom.players.find(p => !p.disconnected) || currentRoom.players[0];
        currentRoom.hostId = nextActive.id;
        io.to(nextActive.id).emit('host-promoted', {
          message: 'あなたがホストになりました'
        });
        console.log(`ホスト昇格: ${nextActive.name} ルーム ${roomId}`);
      }

      io.to(roomId).emit('player-left', {
        players: currentRoom.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
      });

      // submitting フェーズ再チェック
      if (currentRoom.gameState === 'submitting' && currentRoom.players.length > 0) {
        const activePlayers = currentRoom.players.filter(p => !p.disconnected);
        const activeSubmitted = activePlayers.filter(p => currentRoom.answers.has(p.id)).length;
        const submitted = currentRoom.answers.size;
        const total = currentRoom.players.length;

        io.to(roomId).emit('answer-count', { submitted, total });

        if (activePlayers.length > 0 && activeSubmitted >= activePlayers.length) {
          currentRoom.gameState = 'revealing';
          currentRoom.openedFlips = new Set();
          io.to(roomId).emit('all-submitted', {
            players: activePlayers.map(p => ({ id: p.id, name: p.name }))
          });
        }
      }
    }, DISCONNECT_TIMEOUT_MS);

    disconnectSessions.set(sessionKey, {
      timer,
      playerId: socket.id,
      roomId,
      playerName: disconnectedPlayer.name
    });

    console.log(`プレイヤー切断（セッション保持30秒）: ${disconnectedPlayer.name} ルーム ${roomId}`);
  });

  // --- ランダムお題リクエスト ---
  socket.on('get-random-topic', () => {
    const topic = getRandomTopic();
    const char = getRandomHiragana();
    socket.emit('random-topic', { topic, char });
  });
});

// Renderスリープ防止：自己pingを14分ごとに実行
// RENDER_EXTERNAL_URL・RENDER_EXTERNAL_HOSTNAMEはRenderが自動でセットする変数
const SELF_PING_URL =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null);

if (SELF_PING_URL) {
  setInterval(() => {
    fetch(SELF_PING_URL + '/ping')
      .then(() => console.log('self-ping OK'))
      .catch(err => console.error('self-ping failed:', err.message));
  }, 14 * 60 * 1000);
  console.log(`self-ping 設定: ${SELF_PING_URL}/ping (14分間隔)`);
}

// サーバー起動
server.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
