import { BASIC_GAMES } from './games/basic.js';
import { EXPANSION_GAMES } from './games/expansion.js';

const ALL_GAMES = [...BASIC_GAMES, ...EXPANSION_GAMES];
const GAME_BY_ID = new Map(ALL_GAMES.map((game) => [game.id, game]));
const LEGACY_SESSION_KEY = 'silver-solitaire.session.v1';
const SESSION_LIBRARY_KEY = 'silver-solitaire.sessions.v2';
const LAST_GAME_KEY = 'silver-solitaire.last-game.v2';
const SESSION_SCHEMA_VERSION = 2;
const SETTINGS_KEY = 'silver-solitaire.settings.v1';

const DEFAULT_SETTINGS = {
  cardSize: 'xlarge',
  singleClick: true,
  highContrast: false,
  reduceMotion: false,
  sound: true
};

const SUIT_INFO = {
  spades: { symbol: '♠', name: '黑桃', color: 'black' },
  hearts: { symbol: '♥', name: '红桃', color: 'red' },
  diamonds: { symbol: '♦', name: '方块', color: 'red' },
  clubs: { symbol: '♣', name: '梅花', color: 'black' },
  S: { symbol: '♠', name: '黑桃', color: 'black' },
  H: { symbol: '♥', name: '红桃', color: 'red' },
  D: { symbol: '♦', name: '方块', color: 'red' },
  C: { symbol: '♣', name: '梅花', color: 'black' }
};

const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const GAME_PRESENTATION = {
  klondike: { icon: 'game-klondike', tone: 'rose', badge: '经典' },
  freecell: { icon: 'game-freecell', tone: 'sage', badge: '动脑' },
  spider: { icon: 'game-spider', tone: 'ink', badge: '推荐' },
  tripeaks: { icon: 'game-tripeaks', tone: 'sky', badge: '轻松' },
  pyramid: { icon: 'game-pyramid', tone: 'sand', badge: '算一算' },
  golf: { icon: 'game-golf', tone: 'teal', badge: '轻松' },
  yukon: { icon: 'game-yukon', tone: 'mountain', badge: '进阶' },
  scorpion: { icon: 'game-scorpion', tone: 'plum', badge: '挑战' },
  'forty-thieves': { icon: 'game-forty', tone: 'slate', badge: '挑战' },
  fortyThieves: { icon: 'game-forty', tone: 'slate', badge: '挑战' },
  bakers: { icon: 'game-bakers', tone: 'amber', badge: '策略' },
  'bakers-game': { icon: 'game-bakers', tone: 'amber', badge: '策略' },
  acesup: { icon: 'game-aces', tone: 'coral', badge: '简短' },
  'aces-up': { icon: 'game-aces', tone: 'coral', badge: '简短' },
  clock: { icon: 'game-clock', tone: 'blue', badge: '休闲' },
  'clock-solitaire': { icon: 'game-clock', tone: 'blue', badge: '休闲' }
};

const elements = {
  homeView: document.querySelector('#home-view'),
  playView: document.querySelector('#play-view'),
  basicGames: document.querySelector('#basic-games'),
  extraGames: document.querySelector('#extra-games'),
  homeButton: document.querySelector('#home-button'),
  backButton: document.querySelector('#back-button'),
  gameActions: document.querySelector('#game-actions'),
  newGameButton: document.querySelector('#new-game-button'),
  undoButton: document.querySelector('#undo-button'),
  hintButton: document.querySelector('#hint-button'),
  rulesButton: document.querySelector('#rules-button'),
  settingsButton: document.querySelector('#settings-button'),
  continueButton: document.querySelector('#continue-button'),
  continueLabel: document.querySelector('#continue-label'),
  currentGameIcon: document.querySelector('#current-game-icon'),
  gameTitle: document.querySelector('#current-game-title'),
  difficultySelect: document.querySelector('#difficulty-select'),
  moveCount: document.querySelector('#move-count'),
  messageBar: document.querySelector('#message-bar'),
  boardScroll: document.querySelector('#board-scroll'),
  board: document.querySelector('#game-board'),
  settingsDialog: document.querySelector('#settings-dialog'),
  rulesDialog: document.querySelector('#rules-dialog'),
  rulesTitle: document.querySelector('#rules-title'),
  rulesContent: document.querySelector('#rules-content'),
  winDialog: document.querySelector('#win-dialog'),
  winTitle: document.querySelector('#win-title'),
  winSummary: document.querySelector('#win-summary'),
  cardSizeInputs: [...document.querySelectorAll('input[name="card-size"]')],
  singleClickSetting: document.querySelector('#single-click-setting'),
  contrastSetting: document.querySelector('#contrast-setting'),
  motionSetting: document.querySelector('#motion-setting'),
  soundSetting: document.querySelector('#sound-setting')
};

