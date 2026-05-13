// 朝までそれ正解 - クライアントサイドJS
'use strict';

// ======================================
// 初期化
// ======================================
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

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

// 変更2: 現在選択されている正解（文字列、ラジオ動作）
let currentCorrectAnswers = new Set();

let undoStack = [];
let redoStack = [];

// 描画タイマー関連
let submitTimerInterval = null;
let submittingStartedAt = null;
const SUBMIT_TIMER_DURATION_MS = 300000; // 5分

// ======================================
// 描画タイマー管理
// ======================================
function startSubmitTimer(startedAt) {
  submittingStartedAt = startedAt;
  stopSubmitTimer();

  const timerEl = document.getElementById('submit-timer');
  const timerVal = document.getElementById('submit-timer-value');
  if (!timerEl || !timerVal) return;

  timerEl.style.display = 'flex';

  function tick() {
    const elapsed = Date.now() - submittingStartedAt;
    const remaining = SUBMIT_TIMER_DURATION_MS - elapsed;

    if (remaining <= 0) {
      timerVal.textContent = '時間切れ！';
      timerVal.classList.remove('timer-warning');
      timerVal.classList.add('timer-expired');
      // ボタンをグレーアウト
      const submitBtn = document.getElementById('btn-submit-answer');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
      }
      stopSubmitTimer();
      return;
    }

    const totalSec = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    timerVal.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

    if (remaining <= 30000) {
      timerVal.classList.add('timer-warning');
      timerVal.classList.remove('timer-expired');
    } else {
      timerVal.classList.remove('timer-warning', 'timer-expired');
    }
  }

  tick();
  submitTimerInterval = setInterval(tick, 500);
}

function stopSubmitTimer() {
  if (submitTimerInterval) {
    clearInterval(submitTimerInterval);
    submitTimerInterval = null;
  }
}

function resetSubmitTimer() {
  stopSubmitTimer();
  submittingStartedAt = null;
  const timerEl = document.getElementById('submit-timer');
  const timerVal = document.getElementById('submit-timer-value');
  if (timerEl) timerEl.style.display = 'none';
  if (timerVal) {
    timerVal.textContent = '5:00';
    timerVal.classList.remove('timer-warning', 'timer-expired');
  }
}

// ======================================
// 切断オーバーレイ管理
// ======================================
let reconnectOverlay = null;

function showReconnectOverlay(message) {
  if (!reconnectOverlay) {
    reconnectOverlay = document.createElement('div');
    reconnectOverlay.id = 'reconnect-overlay';
    reconnectOverlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.75)', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'z-index:9999',
      'color:#fff', 'font-size:1.2rem', 'text-align:center', 'padding:20px'
    ].join(';');
    document.body.appendChild(reconnectOverlay);
  }
  reconnectOverlay.innerHTML = `<p style="margin-bottom:12px">${message}</p>`;
  reconnectOverlay.style.display = 'flex';
}

function hideReconnectOverlay() {
  if (reconnectOverlay) {
    reconnectOverlay.style.display = 'none';
  }
}

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
// フリップ公開画面のリセット
// ======================================
function resetRevealScreen() {
  allAnswers = [];
  revealedCount = 0;
  currentCorrectAnswers = new Set();
  revealScreenInitialized = false;
  // フリップボタンを初期状態に戻す
  const flipBtn = document.getElementById('btn-open-my-flip');
  if (flipBtn) {
    flipBtn.disabled = false;
    flipBtn.textContent = 'フリップを開く！';
  }
  // グリッドをクリア
  const grid = document.getElementById('flip-grid');
  if (grid) grid.innerHTML = '';
  // 正解エリアを非表示
  const hostCorrectArea = document.getElementById('host-correct-area');
  if (hostCorrectArea) hostCorrectArea.style.display = 'none';
}

// ======================================
// 変更3: キャンバス手書き実装
// ======================================
let canvasCtx = null;     // canvasの描画コンテキスト
let isDrawing = false;    // 描画中かどうか
let penSize = 6;          // 現在のペンサイズ（デフォルト：細）
let lastX = 0;
let lastY = 0;

