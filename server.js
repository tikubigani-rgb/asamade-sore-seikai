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

// ルーム管理
const rooms = new Map();

// お題リスト（30問以上）
const TOPICS = [
  '「あ」から始まる食べ物といえば？',
  '「か」から始まる動物といえば？',
  '「な」から始まる赤いものといえば？',
  '「さ」から始まるスポーツといえば？',
  '「ひ」から始まる怖いものといえば？',
  '「は」から始まる花といえば？',
  '「う」から始まる乗り物といえば？',
  '「む」から始まる食べ物といえば？',
  '「き」から始まる黄色いものといえば？',
  '「て」から始まる家の中にあるものといえば？',
  '夏といえば？',
  '学校といえば？',
  '日本といえば？',
  '冬といえば？',
  '海といえば？',
  '山といえば？',
  '子どもが好きなものといえば？',
  'お祭りといえば？',
  '朝ごはんといえば？',
  '夜空といえば？',
  'スポーツといえば？',
  '外国といえば？',
  'テレビといえば？',
  'ゲームといえば？',
  '音楽といえば？',
  '映画といえば？',
  '旅行といえば？',
  '家族といえば？',
  'ストレス発散といえば？',
  '「も」から始まる乗り物といえば？',
  '「ふ」から始まる怖い場所といえば？',
  '「と」から始まる日本の食べ物といえば？',
  '「ね」から始まるかわいい動物といえば？',
  '「く」から始まる果物といえば？',
  '秋といえば？',
  '春といえば？',
  'お正月といえば？',
  'クリスマスといえば？',
  '恋愛といえば？',
  '仕事といえば？'
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
      correctAnswers: []
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
      playerId: socket.id
    });

    // 既存参加者へ通知
    socket.to(upperRoomId).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
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

    room.topic = trimmedTopic.substring(0, 100); // 最大100文字
    room.answers = new Map();
    room.revealedAnswers = [];
    room.correctAnswers = [];
    room.gameState = 'submitting';

    // 全員に回答入力画面へ
    io.to(socket.roomId).emit('topic-set', {
      topic: room.topic,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });

    console.log(`お題設定: 「${room.topic}」 ルーム ${socket.roomId}`);
  });

  // --- 回答送信 ---
  socket.on('submit-answer', ({ answer }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.gameState !== 'submitting') {
      socket.emit('error', { message: '回答受付中ではありません' });
      return;
    }

    const trimmedAnswer = (answer || '').trim();
    if (!trimmedAnswer) {
      socket.emit('error', { message: '回答を入力してください' });
      return;
    }

    // 上書き可能（送信前なら修正OK）
    room.answers.set(socket.id, trimmedAnswer.substring(0, 100));

    const submitted = room.answers.size;
    const total = room.players.length;

    // 全員に回答数を通知
    io.to(socket.roomId).emit('answer-count', { submitted, total });

    // 全員回答完了
    if (submitted >= total) {
      room.gameState = 'revealing';
      // ホストに通知
      io.to(room.hostId).emit('all-submitted');
    }

    console.log(`回答受付: ${submitted}/${total} ルーム ${socket.roomId}`);
  });

  // --- 次の回答を公開（ホストのみ） ---
  socket.on('reveal-next', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみ回答を公開できます' });
      return;
    }

    if (room.gameState !== 'revealing') {
      socket.emit('error', { message: '公開フェーズではありません' });
      return;
    }

    // まだ公開されていない回答を探す
    const allAnswers = [];
    room.players.forEach(player => {
      const answer = room.answers.get(player.id);
      if (answer !== undefined) {
        allAnswers.push({ playerName: player.name, answer, playerId: player.id });
      }
    });

    const revealedCount = room.revealedAnswers.length;
    if (revealedCount >= allAnswers.length) {
      // 全部公開済み
      return;
    }

    const next = allAnswers[revealedCount];
    room.revealedAnswers.push({ playerName: next.playerName, answer: next.answer });

    // 全員に公開
    io.to(socket.roomId).emit('answer-revealed', {
      playerName: next.playerName,
      answer: next.answer,
      revealedCount: room.revealedAnswers.length,
      total: allAnswers.length
    });
  });

  // --- 正解マーク（ホストのみ、トグル） ---
  socket.on('mark-correct', ({ answer }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみ正解を選べます' });
      return;
    }

    const idx = room.correctAnswers.indexOf(answer);
    let marked;
    if (idx === -1) {
      room.correctAnswers.push(answer);
      marked = true;
    } else {
      room.correctAnswers.splice(idx, 1);
      marked = false;
    }

    io.to(socket.roomId).emit('correct-marked', { answer, marked });
  });

  // --- ラウンド終了（ホストのみ） ---
  socket.on('end-round', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみラウンドを終了できます' });
      return;
    }

    // 正解回答をしたプレイヤーにポイント付与
    room.players.forEach(player => {
      const playerAnswer = room.answers.get(player.id);
      if (playerAnswer && room.correctAnswers.includes(playerAnswer)) {
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
      correctAnswers: room.correctAnswers,
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
      room.correctAnswers = [];
      room.topic = '';

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

  // --- 切断処理 ---
  socket.on('disconnect', () => {
    console.log(`プレイヤー切断: ${socket.id}`);
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // プレイヤーをリストから削除
    room.players = room.players.filter(p => p.id !== socket.id);

    // 回答も削除
    room.answers.delete(socket.id);

    if (room.players.length === 0) {
      // 全員いなくなったらルーム削除
      rooms.delete(roomId);
      console.log(`ルーム削除（全員退出）: ${roomId}`);
      return;
    }

    // ホストが切断した場合、次のプレイヤーをホストに昇格
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(room.hostId).emit('host-promoted', {
        message: 'あなたがホストになりました'
      });
      console.log(`ホスト昇格: ${room.players[0].name} ルーム ${roomId}`);
    }

    // 残りのプレイヤーに通知
    io.to(roomId).emit('player-left', {
      players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });

    // ゲーム中に全員回答済みになった場合の再チェック
    if (room.gameState === 'submitting' && room.players.length > 0) {
      const submitted = room.answers.size;
      const total = room.players.length;
      io.to(roomId).emit('answer-count', { submitted, total });
      if (submitted >= total) {
        room.gameState = 'revealing';
        io.to(room.hostId).emit('all-submitted');
      }
    }
  });

  // --- ランダムお題リクエスト ---
  socket.on('get-random-topic', () => {
    socket.emit('random-topic', { topic: getRandomTopic() });
  });
});

// サーバー起動
server.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