let settings = loadSettings();
let sessionLibrary = loadSessionLibrary();
let session = loadLastSession();
let selected = null;
let activeHint = null;
let resizeFrame = null;
let audioContext = null;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadSettings() {
  const parsed = readJson(SETTINGS_KEY);
  return parsed && typeof parsed === 'object' ? { ...DEFAULT_SETTINGS, ...parsed } : { ...DEFAULT_SETTINGS };
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function loadSessionLibrary() {
  const stored = readJson(SESSION_LIBRARY_KEY);
  const library = {};
  if (stored?.schemaVersion === SESSION_SCHEMA_VERSION && stored.sessions && typeof stored.sessions === 'object') {
    for (const [gameId, candidate] of Object.entries(stored.sessions)) {
      const valid = validateSession(candidate);
      if (valid && valid.gameId === gameId) library[gameId] = valid;
    }
  }

  const legacy = validateSession(readJson(LEGACY_SESSION_KEY));
  if (legacy && !library[legacy.gameId]) library[legacy.gameId] = legacy;
  return library;
}

function loadLastSession() {
  let lastGameId = null;
  try {
    lastGameId = localStorage.getItem(LAST_GAME_KEY);
  } catch {
    lastGameId = null;
  }
  if (lastGameId && sessionLibrary[lastGameId]) return clone(sessionLibrary[lastGameId]);
  const sessions = Object.values(sessionLibrary).sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  return sessions.length ? clone(sessions[0]) : null;
}

function validateSession(candidate) {
  if (!candidate || typeof candidate !== 'object' || !GAME_BY_ID.has(candidate.gameId)) return null;
  const game = GAME_BY_ID.get(candidate.gameId);
  const difficulties = normalizeDifficulties(game);
  if (!difficulties.some((difficulty) => difficulty.id === candidate.difficulty)) return null;
  if (!validateState(game, candidate.state, candidate.difficulty)) return null;

  const history = Array.isArray(candidate.history)
    ? candidate.history
      .filter((entry) => entry && validateState(game, entry.state, candidate.difficulty))
      .slice(-12)
      .map((entry) => ({ state: entry.state, moves: Number(entry.moves) || 0 }))
    : [];
  if (candidate.state.meta && Object.hasOwn(candidate.state.meta, 'difficulty')) {
    candidate.state.meta.difficulty = candidate.difficulty;
  }
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    gameId: candidate.gameId,
    difficulty: candidate.difficulty,
    state: candidate.state,
    moves: Math.max(0, Number(candidate.moves) || 0),
    history,
    startedAt: Number(candidate.startedAt) || Date.now(),
    updatedAt: Number(candidate.updatedAt) || Date.now(),
    won: Boolean(candidate.won)
  };
}

function validateState(game, state, difficulty) {
  if (!state || typeof state !== 'object' || !state.piles || typeof state.piles !== 'object') return false;
  let initial;
  try {
    initial = game.createGame({ difficulty, seed: 1 });
  } catch {
    return false;
  }
  const expectedIds = Object.keys(initial.piles);
  if (!expectedIds.every((id) => Array.isArray(state.piles[id]) || Array.isArray(state.piles[id]?.cards))) return false;
  const cards = expectedIds.flatMap((id) => {
    const pile = state.piles[id];
    return Array.isArray(pile) ? pile : pile.cards;
  });
  const expectedCardCount = Object.values(initial.piles).reduce((count, pile) => {
    const cardsInPile = Array.isArray(pile) ? pile : pile.cards;
    return count + cardsInPile.length;
  }, 0);
  if (cards.length !== expectedCardCount) return false;
  const ids = new Set();
  for (const card of cards) {
    if (!card || typeof card.id !== 'string' || ids.has(card.id)) return false;
    if (!SUIT_INFO[card.suit] || !Number.isInteger(card.rank) || card.rank < 1 || card.rank > 13) return false;
    if (typeof card.faceUp !== 'boolean') return false;
    ids.add(card.id);
  }
  return Boolean(state.meta && typeof state.meta === 'object');
}