// キャンバスの相対座標を取得（タッチ・マウス両対応）
function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  // canvasの実際のピクセルサイズとCSSサイズの比率を考慮
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // PointerEventの場合はclientX/clientYを使用
  const clientX = e.clientX;
  const clientY = e.clientY;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// キャンバスが空（全ピクセル白）かチェック
function isCanvasEmpty(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // RGBがすべて255（白）でない、またはアルファが0でないピクセルを探す
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
      return false;
    }
  }
  return true;
}

// キャンバスを初期化（白で塗りつぶす）
function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// undo状態を保存
function saveUndoState(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  undoStack.push(imageData);
  if (undoStack.length > 30) {
    undoStack.shift();
  }
  redoStack = [];
}

// undo処理
function undoCanvas(canvas) {
  if (undoStack.length === 0) return;
  const ctx = canvas.getContext('2d');
  const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
  redoStack.push(currentState);
  const prevState = undoStack.pop();
  ctx.putImageData(prevState, 0, 0);
}

// redo処理
function redoCanvas(canvas) {
  if (redoStack.length === 0) return;
  const ctx = canvas.getContext('2d');
  const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
  undoStack.push(currentState);
  if (undoStack.length > 30) {
    undoStack.shift();
  }
  const nextState = redoStack.pop();
  ctx.putImageData(nextState, 0, 0);
}

// キャンバス初期化処理
function initCanvas() {
  const canvas = document.getElementById('answer-canvas');
  if (!canvas) return;

  canvasCtx = canvas.getContext('2d');

  // 初期状態：白で塗りつぶす
  clearCanvas(canvas);

  // 描画設定
  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';
  canvasCtx.strokeStyle = '#222222';
  canvasCtx.lineWidth = penSize;

  // ペンサイズ切り替えボタン
  document.querySelectorAll('.pen-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pen-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      penSize = parseInt(btn.dataset.size);
      canvasCtx.lineWidth = penSize;
    });
  });

  // 「取り消し」ボタン
  const undoBtn = document.getElementById('btn-undo-canvas');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      undoCanvas(canvas);
    });
  }

  // 「やり直し」ボタン
  const redoBtn = document.getElementById('btn-redo-canvas');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      redoCanvas(canvas);
    });
  }

  // 「全消去」ボタン
  const clearBtn = document.getElementById('btn-clear-canvas');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      saveUndoState(canvas);
      clearCanvas(canvas);
    });
  }

  // ===== Pointer Events（マウス・タッチ両対応）=====

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    saveUndoState(canvas);
    isDrawing = true;
    const pos = getCanvasPos(canvas, e);
    lastX = pos.x;
    lastY = pos.y;

    // 点を描画（クリックのみの場合も点を打つ）
    canvasCtx.beginPath();
    canvasCtx.arc(lastX, lastY, canvasCtx.lineWidth / 2, 0, Math.PI * 2);
    canvasCtx.fillStyle = '#222222';
    canvasCtx.fill();
  });

  canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;

    const pos = getCanvasPos(canvas, e);

    canvasCtx.beginPath();
    canvasCtx.moveTo(lastX, lastY);
    canvasCtx.lineTo(pos.x, pos.y);
    canvasCtx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  });

  canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    isDrawing = false;
  });

  canvas.addEventListener('pointerleave', (e) => {
    e.preventDefault();
    isDrawing = false;
  });

  // pointercancel（スクロールなどで描画が中断された場合）
  canvas.addEventListener('pointercancel', (e) => {
    isDrawing = false;
  });
}

// ======================================
// 変更1: お題プレビューをリアルタイム更新
// ======================================
function updateTopicPreview() {
  const charInput = document.getElementById('input-topic-char');
  const wordInput = document.getElementById('input-topic-word');
  const preview = document.getElementById('topic-preview');
  if (!charInput || !wordInput || !preview) return;

  const char = charInput.value.trim();
  const word = wordInput.value.trim();

  if (char && word) {
    preview.textContent = `プレビュー：「${char}」から始まる${word}`;
    preview.classList.add('topic-preview--active');
  } else if (char) {
    preview.textContent = `プレビュー：「${char}」から始まる...`;
    preview.classList.remove('topic-preview--active');
  } else if (word) {
    preview.textContent = `プレビュー：「？」から始まる${word}`;
    preview.classList.remove('topic-preview--active');
  } else {
    preview.textContent = `プレビュー：「？」から始まる...`;
    preview.classList.remove('topic-preview--active');
  }
}

