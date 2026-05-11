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

// お題リスト（178問）
const TOPICS = [
  '「お」で始まる部下に慕われる上司の条件は？',
  '「せ」で始まる怖いものは？',
  '「し」で始まる名作映画は？',
  '「ふ」で始まるお金持ちが持っているものは？',
  '「あ」で始まるかわいい生き物は？',
  '「い」で始まるさらりと言えたらかっこいい言葉は？',
  '「こ」で始まる彼氏に言われてキュンとくる一言は？',
  '「ま」で始まる日本を代表するアイドルは？',
  '「す」で始まる今流行っているものは？',
  '「ね」で始まる人としてやってはいけない事は？',
  '「か」で始まる日本が世界に誇れるものは？',
  '「お」で始まる母親がよく言う一言は？',
  '「く」で始まる時代劇でよく聞く言葉は？',
  '「し」で始まるお酒に合うおつまみは？',
  '「い」で始まる唇がセクシーな芸能人は？',
  '「か」で始まる日本の名曲は？',
  '「し」で始まる学校にあるものは？',
  '「ま」で始まるＯＬが好きな甘い食べ物は？',
  '「か」で始まるお正月のイベントは？',
  '「だ」で始まるデートの後のかっこいい一言は？',
  '「い」で始まる人に言われて傷つく言葉は？',
  '「え」で始まる新婚旅行で行きたい観光スポットは？',
  '「あ」で始まる体によさそうなものは？',
  '「ひ」で始まる大人が抱えるコンプレックスは？',
  '「あ」で始まる独身女性が求める結婚相手の条件は？',
  '「こ」で始まる芸能人に必要なものは？',
  '「お」で始まる芸人にとって大事なことは？',
  '「い」で始まるお母さん役が似合う女優は？',
  '「ち」で始まる中華料理の定番メニューは？',
  '「あ」で始まる心が癒されることは？',
  '「き」で始まる女の子に言われて傷つくことは？',
  '「ふ」で始まる大人としてやってはいけないことは？',
  '「き」で始まるキスの後のかっこいい一言は？',
  '「せ」で始まる主婦の生活必需品は？',
  '「い」で始まるお酒のおつまみは？',
  '「あ」で始まるＯＬが好きなオシャレな飲み物は？',
  '「う」で始まる大人の飲み物は？',
  '「え」で始まるモテる女性の条件は？',
  '「か」で始まる女性に言われたらショックな言葉は？',
  '「さ」で始まる昭和を代表するアーティストは？',
  '「さ」で始まる日本の名作漫画は？',
  '「と」で始まる子どもが好きなキャラクターは？',
  '「う」で始まる日本が世界に誇れるものは？',
  '「あ」で始まるかわいいものは？',
  '「は」で始まる腹立たしい行為は？',
  '「ふ」で始まる女性が好きなものは？',
  '「き」で始まるテンションの上がる出来事は？',
  '「く」で始まる人にあげて喜ばれるものは？',
  '「て」で始まる日本の名作漫画は？',
  '「ま」で始まる大物ミュージシャンは？',
  '「こ」で始まる小学校にあるものは？',
  '「わ」で始まる実力派俳優は？',
  '「あ」で始まる女性が好きな食べ物は？',
  '「す」で始まるプロスポーツ選手に必要なものは？',
  '「し」で始まる相手を不快にさせる行為は？',
  '「の」で始まる人に言われたら腹立つことは？',
  '「ふ」で始まるメガネが似合う有名人は？',
  '「さ」で始まる焼いて食べると旨いものは？',
  '「い」で始まる名曲は？',
  '「か」で始まる恋人に作って欲しい料理は？',
  '「あ」で始まる人に言われると悲しい言葉は？',
  '「す」で始まる日本が世界に誇れるものは？',
  '「ま」で始まる若者に人気のある女性有名人は？',
  '「な」で始まる居酒屋の食べ物のメニューは？',
  '「ま」で始まる超一流スポーツ選手は？',
  '「き」で始まるバレると奥さんに怒られることは？',
  '「こ」で始まる冬に飲みたくなる飲み物は？',
  '「し」で始まるテレビ番組に必要なものは？',
  '「ぶ」で始まる女性の家にあるものは？',
  '「さ」で始まるキレイな熟女芸能人は？',
  '「ば」で始まるテンションがあがるものは？',
  '「か」で始まる政治家に必要なものは？',
  '「か」で始まる怖いものは？',
  '「あ」で始まる人気者は？',
  '「お」で始まる子供が喜ぶものは？',
  '「う」で始まる若い女性が好きなことは？',
  '「ち」で始まるアメリカ人が好きな食べ物は？',
  '「な」で始まるキスシーンが見たい女優は？',
  '「あ」で始まる日本の名曲といえば？',
  '「ば」で始まる今使うと恥ずかしい死語は？',
  '「な」で始まる不良がよく言うセリフは？',
  '「ま」で始まるお年寄りが大好きなものといえば？',
  '「あ」で始まる女性が憧れる女性有名人は？',
  '「う」で始まる日本人の大好きな食べ物は？',
  '「じ」で始まるハリウッドスターは？',
  '「こ」で始まるオシャレな男が持っているものは？',
  '「ゆ」で始まる怖いものは？',
  '「あ」で始まる恋人にしたい女性有名人は？',
  '「は」で始まる女性に贈ると喜ばれる物は？',
  '「か」で始まるお弁当に入っていてうれしいおかずは？',
  '「お」で始まる人として最低な行為は？',
  '「あ」で始まるデカい人といえば？',
  '「あ」で始まる小腹が空いた時食べたくなるスイーツは？',
  '「き」で始まる強い生き物は？',
  '「あ」で始まる卒業式で言いたい言葉は？',
  '「さ」で始まる人から言われて嬉しい言葉は？',
  '「し」で始まる主婦がスーパーで買うものは？',
  '「た」で始まるセクシーな男性芸能人は？',
  '「と」で始まる人としてやってはいけない事は？',
  '「あ」で始まるお洒落な人が飲むドリンクは？',
  '「と」で始まる自宅にあったらカッコイイものは？',
  '「さ」で始まる女性がカラオケで歌うと可愛く見える曲は？',
  '「き」で始まる渋い役者は？',
  '「み」で始まるアニメ界のマドンナといえば？',
  '「き」で始まる夏休みの定番行事といえば？',
  '「な」で始まるお嫁さんにしたい女性芸能人は？',
  '「ふ」で始まる滅多に食べられないご馳走は？',
  '「す」で始まるイケてる男の部屋にあるものは？',
  '「は」で始まる朝の食卓に欠かせない物は？',
  '「き」で始まる売れっ子アイドルの条件は？',
  '「あ」で始まる日本の大ヒットテレビドラマは？',
  '「か」で始まる外国人が喜ぶ日本のおみやげは？',
  '「き」で始まるヒーローの名前は？',
  '「す」で始まるコンビニでよく買うモノは？',
  '「ま」で始まるカラオケで女性に歌って欲しいアーティストは？',
  '「め」で始まる朝食に食べたいものは？',
  '「け」で始まる女子高生のカバンに入っているものは？',
  '「か」で始まる初老男性の悩みといえば？',
  '「す」で始まる夏休みに行きたくなる人気スポットは？',
  '「せ」で始まる奥様方が好きな事は？',
  '「せ」で始まる夏の風物詩は？',
  '「き」で始まるかわいいモノは？',
  '「お」で始まる昭和の大ヒットＴＶアニメは？',
  '「む」で始まるモテる男の条件は？',
  '「こ」で始まる強い生き物は？',
  '「し」で始まるかっこいい職業は？',
  '「さ」で始まるおしゃれなものは？',
  '「さ」で始まるおいしい和食は？',
  '「な」で始まるカラオケで盛り上がる曲は？',
  '「た」で始まる女性が抱かれたい芸能人は？',
  '「か」で始まる健康に良いことは？',
  '「お」で始まる昭和の伝説的テレビ番組は？',
  '「う」で始まる人としてダメなことは？',
  '「か」で始まる居酒屋の定番メニューは？',
  '「た」で始まる頭の良さそうな芸能人は？',
  '「あ」で始まる女の子が憧れる職業は？',
  '「ま」で始まる名俳優は？',
  '「お」で始まる癒されるものは？',
  '「し」で始まるお金では買えないものは？',
  '「こ」で始まるかっこいい言葉は？',
  '「し」で始まる女性に嫌われることは？',
  '「し」で始まるサラリーマンがよく使う言葉は？',
  '「お」で始まる女の子に作って欲しい料理は？',
  '「さ」で始まるオシャレな趣味は？',
  '「か」で始まる"男らしい"芸能人は？',
  '「し」で始まる学校の先生がよく言うことは？',
  '「あ」で始まる男子中高生が好きそうな女性有名人は？',
  '「い」で始まる頭が良さそうな言葉は？',
  '「あ」で始まる日本が世界に誇れるものは？',
  '「は」で始まる子供が大好きなものは？',
  '「ろ」で始まる名作映画は？',
  '「い」で始まるプレイボーイの名前は？',
  '「お」で始まる毎日することは？',
  '「ま」で始まるかっこいい街は？',
  '「だ」で始まるキスの後のかっこいい一言は？',
  '「し」で始まるお金持ちの家にあるものは？',
  '「し」で始まるご飯にのせたら美味しいものは？',
  '「き」で始まるいい女の条件は？',
  '「か」で始まる子供のころ流行った遊びは？',
  '「い」で始まる王道アイドルは？',
  '「せ」で始まる名作映画は？',
  '「ま」で始まる美味しい食べ物は？',
  '「す」で始まる女性の部屋に必ずあるものは？',
  '「す」で始まるオシャレな言葉は？',
  '「あ」で始まる懐かしい流行語は？',
  '「や」で始まる男なら持っていなければならないものは？',
  '「す」で始まるカラオケで盛り上がるアーティストは？',
  '「ち」で始まるやってはいけないことは？',
  '「こ」で始まる女性が貰って喜ぶものは？',
  '「も」で始まるセクシーな言葉は？',
  '「た」で始まるケンカが強そうな芸能人は？',
  '「う」で始まる触るとやわらかいものは？',
  '「お」で始まる格好良い芸能人は？',
  '「い」で始まる女性と部屋にいる時ムードが盛り上がる曲は？',
  '「な」で始まる清楚なイメージのある女性芸能人は？',
  '「お」で始まる男らしい言葉は？',
  '「ち」で始まるかわいいものは？',
  '「す」で始まる美味しい食べ物は？',
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
      correctAnswer: '', // 変更2: 文字列1つに変更（配列→文字列）
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

    room.topic = trimmedTopic.substring(0, 200); // base64対応のため上限を拡張
    room.answers = new Map();
    room.revealedAnswers = [];
    room.correctAnswer = ''; // 変更2: 文字列にリセット
    room.openedFlips = new Set(); // フリップ公開済みをリセット
    room.gameState = 'submitting';

    // 全員に回答入力画面へ
    io.to(socket.roomId).emit('topic-set', {
      topic: room.topic,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });

    console.log(`お題設定: 「${room.topic}」 ルーム ${socket.roomId}`);
  });

  // --- 回答送信（base64画像対応） ---
  socket.on('submit-answer', ({ answer }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

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

    // 全員に回答数を通知
    io.to(socket.roomId).emit('answer-count', { submitted, total });

    // 全員回答完了
    if (submitted >= total) {
      room.gameState = 'revealing';
      room.openedFlips = new Set(); // フリップ公開済みをリセット
      // 全員に通知（プレイヤー情報付き）
      io.to(socket.roomId).emit('all-submitted', {
        players: room.players.map(p => ({ id: p.id, name: p.name }))
      });
    }

    console.log(`回答受付: ${submitted}/${total} ルーム ${socket.roomId}`);
  });

  // --- フリップ公開（各プレイヤーが任意のタイミングで自分の回答を公開）---
  socket.on('open-flip', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.gameState !== 'revealing') return;
    if (room.openedFlips.has(socket.id)) return; // 二重公開防止

    const answer = room.answers.get(socket.id);
    const player = room.players.find(p => p.id === socket.id);
    if (!answer || !player) return;

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

  // --- 正解マーク（ホストのみ、ラジオ的トグル） ---
  socket.on('mark-correct', ({ answer }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみ正解を選べます' });
      return;
    }

    let selected;
    if (room.correctAnswer === answer) {
      // 同じ回答をクリック→選択解除（トグル）
      room.correctAnswer = '';
      selected = false;
    } else {
      // 別の回答をクリック→新しく選択
      room.correctAnswer = answer;
      selected = true;
    }

    // 変更2: selectedとanswerを送信（ラジオ動作用）
    io.to(socket.roomId).emit('correct-marked', { answer, selected });
  });

  // --- ラウンド終了（ホストのみ） ---
  socket.on('end-round', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'ホストのみラウンドを終了できます' });
      return;
    }

    // 変更2: 正解1つに一致するプレイヤーにポイント付与
    room.players.forEach(player => {
      const playerAnswer = room.answers.get(player.id);
      if (room.correctAnswer && playerAnswer === room.correctAnswer) {
        player.score += 1;
      }
    });

    const scores = room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score
    })).sort((a, b) => b.score - a.score);

    room.gameState = 'results';

    // 変更2: correctAnswerを文字列として送信
    io.to(socket.roomId).emit('round-ended', {
      scores,
      correctAnswer: room.correctAnswer,
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
      room.correctAnswer = ''; // 変更2: 文字列でリセット
      room.openedFlips = new Set(); // フリップ公開済みをリセット
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

    // 回答・フリップ公開済みも削除
    room.answers.delete(socket.id);
    if (room.openedFlips) room.openedFlips.delete(socket.id);

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
        room.openedFlips = new Set();
        io.to(roomId).emit('all-submitted', {
          players: room.players.map(p => ({ id: p.id, name: p.name }))
        });
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