function saveSession() {
  if (!session) return true;
  session.schemaVersion = SESSION_SCHEMA_VERSION;
  session.updatedAt = Date.now();
  sessionLibrary[session.gameId] = clone({ ...session, history: session.history.slice(-12) });
  const savedLibrary = saveJson(SESSION_LIBRARY_KEY, {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessions: sessionLibrary
  });
  let savedLast = true;
  try {
    localStorage.setItem(LAST_GAME_KEY, session.gameId);
  } catch {
    savedLast = false;
  }
  updateContinueButton();
  if ((!savedLibrary || !savedLast) && !elements.playView.hidden) {
    setMessage('本次进度暂时无法保存，请不要直接关闭窗口。', 'notice');
  }
  return savedLibrary && savedLast;
}

function normalizeDifficulties(game) {
  const source = Array.isArray(game.difficulties) && game.difficulties.length
    ? game.difficulties
    : [{ id: 'standard', label: '标准' }];
  return source.map((entry) => typeof entry === 'string'
    ? { id: entry, label: entry }
    : { id: entry.id ?? entry.value ?? 'standard', label: entry.label ?? entry.name ?? entry.id ?? '标准' });
}

function defaultDifficulty(game) {
  const difficulties = normalizeDifficulties(game);
  const requested = typeof game.defaultDifficulty === 'object'
    ? game.defaultDifficulty.id
    : game.defaultDifficulty;
  return difficulties.some((item) => item.id === requested) ? requested : difficulties[0].id;
}

function gameName(game) {
  return game.name || game.title || game.id;
}

function presentationFor(gameId) {
  return GAME_PRESENTATION[gameId] || { icon: 'game-klondike', tone: 'sage', badge: '单人' };
}

function createGameIcon(symbolId, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  use.setAttribute('href', `#${symbolId}`);
  svg.append(use);
  return svg;
}