// 変更1: お題文字列をchar（ひらがな1文字）とword（残り）に分解
function parseTopicString(topic) {
  // 「あ」から始まる食べ物といえば？ → char='あ', word='食べ物といえば？'
  // 「あ」で始まる食べ物といえば？   → char='あ', word='で始まる食べ物といえば？'
  const match = topic.match(/^「([ぁ-ん])」(?:から始まる|で始まる)(.+)$/);
  if (match) {
    return { char: match[1], word: match[2] };
  }
  return { char: '', word: topic };
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

  // 再入室ボタン
  document.getElementById('btn-rejoin-room').addEventListener('click', () => {
    const name = (document.getElementById('input-name').value || '').trim();
    const code = (document.getElementById('input-rejoin-code').value || '').trim().toUpperCase();
    if (!name) {
      showToast('名前を入力してください');
      document.getElementById('input-name').focus();
      return;
    }
    if (!code || code.length !== 6) {
      showToast('6文字のルームコードを入力してください');
      document.getElementById('input-rejoin-code').focus();
      return;
    }
    savePlayerName(name);
    socket.emit('rejoin-room', { roomId: code, playerName: name });
  });

  // Enterキーで再入室（再入室コード入力欄）
  document.getElementById('input-rejoin-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-rejoin-room').click();
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

  // ===== お題設定画面（変更1）=====

  // お題文字（ひらがな1文字）入力イベント
  document.getElementById('input-topic-char').addEventListener('input', () => {
    updateTopicPreview();
  });

  // お題ワード入力イベント
  document.getElementById('input-topic-word').addEventListener('input', () => {
    updateTopicPreview();
  });

  // ランダムお題ボタン
  document.getElementById('btn-random-topic').addEventListener('click', () => {
    socket.emit('get-random-topic');
  });

  // お題確定ボタン（変更1: バリデーション付き）
  document.getElementById('btn-set-topic').addEventListener('click', () => {
    const charInput = document.getElementById('input-topic-char');
    const wordInput = document.getElementById('input-topic-word');
    const char = (charInput.value || '').trim();
    const word = (wordInput.value || '').trim();

    // ひらがな1文字バリデーション
    if (!char) {
      showToast('ひらがな1文字を入力してください');
      charInput.focus();
      return;
    }
    if (!/^[ぁ-ん]$/.test(char)) {
      showToast('「文字」欄にはひらがな1文字を入力してください');
      charInput.focus();
      return;
    }
    if (!word) {
      showToast('お題の内容を入力してください');
      wordInput.focus();
      return;
    }

    // 「あ」から始まる食べ物といえば？ の形式で送信
    const topic = `「${char}」から始まる${word}`;
    socket.emit('set-topic', { topic });
  });

  // ===== 回答入力画面（変更3: キャンバス）=====

  // キャンバス初期化
  initCanvas();

  // フリップ！ボタン（回答送信）
  document.getElementById('btn-submit-answer').addEventListener('click', () => {
    const canvas = document.getElementById('answer-canvas');
    const btn = document.getElementById('btn-submit-answer');

    // キャンバスが空かチェック
    if (isCanvasEmpty(canvas)) {
      showToast('書いてください！');
      return;
    }

    // base64で圧縮して送信（JPEG、品質0.7）
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    socket.emit('submit-answer', { answer: imageData });

    // 送信後UI更新
    document.getElementById('answer-form').style.display = 'none';
    document.getElementById('submitted-message').style.display = 'block';
    btn.disabled = true;
  });

  // ===== 回答公開画面 =====

  // フリップを開くボタン（自分の回答を公開）
  document.getElementById('btn-open-my-flip').addEventListener('click', () => {
    const btn = document.getElementById('btn-open-my-flip');
    btn.disabled = true;
    btn.textContent = '公開済み！';
    socket.emit('open-flip');
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
    totalPlayers = 0;
    currentRoundNum = 1;
    totalRoundsNum = 5;
    resetRevealScreen();
    resetSubmitTimer();
    currentCorrectAnswers = new Set();
    undoStack = [];
    redoStack = [];
    // キャンバスをリセット
    const canvas = document.getElementById('answer-canvas');
    if (canvas) clearCanvas(canvas);
    // 回答フォームを再表示状態に戻す
    const answerForm = document.getElementById('answer-form');
    if (answerForm) answerForm.style.display = 'block';
    const submittedMsg = document.getElementById('submitted-message');
    if (submittedMsg) submittedMsg.style.display = 'none';
    const submitBtn = document.getElementById('btn-submit-answer');
    if (submitBtn) submitBtn.disabled = false;
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
socket.on('room-joined', ({ roomId, players, isHost: hostFlag, playerId, hostId }) => {
  myPlayerId = playerId;
  myRoomId = roomId;
  isHost = hostFlag;
  // サーバーから正確なホストIDを受け取る（フォールバック：先頭プレイヤー）
  hostPlayerId = hostId || (players.length > 0 ? players[0].id : null);

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
socket.on('player-joined', ({ players, hostId }) => {
  if (hostId) hostPlayerId = hostId;
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
    // 全員公開済みの場合、正解選択エリアを表示
    if (allAnswers.length > 0) {
      buildCorrectCandidates();
      document.getElementById('host-correct-area').style.display = 'block';
      document.getElementById('my-flip-controls').style.display = 'none';
    }
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

  // タイマーをリセット（ホスト・参加者問わず）
  resetSubmitTimer();

  if (isHost) {
    // ホスト：お題設定画面へ
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
    document.getElementById('topic-guest-waiting').style.display = 'none';
    // 変更1: 入力欄をクリア
    document.getElementById('input-topic-char').value = '';
    document.getElementById('input-topic-word').value = '';
    updateTopicPreview();
    showScreen('screen-topic');
  } else {
    // ゲスト：待機画面
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'none';
    document.getElementById('topic-guest-waiting').style.display = 'block';
    showScreen('screen-topic');
  }
});

// --- ランダムお題が届いた（charとtopicを直接フォームへ）---
socket.on('random-topic', ({ topic, char }) => {
  const charInput = document.getElementById('input-topic-char');
  const wordInput = document.getElementById('input-topic-word');
  if (charInput) charInput.value = char;
  if (wordInput) wordInput.value = topic;
  updateTopicPreview();
});

// --- お題確定・回答入力開始 ---
socket.on('topic-set', ({ topic, currentRound, totalRounds, submittingStartedAt: startedAt }) => {
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;

  // 変更3: キャンバスをクリアしてフォームを表示
  const canvas = document.getElementById('answer-canvas');
  if (canvas) {
    clearCanvas(canvas);
    undoStack = [];
    redoStack = [];
  }
  document.getElementById('answer-form').style.display = 'block';
  document.getElementById('submitted-message').style.display = 'none';

  // 送信ボタンを再有効化
  const submitBtn = document.getElementById('btn-submit-answer');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '';
  }

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

  // 公開画面をリセット
  resetRevealScreen();

  showScreen('screen-submitting');

  // 描画タイマー開始（showScreen後に呼び出してホスト・参加者問わず確実に表示）
  if (startedAt) {
    startSubmitTimer(startedAt);
  }
});

// --- 回答数更新 ---
socket.on('answer-count', ({ submitted, total }) => {
  document.getElementById('submitted-count').textContent = submitted;
  document.getElementById('total-count').textContent = total;
  const pct = total > 0 ? (submitted / total) * 100 : 0;
  document.getElementById('answer-progress-bar').style.width = pct + '%';
  totalPlayers = total;
});

// --- 全員回答完了（全員へ）---
socket.on('all-submitted', ({ players }) => {
  resetSubmitTimer();
  showToast('全員が回答しました！フリップを開きましょう！');
  // カードグリッドを構築
  buildFlipGrid(players);
  // フリップ公開ボタンを表示
  document.getElementById('my-flip-controls').style.display = 'block';
  document.getElementById('host-correct-area').style.display = 'none';

  // ラウンドバッジ更新
  const badge = document.getElementById('revealing-round-badge');
  if (badge) {
    badge.textContent = `第${currentRoundNum}ラウンド / 全${totalRoundsNum}ラウンド`;
  }

  showScreen('screen-revealing');
});

// --- フリップ公開イベント ---
socket.on('flip-opened', ({ playerId, playerName, answer, openedCount, total }) => {
  // 該当カードをフリップ
  const card = document.getElementById('card-' + playerId);
  if (card) {
    // カードの裏面に回答をセット
    const back = card.querySelector('.flip-card-back');
    if (answer && answer.startsWith('data:image/')) {
      back.innerHTML = `<img src="${answer}" class="answer-image" alt="回答">`;
    } else {
      back.innerHTML = `<span class="answer-text">${escapeHTML(answer)}</span>`;
    }
    // フリップアニメーション
    setTimeout(() => {
      card.querySelector('.flip-card-inner').classList.add('flipped');
    }, 50);
  }

  // allAnswers に追加（正解選択用）
  allAnswers.push({ playerId, playerName, answer, isCorrect: false });

  // 全員公開済みかチェック
  if (openedCount >= total) {
    // フリップボタンを非表示
    document.getElementById('my-flip-controls').style.display = 'none';
    // ホストに正解選択エリアを表示
    if (isHost) {
      buildCorrectCandidates();
      document.getElementById('host-correct-area').style.display = 'block';
    }
  }
});

// フリップグリッドを構築
function buildFlipGrid(players) {
  const grid = document.getElementById('flip-grid');
  if (!grid) return;
  grid.innerHTML = '';
  allAnswers = []; // 回答リストをリセット

  players.forEach(player => {
    const card = document.createElement('div');
    card.className = 'flip-card' + (player.id === myPlayerId ? ' is-me' : '');
    card.id = 'card-' + player.id;
    card.dataset.playerId = player.id;
    card.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <span class="card-player-name">${escapeHTML(player.name)}</span>
          <span class="card-status">準備中...</span>
        </div>
        <div class="flip-card-back"></div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// 正解候補ボタンを構築（ホスト用）
function buildCorrectCandidates() {
  const container = document.getElementById('correct-candidates');
  if (!container) return;
  container.innerHTML = '';

  allAnswers.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'correct-candidate-btn';
    btn.dataset.answer = item.answer;

    if (item.answer && item.answer.startsWith('data:image/')) {
      const img = document.createElement('img');
      img.src = item.answer;
      img.alt = escapeHTML(item.playerName) + 'の回答';
      img.style.maxWidth = '80px';
      img.style.maxHeight = '60px';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      img.style.margin = '0 auto 4px';
      btn.appendChild(img);
      const nameSpan = document.createElement('span');
      nameSpan.style.display = 'block';
      nameSpan.style.fontSize = '0.75rem';
      nameSpan.textContent = item.playerName;
      btn.appendChild(nameSpan);
    } else {
      btn.textContent = item.playerName + ': ' + item.answer;
    }

    btn.addEventListener('click', () => {
      socket.emit('mark-correct', { answer: item.answer });
    });

    container.appendChild(btn);
  });
}

// --- 正解マーク更新（複数選択） ---
socket.on('correct-marked', ({ answer, selected, selectedAnswers }) => {
  currentCorrectAnswers = new Set(selectedAnswers || []);

  const candidateBtns = document.querySelectorAll('.correct-candidate-btn');
  candidateBtns.forEach(btn => {
    if (currentCorrectAnswers.has(btn.dataset.answer)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.flip-card').forEach(card => {
    card.classList.remove('correct-flip');
  });
  allAnswers.forEach(a => {
    a.isCorrect = currentCorrectAnswers.has(a.answer);
    if (a.isCorrect) {
      const card = document.getElementById('card-' + a.playerId);
      if (card) card.classList.add('correct-flip');
    }
  });
});

// --- ラウンド終了（correctAnswers配列対応）---
socket.on('round-ended', ({ scores, correctAnswers, currentRound, totalRounds }) => {
  const correctDisplay = document.getElementById('correct-answers-display');
  correctDisplay.innerHTML = '';

  if (!correctAnswers || correctAnswers.length === 0) {
    const p = document.createElement('p');
    p.textContent = '今回は正解なし';
    p.style.color = 'var(--color-gray)';
    p.style.textAlign = 'center';
    correctDisplay.appendChild(p);
  } else {
    correctAnswers.forEach(correctAnswer => {
      const isImage = typeof correctAnswer === 'string' && correctAnswer.startsWith('data:image/');
      const badge = document.createElement('div');
      badge.className = 'correct-answer-badge';
      if (isImage) {
        const img = document.createElement('img');
        img.src = correctAnswer;
        img.alt = '正解の回答';
        img.className = 'answer-image';
        badge.appendChild(img);
      } else {
        badge.textContent = correctAnswer;
      }
      correctDisplay.appendChild(badge);
    });
  }

  renderScoreList(scores, 'round-score-list');

  document.getElementById('result-round-badge').textContent = `第${currentRound}ラウンド 結果`;

  if (isHost) {
    document.getElementById('result-host-controls').style.display = 'block';
    document.getElementById('result-guest-waiting').style.display = 'none';
  } else {
    document.getElementById('result-host-controls').style.display = 'none';
    document.getElementById('result-guest-waiting').style.display = 'block';
  }

  resetRevealScreen();

  showScreen('screen-round-result');
});

// --- 次のラウンド開始 ---
socket.on('next-round-started', ({ currentRound, totalRounds, isHost: hostFlag }) => {
  isHost = hostFlag !== undefined ? hostFlag : isHost;
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;

  // タイマーリセット
  resetSubmitTimer();

  // 公開画面をリセット
  resetRevealScreen();
  currentCorrectAnswers = new Set();

  if (isHost) {
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
    document.getElementById('topic-guest-waiting').style.display = 'none';
    // 変更1: 入力欄をクリア
    document.getElementById('input-topic-char').value = '';
    document.getElementById('input-topic-word').value = '';
    updateTopicPreview();
    showScreen('screen-topic');
  } else {
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('screen-topic').querySelector('.form-area').style.display = 'none';
    document.getElementById('topic-guest-waiting').style.display = 'block';
    showScreen('screen-topic');
  }

  // 変更3: キャンバスをリセット＆送信ボタンを再有効化
  const canvas = document.getElementById('answer-canvas');
  if (canvas) {
    clearCanvas(canvas);
    undoStack = [];
    redoStack = [];
  }
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

// --- 再入室成功 ---
socket.on('rejoin-success', ({ roomId, playerId, hostId, isHost: hostFlag, gameState, currentRound, totalRounds, topic, players, hasSubmitted, submittedCount, totalCount, submittingStartedAt: startedAt }) => {
  hideReconnectOverlay();
  isRejoinPending = false;
  myPlayerId = playerId;
  myRoomId = roomId;
  hostPlayerId = hostId;
  isHost = hostFlag;
  currentRoundNum = currentRound;
  totalRoundsNum = totalRounds;
  totalPlayers = players.length;

  setHashRoomCode(roomId);
  showToast('再入室しました！', 3000);

  if (gameState === 'waiting') {
    // ロビー画面へ
    document.getElementById('display-room-code').textContent = roomId;
    renderLobbyPlayers(players);
    if (isHost) {
      document.getElementById('host-controls').style.display = 'block';
      document.getElementById('guest-waiting').style.display = 'none';
    } else {
      document.getElementById('host-controls').style.display = 'none';
      document.getElementById('guest-waiting').style.display = 'block';
    }
    showScreen('screen-lobby');

  } else if (gameState === 'topic-setting') {
    // お題設定画面へ
    document.getElementById('topic-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    if (isHost) {
      document.getElementById('screen-topic').querySelector('.form-area').style.display = 'flex';
      document.getElementById('topic-guest-waiting').style.display = 'none';
      document.getElementById('input-topic-char').value = '';
      document.getElementById('input-topic-word').value = '';
      updateTopicPreview();
    } else {
      document.getElementById('screen-topic').querySelector('.form-area').style.display = 'none';
      document.getElementById('topic-guest-waiting').style.display = 'block';
    }
    showScreen('screen-topic');

  } else if (gameState === 'submitting') {
    // 回答入力画面へ
    const canvas = document.getElementById('answer-canvas');
    if (canvas) {
      clearCanvas(canvas);
      undoStack = [];
      redoStack = [];
    }

    document.getElementById('submitting-round-badge').textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;
    document.getElementById('submitting-topic').textContent = topic;

    const revealingTopic = document.getElementById('revealing-topic');
    if (revealingTopic) revealingTopic.textContent = topic;

    document.getElementById('submitted-count').textContent = submittedCount;
    document.getElementById('total-count').textContent = totalCount;
    const pct = totalCount > 0 ? (submittedCount / totalCount) * 100 : 0;
    document.getElementById('answer-progress-bar').style.width = pct + '%';

    resetRevealScreen();

    // 描画タイマーを残り時間から再開
    if (startedAt) {
      startSubmitTimer(startedAt);
    }

    if (hasSubmitted) {
      // すでに回答済み
      document.getElementById('answer-form').style.display = 'none';
      document.getElementById('submitted-message').style.display = 'block';
      const submitBtn = document.getElementById('btn-submit-answer');
      if (submitBtn) submitBtn.disabled = true;
    } else {
      document.getElementById('answer-form').style.display = 'block';
      document.getElementById('submitted-message').style.display = 'none';
      const submitBtn = document.getElementById('btn-submit-answer');
      if (submitBtn) submitBtn.disabled = false;
    }
    showScreen('screen-submitting');

  } else if (gameState === 'revealing') {
    // 回答公開画面へ（回答公開中に再入室）
    document.getElementById('submitting-topic').textContent = topic;
    const revealingTopic = document.getElementById('revealing-topic');
    if (revealingTopic) revealingTopic.textContent = topic;

    const badge = document.getElementById('revealing-round-badge');
    if (badge) badge.textContent = `第${currentRound}ラウンド / 全${totalRounds}ラウンド`;

    resetRevealScreen();
    buildFlipGrid(players);

    // hasSubmitted=false は自動公開済み（disconnect時にauto-open済み）
    if (hasSubmitted) {
      document.getElementById('my-flip-controls').style.display = 'block';
      showToast('回答公開中です。フリップを開いてください。', 4000);
    } else {
      document.getElementById('my-flip-controls').style.display = 'none';
      showToast('回答公開中です。', 3000);
    }
    document.getElementById('host-correct-area').style.display = 'none';

    showScreen('screen-revealing');

  } else if (gameState === 'results') {
    // ラウンド結果画面へ（結果表示中に再入室）
    const scores = players.map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
    renderScoreList(scores, 'round-score-list');
    document.getElementById('result-round-badge').textContent = `第${currentRound}ラウンド 結果`;

    // 正解は再入室時に再表示できないため空表示
    const correctDisplay = document.getElementById('correct-answers-display');
    if (correctDisplay) correctDisplay.innerHTML = '<p style="color:var(--color-gray);text-align:center;">再入室のため正解は表示できません</p>';

    if (isHost) {
      document.getElementById('result-host-controls').style.display = 'block';
      document.getElementById('result-guest-waiting').style.display = 'none';
    } else {
      document.getElementById('result-host-controls').style.display = 'none';
      document.getElementById('result-guest-waiting').style.display = 'block';
    }
    showScreen('screen-round-result');

  } else {
    // その他の状態はロビーへ
    document.getElementById('display-room-code').textContent = roomId;
    renderLobbyPlayers(players);
    document.getElementById('host-controls').style.display = 'none';
    document.getElementById('guest-waiting').style.display = 'block';
    showScreen('screen-lobby');
  }
});

// --- 再入室エラー ---
socket.on('rejoin-error', ({ message }) => {
  isRejoinPending = false;
  // 自動再接続由来の場合はオーバーレイにエラーを表示
  if (reconnectOverlay && reconnectOverlay.style.display !== 'none') {
    showReconnectOverlay(
      `再入室できませんでした<br><small>${escapeHTML(message)}</small><br>` +
      '<button onclick="hideReconnectOverlay();myRoomId=null;showScreen(\'screen-home\')" ' +
      'style="margin-top:12px;padding:10px 20px;font-size:1rem;cursor:pointer">ホームに戻る</button>'
    );
  } else {
    showToast('再入室エラー：' + message, 4000);
  }
});

// --- 他のプレイヤーが再入室 ---
socket.on('player-rejoined', ({ playerName, players, hostId }) => {
  if (hostId) hostPlayerId = hostId;
  totalPlayers = players.length;
  // ロビー画面にいる場合はプレイヤーリストを更新
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen && activeScreen.id === 'screen-lobby') {
    renderLobbyPlayers(players);
  }
  showToast(`${escapeHTML(playerName)} さんが再入室しました`, 3000);
});

// --- エラー ---
socket.on('error', ({ message }) => {
  showToast('エラー：' + message, 3000);
});

// --- 接続断 ---
socket.on('disconnect', (reason) => {
  console.log('切断理由:', reason);
  // ゲーム中の場合は再接続オーバーレイを表示
  if (myRoomId) {
    showReconnectOverlay('再接続中...<br><small>しばらくお待ちください</small>');
  } else {
    showToast('サーバーとの接続が切れました。再接続しています...', 4000);
  }
});

// --- 再接続試行中 ---
socket.on('reconnect_attempt', (attemptNumber) => {
  if (myRoomId) {
    showReconnectOverlay(`再接続中... (試行 ${attemptNumber})<br><small>しばらくお待ちください</small>`);
  }
});

// --- 再接続失敗（無制限のため通常は発火しないが念のため）---
socket.on('reconnect_failed', () => {
  if (myRoomId) {
    showReconnectOverlay(
      'サーバーから切断されました<br>' +
      `<small>ルームID: ${myRoomId}</small><br>` +
      '<button onclick="manualRejoin()" style="margin-top:12px;padding:10px 20px;font-size:1rem;cursor:pointer">再入室する</button>'
    );
  }
});

// 再接続時の二重 rejoin 送信防止フラグ
let isRejoinPending = false;

// --- 再接続成功 ---
socket.on('reconnect', (attemptNumber) => {
  console.log(`再接続成功 (試行 ${attemptNumber}回目)`);
  hideReconnectOverlay();
  if (myRoomId && !isRejoinPending) {
    // 自動的に再入室を試みる
    const savedName = loadPlayerName();
    if (savedName) {
      isRejoinPending = true;
      showToast('再接続しました。ゲームに復帰しています...', 3000);
      socket.emit('rejoin-room', { roomId: myRoomId, playerName: savedName });
    }
  }
});

// --- 接続（初回）---
// ※ Socket.io v4 では再接続時は reconnect イベントが先に発火するため
//    connect は初回接続のみ自動再入室処理を行う必要がない
//    ただし reconnect イベントが発火しないケース（transport入替時など）のフォールバックとして残す
socket.on('connect', () => {
  hideReconnectOverlay();
});

// --- 他のプレイヤーが切断（一時的） ---
socket.on('player-disconnected', ({ playerName, players }) => {
  totalPlayers = players.filter(p => !p.disconnected).length;
  showToast(`${escapeHTML(playerName)} さんが一時的に切断しました`, 3000);
  // ロビーにいる場合はプレイヤーリストを更新
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen && activeScreen.id === 'screen-lobby') {
    renderLobbyPlayers(players.filter(p => !p.disconnected));
  }
});

// 手動再入室（再接続失敗時のボタン用）
function manualRejoin() {
  const savedName = loadPlayerName();
  if (!savedName || !myRoomId) {
    hideReconnectOverlay();
    myRoomId = null;
    myPlayerId = null;
    showScreen('screen-home');
    return;
  }
  socket.emit('rejoin-room', { roomId: myRoomId, playerName: savedName });
}