function renderGameTile(game) {
  const look = presentationFor(game.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `game-tile ${look.tone}`.trim();
  button.setAttribute('aria-label', `开始${gameName(game)}`);

  const icon = document.createElement('span');
  icon.className = 'game-icon';
  icon.append(createGameIcon(look.icon));

  const watermark = createGameIcon(look.icon, 'game-icon-watermark');

  const title = document.createElement('h3');
  title.textContent = gameName(game);

  const description = document.createElement('p');
  description.textContent = game.description || '经典的单人纸牌玩法。';

  const footer = document.createElement('div');
  footer.className = 'game-tile-footer';
  const badge = document.createElement('span');
  badge.className = 'difficulty-pill';
  badge.textContent = look.badge;
  const play = document.createElement('span');
  play.className = 'play-label';
  const saved = sessionLibrary[game.id];
  play.textContent = saved && !saved.won ? '继续玩 →' : '开始玩 →';
  footer.append(badge, play);
  button.append(icon, watermark, title, description, footer);
  button.addEventListener('click', () => openGame(game.id));
  return button;
}

function openGame(gameId) {
  const saved = sessionLibrary[gameId];
  if (saved && !saved.won) {
    session = clone(saved);
    selected = null;
    activeHint = null;
    saveSession();
    showPlay();
    return;
  }
  startNewGame(gameId);
}

function renderHome() {
  elements.basicGames.replaceChildren(...BASIC_GAMES.map(renderGameTile));
  elements.extraGames.replaceChildren(...EXPANSION_GAMES.map(renderGameTile));
  updateContinueButton();
}

function updateContinueButton() {
  if (!session || !GAME_BY_ID.has(session.gameId)) {
    elements.continueButton.hidden = true;
    return;
  }
  elements.continueButton.hidden = false;
  elements.continueLabel.textContent = `${gameName(GAME_BY_ID.get(session.gameId))} · 已走 ${session.moves} 步`;
}

function applySettings() {
  document.body.dataset.cardSize = settings.cardSize;
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  for (const input of elements.cardSizeInputs) input.checked = input.value === settings.cardSize;
  elements.singleClickSetting.checked = settings.singleClick;
  elements.contrastSetting.checked = settings.highContrast;
  elements.motionSetting.checked = settings.reduceMotion;
  elements.soundSetting.checked = settings.sound;
  if (!elements.playView.hidden) scheduleBoardRender();
}

function showHome() {
  selected = null;
  activeHint = null;
  elements.homeView.hidden = false;
  elements.playView.hidden = true;
  elements.gameActions.hidden = true;
  renderHome();
  updateContinueButton();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  elements.homeView.querySelector('h1')?.focus?.();
}

function showPlay() {
  if (!session) return showHome();
  const game = GAME_BY_ID.get(session.gameId);
  if (!game) return showHome();

  elements.homeView.hidden = true;
  elements.playView.hidden = false;
  elements.gameActions.hidden = false;
  elements.gameTitle.textContent = gameName(game);
  const look = presentationFor(game.id);
  elements.currentGameIcon.className = `current-game-icon ${look.tone}`;
  elements.currentGameIcon.replaceChildren(createGameIcon(look.icon));

  const difficulties = normalizeDifficulties(game);
  elements.difficultySelect.replaceChildren(...difficulties.map((difficulty) => {
    const option = document.createElement('option');
    option.value = difficulty.id;
    option.textContent = difficulty.label;
    return option;
  }));
  if (difficulties.some((item) => item.id === session.difficulty)) {
    elements.difficultySelect.value = session.difficulty;
  } else {
    session.difficulty = difficulties[0].id;
    elements.difficultySelect.value = session.difficulty;
  }

  setMessage(game.id === 'clock-solitaire' && session.state.meta?.lastCardId
    ? pileActionMessage(game)
    : initialMessage(game));
  renderBoard();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  elements.boardScroll.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  elements.gameTitle.focus();
}

function initialMessage(game) {
  const messages = {
    tripeaks: '点击比下方明牌大 1 或小 1 的牌；没有可消的牌时点击牌库。',
    pyramid: '点击两张点数合计为 13 的明牌；K 可以单独点击消除。',
    golf: '点击比废牌大 1 或小 1 的牌；没有可消的牌时点击牌库。',
    'aces-up': '同花色的顶牌中，点击较小的一张将它消除。',
    acesup: '同花色的顶牌中，点击较小的一张将它消除。',
    'clock-solitaire': '点击中央的 K 牌位开始；之后点击翻出点数对应的位置。'
  };
  return messages[game.id] || '点击一张牌，再点击要放置的位置。也可以按“提示”。';
}

function startNewGame(gameId, difficultyOverride = null, skipQuestion = false) {
  const game = GAME_BY_ID.get(gameId);
  if (!game) return;
  if (!skipQuestion && session?.gameId === gameId && session.moves > 0 && !session.won) {
    const accepted = window.confirm('要重新发一副牌吗？当前牌局会被替换。');
    if (!accepted) return;
  }
  const difficulty = difficultyOverride || defaultDifficulty(game);
  const seed = Date.now() % 2147483647;
  const state = game.createGame({ difficulty, seed });
  session = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    gameId,
    difficulty,
    state,
    moves: 0,
    history: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    won: false
  };
  selected = null;
  activeHint = null;
  saveSession();
  showPlay();
  playTone('deal');
}

function setMessage(text, kind = '') {
  elements.messageBar.textContent = text;
  elements.messageBar.className = `message-bar ${kind}`.trim();
}

function currentGame() {
  return session ? GAME_BY_ID.get(session.gameId) : null;
}

function cardArrayForPile(pileId) {
  const pile = session?.state?.piles?.[pileId];
  if (Array.isArray(pile)) return pile;
  return Array.isArray(pile?.cards) ? pile.cards : [];
}

function performAction(action, successMessage = '已移动。', sound = 'move') {
  if (!session) return false;
  const before = clone(session.state);
  let result = false;
  try {
    result = action();
  } catch (error) {
    console.error(error);
    session.state = before;
    setMessage('这一步没有完成，请换一种移动方式。', 'notice');
    return false;
  }

  if (result !== true) {
    session.state = before;
    return false;
  }

  session.history.push({ state: before, moves: session.moves });
  if (session.history.length > 50) session.history.shift();
  session.moves += 1;
  selected = null;
  activeHint = null;
  session.won = false;
  setMessage(typeof successMessage === 'function' ? successMessage() : successMessage, 'success');
  playTone(sound);
  saveSession();
  renderBoard();
  checkGameEnd();
  return true;
}

function executeMove(fromId, index, toId) {
  const game = currentGame();
  if (!game) return false;
  return performAction(
    () => game.move(session.state, fromId, index, toId),
    '很好，这一步已经放好了。'
  );
}

function executePileClick(pileId) {
  const game = currentGame();
  if (!game || typeof game.clickPile !== 'function') return false;
  return performAction(
    () => game.clickPile(session.state, pileId),
    () => pileActionMessage(game),
    'deal'
  );
}

function pileActionMessage(game) {
  if (game.id === 'clock-solitaire' && session.state.meta?.lastCardId) {
    const card = Object.values(session.state.piles)
      .flatMap((pile) => Array.isArray(pile) ? pile : pile?.cards || [])
      .find((candidate) => candidate.id === session.state.meta.lastCardId);
    if (card) {
      const destination = card.rank === 13 ? '中央 K 牌位' : `${card.rank} 点位`;
      return `翻出${cardAriaLabel(card)}，接着点击${destination}。`;
    }
  }
  return '已经翻出新的牌。';
}

function checkGameEnd() {
  const game = currentGame();
  if (!game) return;
  if (typeof game.isWon === 'function' && game.isWon(session.state)) {
    session.won = true;
    saveSession();
    playTone('win');
    elements.winTitle.textContent = `${gameName(game)}完成了！`;
    elements.winSummary.textContent = `这一局一共走了 ${session.moves} 步。`; 
    if (!elements.winDialog.open) elements.winDialog.showModal();
    return;
  }
  if (typeof game.isLost === 'function' && game.isLost(session.state)) {
    setMessage('这一局已经没有后续步骤，可以撤销或重新发牌。', 'notice');
  } else if (session.state.meta?.finished && !session.state.meta?.won) {
    setMessage('这一局结束了。可以撤销一步，或者点击“新牌局”再试一次。', 'notice');
  }
}

function handleCardClick(pileId, index) {
  const game = currentGame();
  if (!game) return;
  const descriptor = getPileDescriptors().find((pile) => pile.id === pileId);

  if (game.id === 'clock-solitaire' && descriptor?.clickable) {
    selected = null;
    executePileClick(pileId);
    return;
  }

  if (selected) {
    if (selected.pileId === pileId && selected.index === index) {
      selected = null;
      setMessage('已取消选择。');
      renderBoard();
      return;
    }
    if (selected.pileId !== pileId && executeMove(selected.pileId, selected.index, pileId)) return;
    if (game.canSelect(session.state, pileId, index)) {
      selected = { pileId, index };
      setMessage('已改选这张牌，请再点击要放置的位置。');
      renderBoard();
      return;
    }
    setMessage('这张牌不能放到那里，请换一个位置。', 'notice');
    return;
  }

  if (game.canSelect(session.state, pileId, index)) {
    if (settings.singleClick && typeof game.autoMove === 'function') {
      const automatic = game.autoMove(session.state, pileId, index);
      const targetId = typeof automatic === 'string' ? automatic : automatic?.toId;
      if (targetId && executeMove(pileId, index, targetId)) return;
    }
    selected = { pileId, index };
    setMessage('已经选中，请点击要放置的位置。');
    renderBoard();
    return;
  }

  if (descriptor?.clickable && executePileClick(pileId)) return;
  setMessage('这张牌现在还不能移动。', 'notice');
}

function handlePileClick(pileId) {
  if (selected) {
    if (selected.pileId !== pileId && executeMove(selected.pileId, selected.index, pileId)) return;
    setMessage('不能放在这个位置，请换一个牌堆。', 'notice');
    return;
  }
  if (!executePileClick(pileId)) setMessage('这个位置现在不能操作。', 'notice');
}

function undo() {
  if (!session?.history.length) {
    setMessage('还没有可以撤销的步骤。', 'notice');
    return;
  }
  const previous = session.history.pop();
  session.state = previous.state;
  session.moves = previous.moves;
  session.won = false;
  selected = null;
  activeHint = null;
  setMessage('已回到上一步。', 'success');
  playTone('undo');
  saveSession();
  renderBoard();
}

function showHint() {
  const game = currentGame();
  if (!game || typeof game.hint !== 'function') return;
  activeHint = game.hint(session.state);
  if (!activeHint) {
    setMessage('暂时没有发现可用步骤，可以撤销或重新发牌。', 'notice');
    renderBoard();
    return;
  }
  setMessage(activeHint.message || (activeHint.type === 'click' ? '试试点击发牌区。' : '黄色标记显示了一步可行的移动。'));
  playTone('hint');
  renderBoard();
}

function getPileDescriptors() {
  const game = currentGame();
  if (!game) return [];
  const raw = typeof game.getPiles === 'function' ? game.getPiles(session.state) : [];
  return raw.map((pile, index) => ({
    id: pile.id,
    label: pile.label || '',
    role: pile.role || 'tableau',
    x: Number.isFinite(Number(pile.x)) ? Number(pile.x) : index,
    y: Number.isFinite(Number(pile.y)) ? Number(pile.y) : 0,
    fan: pile.fan || 'none',
    cards: Array.isArray(pile.cards) ? pile.cards : cardArrayForPile(pile.id),
    clickable: Boolean(pile.clickable)
  }));
}

function rankText(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function cardAriaLabel(card) {
  if (!card.faceUp) return '牌背';
  const suit = SUIT_INFO[card.suit] || { name: '未知花色' };
  return `${suit.name}${rankText(card.rank)}`;
}

function slotText(role) {
  if (/foundation|home/i.test(role)) return 'A';
  if (/cell/i.test(role)) return '空';
  if (/completed|book/i.test(role)) return '✓';
  if (/stock|deck/i.test(role)) return '牌';
  if (/waste/i.test(role)) return '↻';
  return '';
}

function cardOffset(cards, index, fan, cardHeight) {
  if (index <= 0 || fan === 'none') return fan === 'none' ? index * 1.5 : 0;
  let offset = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const card = cards[cursor];
    if (fan === 'up') offset += Math.round(cardHeight * 0.24);
    else if (fan === 'down') offset += Math.round(cardHeight * (card.faceUp ? 0.25 : 0.105));
    else offset += 2;
  }
  return offset;
}

function renderCard(card, pile, index, cardWidth, cardHeight) {
  const game = currentGame();
  const button = document.createElement('button');
  const suit = SUIT_INFO[card.suit] || SUIT_INFO.spades;
  button.type = 'button';
  button.className = card.faceUp ? `playing-card ${suit.color}` : 'playing-card face-down';
  button.style.width = `${cardWidth}px`;
  button.style.height = `${cardHeight}px`;
  button.style.top = `${cardOffset(pile.cards, index, pile.fan, cardHeight)}px`;
  button.style.zIndex = String(index + 2);
  button.dataset.pileId = pile.id;
  button.dataset.cardIndex = String(index);
  button.setAttribute('aria-label', `${cardAriaLabel(card)}，${pile.label || '牌堆'}第 ${index + 1} 张`);

  let actionable = pile.clickable;
  try {
    actionable = actionable
      || Boolean(game?.canSelect?.(session.state, pile.id, index))
      || Boolean(selected && selected.pileId !== pile.id && game?.canMove?.(session.state, selected.pileId, selected.index, pile.id));
  } catch {
    actionable = false;
  }
  button.tabIndex = actionable ? 0 : -1;

  if (selected?.pileId === pile.id && index >= selected.index) {
    button.classList.add(index === selected.index ? 'selected' : 'selected-sequence');
  }
  button.setAttribute('aria-pressed', selected?.pileId === pile.id && index === selected.index ? 'true' : 'false');
  if (activeHint?.type === 'move' && activeHint.fromId === pile.id && index === activeHint.index) {
    button.classList.add('hint-source');
  }
  if (activeHint?.type === 'move' && activeHint.toId === pile.id && index === pile.cards.length - 1) {
    button.classList.add('hint-target');
  }

  if (card.faceUp) {
    const top = document.createElement('span');
    top.className = 'card-corner';
    const rank = document.createElement('span');
    rank.textContent = rankText(card.rank);
    const cornerSuit = document.createElement('span');
    cornerSuit.className = 'suit';
    cornerSuit.textContent = suit.symbol;
    top.append(rank, cornerSuit);
    const center = document.createElement('span');
    center.className = 'card-center';
    center.textContent = suit.symbol;
    const bottom = top.cloneNode(true);
    bottom.classList.add('bottom');
    button.append(top, center, bottom);
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    handleCardClick(pile.id, index);
  });
  button.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const game = currentGame();
    const automatic = game?.autoMove?.(session.state, pile.id, index);
    const targetId = typeof automatic === 'string' ? automatic : automatic?.toId;
    if (targetId) executeMove(pile.id, index, targetId);
  });
  return button;
}

function renderBoard() {
  if (elements.playView.hidden || !session) return;
  const focusedCard = elements.board.contains(document.activeElement)
    ? {
        pileId: document.activeElement.dataset?.pileId,
        cardIndex: document.activeElement.dataset?.cardIndex
      }
    : null;
  const game = currentGame();
  const piles = getPileDescriptors();
  const sizeMap = { large: 92, xlarge: 108, huge: 124 };
  const cardWidth = sizeMap[settings.cardSize] || 108;
  const isPyramidLayout = game.id === 'pyramid';
  const initialColumns = isPyramidLayout
    ? 7
    : Math.max(1, Number(game.board?.columns) || Math.ceil(Math.max(0, ...piles.map((pile) => pile.x))) + 1);
  const viewportWidth = Math.max(900, elements.boardScroll.clientWidth || 900);
  const cardHeight = Math.round(cardWidth * 1.42);
  const gap = Math.max(10, Math.round(cardWidth * 0.1));
  const padding = 28;
  const columns = initialColumns;
  const minimumWidth = padding * 2 + columns * cardWidth + Math.max(0, columns - 1) * gap;
  const boardWidth = Math.max(viewportWidth, minimumWidth);
  const stepX = columns <= 1 ? 0 : (boardWidth - padding * 2 - cardWidth) / (columns - 1);
  const maximumY = Math.max(0, ...piles.map((pile) => pile.y));
  const rowStep = maximumY > 2 ? Math.round(cardHeight * 0.5) : cardHeight + 52;
  const yScale = maximumY <= 2 && Number(game.board?.minRows) > 5 ? 0.5 : 1;

  let contentBottom = 600;
  const nodes = piles.map((pile) => {
    const node = document.createElement('div');
    node.className = 'pile';
    node.dataset.pileId = pile.id;
    node.dataset.role = pile.role;
    if (pile.clickable) node.classList.add('clickable');
    if (activeHint?.type === 'move' && activeHint.toId === pile.id) node.classList.add('hint-target');
    if (activeHint?.type === 'click' && activeHint.pileId === pile.id) node.classList.add('hint-click');
    const layoutX = isPyramidLayout ? pile.x / 2 : pile.x;
    const left = padding + layoutX * stepX;
    const top = padding + pile.y * yScale * rowStep;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.width = `${cardWidth}px`;
    node.style.height = `${cardHeight}px`;

    const label = document.createElement('span');
    label.className = 'pile-label';
    label.textContent = pile.label;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'pile-slot';
    slot.textContent = slotText(pile.role);
    slot.setAttribute('aria-label', pile.label || '空牌位');
    let slotActionable = pile.clickable;
    try {
      slotActionable = slotActionable || Boolean(selected && game.canMove(session.state, selected.pileId, selected.index, pile.id));
    } catch {
      slotActionable = false;
    }
    slot.tabIndex = pile.cards.length === 0 && slotActionable ? 0 : -1;
    slot.addEventListener('click', (event) => {
      event.stopPropagation();
      handlePileClick(pile.id);
    });
    node.append(label, slot);

    const clockRevealIndex = game.id === 'clock-solitaire' && pile.id === session.state.meta?.currentPile
      ? pile.cards.findIndex((card) => card.id === session.state.meta?.lastCardId)
      : -1;
    const visibleIndices = pile.fan === 'none' && pile.cards.length
      ? [clockRevealIndex >= 0 ? clockRevealIndex : pile.cards.length - 1]
      : pile.cards.map((_, index) => index);
    visibleIndices.forEach((index) => node.append(renderCard(pile.cards[index], pile, index, cardWidth, cardHeight)));
    if (pile.cards.length > 1 && /stock|deck/i.test(pile.role)) {
      const count = document.createElement('span');
      count.className = 'pile-count';
      count.textContent = String(pile.cards.length);
      count.setAttribute('aria-hidden', 'true');
      node.append(count);
    }
    const pileHeight = cardHeight + cardOffset(pile.cards, Math.max(0, pile.cards.length - 1), pile.fan, cardHeight);
    contentBottom = Math.max(contentBottom, top + pileHeight + padding);
    return node;
  });

  elements.board.style.width = `${boardWidth}px`;
  elements.board.style.height = `${Math.max(620, contentBottom)}px`;
  elements.board.dataset.gameId = game.id;
  elements.board.replaceChildren(...nodes);
  elements.moveCount.textContent = `${session.moves} 步`;
  elements.undoButton.disabled = session.history.length === 0;
  if (focusedCard?.pileId) {
    requestAnimationFrame(() => {
      const exact = [...elements.board.querySelectorAll('[data-pile-id][data-card-index]')]
        .find((node) => node.dataset.pileId === focusedCard.pileId && node.dataset.cardIndex === focusedCard.cardIndex);
      const fallback = [...elements.board.querySelectorAll('[data-pile-id]')]
        .find((node) => node.dataset.pileId === focusedCard.pileId && node.tabIndex === 0);
      (exact || fallback || elements.board.querySelector('[tabindex="0"]'))?.focus();
    });
  }
}

function scheduleBoardRender() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(renderBoard);
}

function showRules() {
  const game = currentGame();
  if (!game) return;
  elements.rulesTitle.textContent = `${gameName(game)}怎么玩`;
  elements.rulesContent.replaceChildren();
  if (game.description) {
    const intro = document.createElement('p');
    intro.className = 'rule-intro';
    intro.textContent = game.description;
    elements.rulesContent.append(intro);
  }
  const instructions = Array.isArray(game.instructions)
    ? game.instructions
    : String(game.instructions || '按照牌桌上允许的顺序整理所有纸牌。').split(/\n+/).filter(Boolean);
  const list = document.createElement('ol');
  for (const instruction of instructions) {
    const item = document.createElement('li');
    item.textContent = instruction;
    list.append(item);
  }
  elements.rulesContent.append(list);
  elements.rulesDialog.showModal();
}

function playTone(kind) {
  if (!settings.sound) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

    const profiles = {
      deal: { type: 'triangle', notes: [[330, 0], [294, .055], [262, .11]], duration: .09, volume: .026 },
      move: { type: 'sine', notes: [[494, 0], [587, .05]], duration: .085, volume: .032 },
      undo: { type: 'sine', notes: [[523, 0], [415, .065]], duration: .11, volume: .028 },
      hint: { type: 'triangle', notes: [[659, 0], [784, .095]], duration: .13, volume: .035 },
      ready: { type: 'sine', notes: [[587, 0], [698, .075]], duration: .12, volume: .032 },
      win: { type: 'sine', notes: [[523, 0], [659, .12], [784, .24], [1047, .38]], duration: .2, volume: .052 }
    };
    const profile = profiles[kind] || profiles.move;
    profile.notes.forEach(([frequency, offset]) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + offset;
      oscillator.frequency.value = frequency;
      oscillator.type = profile.type;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(profile.volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + profile.duration + .015);
    });
  } catch {
    // 音频不可用不影响游戏。
  }
}

elements.homeButton.addEventListener('click', showHome);
elements.backButton.addEventListener('click', showHome);
elements.continueButton.addEventListener('click', showPlay);
elements.newGameButton.addEventListener('click', () => {
  if (session) startNewGame(session.gameId, session.difficulty);
});
elements.undoButton.addEventListener('click', undo);
elements.hintButton.addEventListener('click', showHint);
elements.rulesButton.addEventListener('click', showRules);
elements.settingsButton.addEventListener('click', () => elements.settingsDialog.showModal());

elements.difficultySelect.addEventListener('change', () => {
  if (!session) return;
  const next = elements.difficultySelect.value;
  if (next === session.difficulty) return;
  const accepted = session.moves === 0 || window.confirm('更换难度需要重新发牌，继续吗？');
  if (accepted) startNewGame(session.gameId, next, true);
  else elements.difficultySelect.value = session.difficulty;
});

for (const input of elements.cardSizeInputs) {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    settings.cardSize = input.value;
    saveJson(SETTINGS_KEY, settings);
    applySettings();
  });
}

for (const [element, key] of [
  [elements.singleClickSetting, 'singleClick'],
  [elements.contrastSetting, 'highContrast'],
  [elements.motionSetting, 'reduceMotion'],
  [elements.soundSetting, 'sound']
]) {
  element.addEventListener('change', () => {
    settings[key] = element.checked;
    saveJson(SETTINGS_KEY, settings);
    applySettings();
    if (key === 'sound' && settings.sound) playTone('ready');
  });
}

elements.winDialog.addEventListener('close', () => {
  if (elements.winDialog.returnValue === 'new' && session) {
    startNewGame(session.gameId, session.difficulty, true);
  } else if (elements.winDialog.returnValue === 'home') {
    showHome();
  }
});

window.addEventListener('resize', scheduleBoardRender);
window.addEventListener('keydown', (event) => {
  if (elements.playView.hidden || elements.settingsDialog.open || elements.rulesDialog.open || elements.winDialog.open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  } else if (event.key.toLowerCase() === 'h') {
    event.preventDefault();
    showHint();
  }
});

renderHome();
applySettings();
showHome();
