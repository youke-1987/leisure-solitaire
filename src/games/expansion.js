import {
  SUITS,
  createDeck,
  seededRandom,
  shuffle,
  isRed
} from '../core.js';

const TABLEAU_7 = Array.from({ length: 7 }, (_, index) => `t${index}`);
const TABLEAU_10 = Array.from({ length: 10 }, (_, index) => `t${index}`);
const FOUNDATION_BY_SUIT = SUITS.map((suit) => `f-${suit}`);
const SUIT_NAMES = {
  spades: '黑桃',
  hearts: '红桃',
  diamonds: '方块',
  clubs: '梅花'
};

const difficulty = (id, label) => ({ id, label, name: label });
const shuffledDeck = (count, seed) =>
  shuffle(createDeck(count), seededRandom(seed ?? Date.now()));
const faceUp = (card) => ({ ...card, faceUp: true });
const faceDown = (card) => ({ ...card, faceUp: false });
const top = (cards) => cards?.[cards.length - 1] ?? null;
const isTableau = (id, tableaus) => tableaus.includes(id);
const isFoundation = (id) => id.startsWith('f-');
const incrementMoves = (state) => {
  state.meta ??= {};
  state.meta.moves = (state.meta.moves ?? 0) + 1;
};
const rememberMove = (state, fromId, index, toId) => {
  state.meta ??= {};
  const source = state.piles[fromId];
  const move = {
    fromId,
    toId,
    cardId: source[index]?.id ?? null,
    count: source.length - index
  };
  state.meta.lastMove = move;
  state.meta.recentMoves = [...(state.meta.recentMoves ?? []), move].slice(-64);
};
const clearRememberedMove = (state) => {
  state.meta ??= {};
  state.meta.lastMove = null;
};
const immediatelyReversesLastMove = (state, fromId, index, toId) => {
  const source = state.piles[fromId];
  const recent = state.meta?.recentMoves ?? (state.meta?.lastMove ? [state.meta.lastMove] : []);
  // Hints should not shuttle the same packet back over an edge used moments
  // ago. Manual moves remain legal, so the player can deliberately backtrack.
  return recent.some((move) => move.fromId === toId
    && move.toId === fromId
    && move.cardId === source[index]?.id);
};
const revealTop = (cards) => {
  const card = top(cards);
  if (card && !card.faceUp) card.faceUp = true;
};
const moveHint = (fromId, index, toId, message) => ({
  type: 'move',
  fromId,
  index,
  toId,
  message
});
const clickHint = (pileId, message) => ({ type: 'click', pileId, message });
const standardBoard = (columns, minRows = 2) => ({ columns, minRows });
const pileView = (state, id, label, role, x, y, fan = 'none', clickable = false) => ({
  id,
  label,
  role,
  x,
  y,
  fan,
  cards: state.piles[id],
  ...(clickable ? { clickable: true } : {})
});
const validStatePile = (state, id) => Array.isArray(state?.piles?.[id]);
const totalStateCards = (state) => Object.values(state?.piles ?? {})
  .reduce((sum, pile) => sum + (Array.isArray(pile) ? pile.length : 0), 0);
const relocatesWholeTableauToEmpty = (state, fromId, index, toId, tableaus) =>
  tableaus.includes(fromId)
  && tableaus.includes(toId)
  && index === 0
  && state.piles[toId].length === 0;
const sameSuitDescending = (cards, start = 0) => {
  for (let index = start; index < cards.length; index += 1) {
    if (!cards[index].faceUp) return false;
    if (index > start) {
      const previous = cards[index - 1];
      const card = cards[index];
      if (previous.suit !== card.suit || previous.rank !== card.rank + 1) return false;
    }
  }
  return true;
};
const alternatingDescending = (moving, target) =>
  moving.rank === target.rank - 1 && isRed(moving) !== isRed(target);
const suitDescending = (moving, target) =>
  moving.suit === target.suit && moving.rank === target.rank - 1;

function canPlaceOnSuitFoundation(state, card, foundationId) {
  if (!card || foundationId !== `f-${card.suit}` || !validStatePile(state, foundationId)) return false;
  const foundationTop = top(state.piles[foundationId]);
  return foundationTop
    ? foundationTop.suit === card.suit && card.rank === foundationTop.rank + 1
    : card.rank === 1;
}

function firstSuitFoundation(state, card) {
  const id = card ? `f-${card.suit}` : null;
  return id && canPlaceOnSuitFoundation(state, card, id) ? id : null;
}

// ---------------------------------------------------------------------------
// Golf / 高尔夫纸牌

const GOLF_TABLEAUS = TABLEAU_7;

function golfAdjacent(first, second, wrap) {
  if (!first || !second) return false;
  if (Math.abs(first.rank - second.rank) === 1) return true;
  return Boolean(wrap && ((first.rank === 1 && second.rank === 13) || (first.rank === 13 && second.rank === 1)));
}

const Golf = {
  id: 'golf',
  name: '高尔夫纸牌',
  description: '取下比废牌大一点或小一点的明牌，清空七列牌即获胜。',
  instructions: ['只能取每列最下方的牌。', '无牌可取时点击牌堆翻开一张新废牌。'],
  difficulties: [difficulty('classic', '经典'), difficulty('relaxed', '轻松（A 与 K 相连）')],
  defaultDifficulty: 'relaxed',
  board: standardBoard(7, 3),

  createGame({ difficulty: selected = 'relaxed', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries(GOLF_TABLEAUS.map((id) => [id, []]));
    for (let row = 0; row < 5; row += 1) {
      for (const id of GOLF_TABLEAUS) piles[id].push(faceUp(deck.pop()));
    }
    piles.stock = deck.map(faceDown);
    piles.waste = [faceUp(piles.stock.pop())];
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      ...GOLF_TABLEAUS.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 0, 'down')),
      pileView(state, 'stock', '牌堆', 'stock', 2, 2, 'none', state.piles.stock.length > 0),
      pileView(state, 'waste', '废牌', 'waste', 4, 2)
    ];
  },

  canSelect(state, pileId, index) {
    return validStatePile(state, pileId)
      && isTableau(pileId, GOLF_TABLEAUS)
      && index === state.piles[pileId].length - 1
      && Boolean(state.piles[pileId][index]?.faceUp);
  },

  canMove(state, fromId, index, toId) {
    if (toId !== 'waste' || !this.canSelect(state, fromId, index)) return false;
    const card = state.piles[fromId][index];
    return golfAdjacent(card, top(state.piles.waste), state.meta.difficulty === 'relaxed');
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    state.piles.waste.push(state.piles[fromId].pop());
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== 'stock' || state.piles.stock.length === 0) return false;
    clearRememberedMove(state);
    state.piles.waste.push(faceUp(state.piles.stock.pop()));
    incrementMoves(state);
    return true;
  },

  autoMove(state, fromId, index) {
    return this.canMove(state, fromId, index, 'waste') ? { toId: 'waste' } : null;
  },

  hint(state) {
    for (const id of GOLF_TABLEAUS) {
      const index = state.piles[id].length - 1;
      if (this.canMove(state, id, index, 'waste')) {
        return moveHint(id, index, 'waste', '这张牌可以放到废牌上。');
      }
    }
    return state.piles.stock.length
      ? clickHint('stock', '暂时无牌可取，请翻开一张新牌。')
      : null;
  },

  isWon(state) {
    return totalStateCards(state) === 52
      && GOLF_TABLEAUS.every((id) => validStatePile(state, id) && state.piles[id].length === 0);
  },

  isLost(state) {
    if (this.isWon(state) || state.piles.stock.length > 0) return false;
    return GOLF_TABLEAUS.every((id) => {
      const index = state.piles[id].length - 1;
      return !this.canMove(state, id, index, 'waste');
    });
  }
};

// ---------------------------------------------------------------------------
// Yukon / 育空接龙

const Yukon = {
  id: 'yukon',
  name: '育空接龙',
  description: '无牌堆的开放式接龙，可把任意明牌连同其下方的牌一起移动。',
  instructions: ['牌列按红黑交替、点数递减堆放。', '空列只能放 K；四个收牌区按花色从 A 收到 K。'],
  difficulties: [difficulty('classic', '经典')],
  defaultDifficulty: 'classic',
  board: standardBoard(7, 3),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries([...TABLEAU_7, ...FOUNDATION_BY_SUIT].map((id) => [id, []]));
    piles.t0.push(faceUp(deck.pop()));
    for (let column = 1; column < 7; column += 1) {
      for (let hidden = 0; hidden < column; hidden += 1) piles[`t${column}`].push(faceDown(deck.pop()));
      for (let visible = 0; visible < 5; visible += 1) piles[`t${column}`].push(faceUp(deck.pop()));
    }
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      ...FOUNDATION_BY_SUIT.map((id, x) => pileView(state, id, `${SUIT_NAMES[id.slice(2)]}收牌`, 'foundation', x + 3, 0)),
      ...TABLEAU_7.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 1, 'down'))
    ];
  },

  canSelect(state, pileId, index) {
    if (!validStatePile(state, pileId) || index < 0 || index >= state.piles[pileId].length) return false;
    const card = state.piles[pileId][index];
    if (isTableau(pileId, TABLEAU_7)) {
      return Boolean(card.faceUp) && state.piles[pileId].slice(index).every((item) => item.faceUp);
    }
    return FOUNDATION_BY_SUIT.includes(pileId) && index === state.piles[pileId].length - 1;
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !this.canSelect(state, fromId, index) || !validStatePile(state, toId)) return false;
    const source = state.piles[fromId];
    const moving = source[index];
    const count = source.length - index;
    if (isTableau(toId, TABLEAU_7)) {
      if (isFoundation(fromId) && count !== 1) return false;
      const target = top(state.piles[toId]);
      return target ? alternatingDescending(moving, target) : moving.rank === 13;
    }
    return count === 1 && canPlaceOnSuitFoundation(state, moving, toId);
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    const moved = state.piles[fromId].splice(index);
    state.piles[toId].push(...moved);
    if (isTableau(fromId, TABLEAU_7)) revealTop(state.piles[fromId]);
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (!validStatePile(state, pileId) || state.piles[pileId].length === 0) return false;
    const index = state.piles[pileId].length - 1;
    const automatic = this.autoMove(state, pileId, index);
    return automatic ? this.move(state, pileId, index, automatic.toId) : false;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index) || index !== state.piles[fromId].length - 1) return null;
    const toId = firstSuitFoundation(state, state.piles[fromId][index]);
    return toId
      && this.canMove(state, fromId, index, toId)
      && !immediatelyReversesLastMove(state, fromId, index, toId)
      ? { toId }
      : null;
  },

  hint(state) {
    for (const fromId of TABLEAU_7) {
      const index = state.piles[fromId].length - 1;
      const automatic = this.autoMove(state, fromId, index);
      if (automatic) return moveHint(fromId, index, automatic.toId, '可以把这张牌收到上方。');
    }
    const sources = [...TABLEAU_7, ...FOUNDATION_BY_SUIT];
    for (const fromId of sources) {
      for (let index = 0; index < state.piles[fromId].length; index += 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        for (const toId of TABLEAU_7) {
          if (this.canMove(state, fromId, index, toId)
            && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_7)
            && !immediatelyReversesLastMove(state, fromId, index, toId)) {
            return moveHint(fromId, index, toId, '这组明牌可以移到另一列。');
          }
        }
      }
    }
    return null;
  },

  isWon(state) {
    return FOUNDATION_BY_SUIT.every((id) => validStatePile(state, id) && state.piles[id].length === 13)
      && TABLEAU_7.every((id) => validStatePile(state, id) && state.piles[id].length === 0);
  },

  isLost(state) {
    if (this.isWon(state)) return false;
    const sources = [...TABLEAU_7, ...FOUNDATION_BY_SUIT];
    return !sources.some((fromId) => state.piles[fromId].some((_, index) =>
      TABLEAU_7.some((toId) => this.canMove(state, fromId, index, toId)
        && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_7)
        && !immediatelyReversesLastMove(state, fromId, index, toId))
      || FOUNDATION_BY_SUIT.some((toId) => this.canMove(state, fromId, index, toId)
        && !immediatelyReversesLastMove(state, fromId, index, toId))));
  }
};

// ---------------------------------------------------------------------------
// Scorpion / 蝎子纸牌

const SCORPION_COMPLETED = Array.from({ length: 4 }, (_, index) => `completed${index}`);

function collectScorpionRuns(state) {
  let collected = false;
  let found = true;
  while (found) {
    found = false;
    for (const id of TABLEAU_7) {
      const cards = state.piles[id];
      if (cards.length < 13) continue;
      const start = cards.length - 13;
      const run = cards.slice(start);
      if (run[0].rank !== 13 || run[12].rank !== 1 || !sameSuitDescending(run)) continue;
      const target = SCORPION_COMPLETED.find((completedId) => state.piles[completedId].length === 0);
      if (!target) return collected;
      state.piles[target].push(...cards.splice(start));
      revealTop(cards);
      collected = true;
      found = true;
    }
  }
  return collected;
}

const Scorpion = {
  id: 'scorpion',
  name: '蝎子纸牌',
  description: '把每种花色整理成从 K 到 A 的完整牌列。',
  instructions: ['任意明牌都可连同它下方的所有牌一起移动，只检查被抓起的第一张。', '只能放到同花色且大 1 点的牌上；空列只收 K。剩余三张牌发到前三列。'],
  difficulties: [difficulty('classic', '经典')],
  defaultDifficulty: 'classic',
  board: standardBoard(7, 3),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries([...TABLEAU_7, ...SCORPION_COMPLETED].map((id) => [id, []]));
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const visible = !(column < 4 && row < 3);
        piles[`t${column}`].push(visible ? faceUp(deck.pop()) : faceDown(deck.pop()));
      }
    }
    piles.stock = deck.map(faceDown);
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      pileView(state, 'stock', '三张牌', 'stock', 0, 0, 'none', state.piles.stock.length > 0),
      ...SCORPION_COMPLETED.map((id, x) => pileView(state, id, `完成 ${x + 1}`, 'completed', x + 3, 0)),
      ...TABLEAU_7.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 1, 'down'))
    ];
  },

  canSelect(state, pileId, index) {
    if (!validStatePile(state, pileId)
      || !isTableau(pileId, TABLEAU_7)
      || index < 0
      || index >= state.piles[pileId].length) return false;
    // Like Yukon, Scorpion carries every card above the chosen face-up card;
    // that carried tail does not itself need to be ordered.
    return state.piles[pileId][index].faceUp
      && state.piles[pileId].slice(index).every((card) => card.faceUp);
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId
      || !validStatePile(state, toId)
      || !isTableau(toId, TABLEAU_7)
      || !this.canSelect(state, fromId, index)) return false;
    const moving = state.piles[fromId][index];
    const target = top(state.piles[toId]);
    return target ? suitDescending(moving, target) : moving.rank === 13;
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    state.piles[toId].push(...state.piles[fromId].splice(index));
    revealTop(state.piles[fromId]);
    collectScorpionRuns(state);
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== 'stock' || state.piles.stock.length === 0) return false;
    clearRememberedMove(state);
    for (let column = 0; column < 3 && state.piles.stock.length; column += 1) {
      state.piles[`t${column}`].push(faceUp(state.piles.stock.pop()));
    }
    collectScorpionRuns(state);
    incrementMoves(state);
    return true;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    for (const toId of TABLEAU_7) {
      if (this.canMove(state, fromId, index, toId)
        && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_7)
        && !immediatelyReversesLastMove(state, fromId, index, toId)) return { toId };
    }
    return null;
  },

  hint(state) {
    for (const fromId of TABLEAU_7) {
      for (let index = 0; index < state.piles[fromId].length; index += 1) {
        const automatic = this.autoMove(state, fromId, index);
        if (automatic) return moveHint(fromId, index, automatic.toId, '这组明牌可以一起移动。');
      }
    }
    return state.piles.stock.length
      ? clickHint('stock', '可以把剩下的三张牌发到前三列。')
      : null;
  },

  isWon(state) {
    return SCORPION_COMPLETED.every((id) => validStatePile(state, id) && state.piles[id].length === 13)
      && TABLEAU_7.every((id) => validStatePile(state, id) && state.piles[id].length === 0)
      && validStatePile(state, 'stock')
      && state.piles.stock.length === 0;
  },

  isLost(state) {
    if (this.isWon(state) || state.piles.stock.length > 0) return false;
    return !TABLEAU_7.some((fromId) => state.piles[fromId].some((_, index) =>
      TABLEAU_7.some((toId) => this.canMove(state, fromId, index, toId)
        && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_7)
        && !immediatelyReversesLastMove(state, fromId, index, toId))));
  }
};

// ---------------------------------------------------------------------------
// Forty Thieves / 四十大盗

const FORTY_FOUNDATIONS = Array.from({ length: 8 }, (_, index) => `f${index}`);
const fortyFoundationSuit = (id) => {
  const index = Number(id.slice(1));
  return Number.isInteger(index) && index >= 0 && index < 8 ? SUITS[Math.floor(index / 2)] : null;
};

function canPlaceOnFortyFoundation(state, card, foundationId) {
  if (!FORTY_FOUNDATIONS.includes(foundationId) || fortyFoundationSuit(foundationId) !== card?.suit) return false;
  const target = top(state.piles[foundationId]);
  return target ? card.rank === target.rank + 1 : card.rank === 1;
}

const FortyThieves = {
  id: 'forty-thieves',
  name: '四十大盗',
  description: '用两副牌进行的经典高难度接龙，八个收牌区都要从 A 收到 K。',
  instructions: ['牌列只能单张移动，并按同花色递减堆放。', '空列可放任意单张，牌堆每次翻一张。'],
  difficulties: [difficulty('classic', '经典')],
  defaultDifficulty: 'classic',
  board: standardBoard(10, 3),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(2, seed);
    const piles = Object.fromEntries([...TABLEAU_10, ...FORTY_FOUNDATIONS].map((id) => [id, []]));
    for (let row = 0; row < 4; row += 1) {
      for (const id of TABLEAU_10) piles[id].push(faceUp(deck.pop()));
    }
    piles.stock = deck.map(faceDown);
    piles.waste = [];
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      pileView(state, 'stock', '牌堆', 'stock', 0, 0, 'none', state.piles.stock.length > 0),
      pileView(state, 'waste', '废牌', 'waste', 1, 0),
      ...FORTY_FOUNDATIONS.map((id, x) => pileView(state, id, `${SUIT_NAMES[fortyFoundationSuit(id)]} ${x % 2 + 1}`, 'foundation', x + 2, 0)),
      ...TABLEAU_10.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 1, 'down'))
    ];
  },

  canSelect(state, pileId, index) {
    if (!validStatePile(state, pileId) || index !== state.piles[pileId].length - 1 || index < 0) return false;
    return isTableau(pileId, TABLEAU_10) || pileId === 'waste';
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !this.canSelect(state, fromId, index) || !validStatePile(state, toId)) return false;
    const card = state.piles[fromId][index];
    if (isTableau(toId, TABLEAU_10)) {
      const target = top(state.piles[toId]);
      return target ? suitDescending(card, target) : true;
    }
    return canPlaceOnFortyFoundation(state, card, toId);
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    state.piles[toId].push(state.piles[fromId].pop());
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId === 'stock') {
      if (!state.piles.stock.length) return false;
      clearRememberedMove(state);
      state.piles.waste.push(faceUp(state.piles.stock.pop()));
      incrementMoves(state);
      return true;
    }
    if (!validStatePile(state, pileId) || !state.piles[pileId].length) return false;
    const index = state.piles[pileId].length - 1;
    const automatic = this.autoMove(state, pileId, index);
    return automatic ? this.move(state, pileId, index, automatic.toId) : false;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index) || FORTY_FOUNDATIONS.includes(fromId)) return null;
    const card = state.piles[fromId][index];
    const toId = FORTY_FOUNDATIONS.find((id) => canPlaceOnFortyFoundation(state, card, id));
    return toId ? { toId } : null;
  },

  hint(state) {
    for (const fromId of ['waste', ...TABLEAU_10]) {
      const index = state.piles[fromId].length - 1;
      const automatic = this.autoMove(state, fromId, index);
      if (automatic) return moveHint(fromId, index, automatic.toId, '这张牌可以收到上方。');
    }
    for (const fromId of ['waste', ...TABLEAU_10]) {
      const index = state.piles[fromId].length - 1;
      for (const toId of TABLEAU_10) {
        if (this.canMove(state, fromId, index, toId)
          && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_10)
          && !immediatelyReversesLastMove(state, fromId, index, toId)) {
          return moveHint(fromId, index, toId, '这张牌可以移到另一列。');
        }
      }
    }
    return state.piles.stock.length ? clickHint('stock', '请翻开一张新牌。') : null;
  },

  isWon(state) {
    return FORTY_FOUNDATIONS.every((id) => validStatePile(state, id) && state.piles[id].length === 13)
      && TABLEAU_10.every((id) => validStatePile(state, id) && state.piles[id].length === 0)
      && validStatePile(state, 'stock')
      && validStatePile(state, 'waste')
      && state.piles.stock.length === 0
      && state.piles.waste.length === 0;
  },

  isLost(state) {
    if (this.isWon(state) || state.piles.stock.length > 0) return false;
    const sources = ['waste', ...TABLEAU_10];
    return !sources.some((fromId) => {
      const index = state.piles[fromId].length - 1;
      return FORTY_FOUNDATIONS.some((toId) => this.canMove(state, fromId, index, toId))
        || TABLEAU_10.some((toId) => this.canMove(state, fromId, index, toId)
          && !relocatesWholeTableauToEmpty(state, fromId, index, toId, TABLEAU_10)
          && !immediatelyReversesLastMove(state, fromId, index, toId));
    });
  }
};

// ---------------------------------------------------------------------------
// Baker's Game / 贝克接龙

const BAKER_TABLEAUS = Array.from({ length: 8 }, (_, index) => `t${index}`);
const BAKER_CELLS = Array.from({ length: 4 }, (_, index) => `cell${index}`);

function bakerMoveCapacity(state, toId) {
  const emptyCells = BAKER_CELLS.filter((id) => state.piles[id].length === 0).length;
  const spareColumns = BAKER_TABLEAUS.filter((id) => id !== toId && state.piles[id].length === 0).length;
  return (emptyCells + 1) * (2 ** spareColumns);
}

const BakersGame = {
  id: 'bakers-game',
  name: '贝克接龙',
  description: '与空当接龙相似，但牌列必须按同花色递减排列。',
  instructions: ['利用四个空当调度牌张。', '同花色顺子可在空当和空列容量足够时整组移动；收牌区从 A 到 K。'],
  difficulties: [difficulty('classic', '经典')],
  defaultDifficulty: 'classic',
  board: standardBoard(8, 3),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries([...BAKER_TABLEAUS, ...BAKER_CELLS, ...FOUNDATION_BY_SUIT].map((id) => [id, []]));
    let column = 0;
    while (deck.length) {
      piles[`t${column % 8}`].push(faceUp(deck.pop()));
      column += 1;
    }
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      ...BAKER_CELLS.map((id, x) => pileView(state, id, `空当 ${x + 1}`, 'cell', x, 0)),
      ...FOUNDATION_BY_SUIT.map((id, x) => pileView(state, id, `${SUIT_NAMES[id.slice(2)]}收牌`, 'foundation', x + 4, 0)),
      ...BAKER_TABLEAUS.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 1, 'down'))
    ];
  },

  canSelect(state, pileId, index) {
    if (!validStatePile(state, pileId) || index < 0 || index >= state.piles[pileId].length) return false;
    if (isTableau(pileId, BAKER_TABLEAUS)) return sameSuitDescending(state.piles[pileId], index);
    if (BAKER_CELLS.includes(pileId) || FOUNDATION_BY_SUIT.includes(pileId)) {
      return index === state.piles[pileId].length - 1;
    }
    return false;
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !this.canSelect(state, fromId, index) || !validStatePile(state, toId)) return false;
    const cards = state.piles[fromId];
    const moving = cards[index];
    const count = cards.length - index;
    if (BAKER_CELLS.includes(toId)) return count === 1 && state.piles[toId].length === 0;
    if (isTableau(toId, BAKER_TABLEAUS)) {
      if (count > bakerMoveCapacity(state, toId)) return false;
      const target = top(state.piles[toId]);
      return target ? suitDescending(moving, target) : true;
    }
    return count === 1 && canPlaceOnSuitFoundation(state, moving, toId);
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    state.piles[toId].push(...state.piles[fromId].splice(index));
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (!validStatePile(state, pileId) || !state.piles[pileId].length) return false;
    const index = state.piles[pileId].length - 1;
    const automatic = this.autoMove(state, pileId, index);
    return automatic ? this.move(state, pileId, index, automatic.toId) : false;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index) || index !== state.piles[fromId].length - 1) return null;
    const card = state.piles[fromId][index];
    const toId = firstSuitFoundation(state, card);
    return toId
      && this.canMove(state, fromId, index, toId)
      && !immediatelyReversesLastMove(state, fromId, index, toId)
      ? { toId }
      : null;
  },

  hint(state) {
    for (const fromId of [...BAKER_CELLS, ...BAKER_TABLEAUS]) {
      const index = state.piles[fromId].length - 1;
      const automatic = this.autoMove(state, fromId, index);
      if (automatic) return moveHint(fromId, index, automatic.toId, '这张牌可以收到上方。');
    }
    const tableauSources = [...BAKER_CELLS, ...BAKER_TABLEAUS, ...FOUNDATION_BY_SUIT];
    for (const fromId of tableauSources) {
      for (let index = 0; index < state.piles[fromId].length; index += 1) {
        for (const toId of BAKER_TABLEAUS) {
          if (this.canMove(state, fromId, index, toId)
            && !relocatesWholeTableauToEmpty(state, fromId, index, toId, BAKER_TABLEAUS)
            && !immediatelyReversesLastMove(state, fromId, index, toId)) {
            return moveHint(fromId, index, toId, '这组同花顺子可以移动。');
          }
        }
      }
    }
    const emptyCell = BAKER_CELLS.find((id) => state.piles[id].length === 0);
    if (emptyCell) {
      for (const fromId of BAKER_TABLEAUS) {
        const index = state.piles[fromId].length - 1;
        if (this.canMove(state, fromId, index, emptyCell)
          && !immediatelyReversesLastMove(state, fromId, index, emptyCell)) {
          return moveHint(fromId, index, emptyCell, '可以先把这张顶牌放入空当周转。');
        }
      }
    }
    return null;
  },

  isWon(state) {
    return FOUNDATION_BY_SUIT.every((id) => validStatePile(state, id) && state.piles[id].length === 13)
      && BAKER_TABLEAUS.every((id) => validStatePile(state, id) && state.piles[id].length === 0)
      && BAKER_CELLS.every((id) => validStatePile(state, id) && state.piles[id].length === 0);
  },

  isLost(state) {
    if (this.isWon(state)) return false;
    const sources = [...BAKER_CELLS, ...BAKER_TABLEAUS, ...FOUNDATION_BY_SUIT];
    return !sources.some((fromId) => state.piles[fromId].some((_, index) => {
      const foundationMove = FOUNDATION_BY_SUIT.some((toId) => this.canMove(state, fromId, index, toId)
        && !immediatelyReversesLastMove(state, fromId, index, toId));
      const tableauMove = BAKER_TABLEAUS.some((toId) => this.canMove(state, fromId, index, toId)
        && !relocatesWholeTableauToEmpty(state, fromId, index, toId, BAKER_TABLEAUS)
        && !immediatelyReversesLastMove(state, fromId, index, toId));
      const usefulCellMove = BAKER_CELLS.some((toId) => this.canMove(state, fromId, index, toId)
        && !(BAKER_CELLS.includes(fromId) && state.piles[toId].length === 0)
        && !immediatelyReversesLastMove(state, fromId, index, toId));
      return foundationMove || tableauMove || usefulCellMove;
    }));
  }
};

// ---------------------------------------------------------------------------
// Aces Up / Aces Up 四 A 通关

const ACES_TABLEAUS = Array.from({ length: 4 }, (_, index) => `t${index}`);
const aceHighValue = (card) => card.rank === 1 ? 14 : card.rank;

function acesCanDiscard(state, pileId) {
  if (!ACES_TABLEAUS.includes(pileId)
    || !validStatePile(state, pileId)
    || state.piles[pileId].length === 0) return false;
  const card = top(state.piles[pileId]);
  return ACES_TABLEAUS.some((otherId) => {
    if (otherId === pileId || !validStatePile(state, otherId) || state.piles[otherId].length === 0) return false;
    const other = top(state.piles[otherId]);
    return other.suit === card.suit && aceHighValue(other) > aceHighValue(card);
  });
}

const AcesUp = {
  id: 'aces-up',
  name: 'Aces Up（四 A 通关）',
  description: '消除同花色的较小明牌，最终只留下四张 A。',
  instructions: ['当两列顶牌同花色时，可消除点数较小的一张（A 最大）。', '顶牌可移到空列，点击牌堆继续发四张。'],
  difficulties: [difficulty('classic', '经典')],
  defaultDifficulty: 'classic',
  board: standardBoard(4, 3),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries(ACES_TABLEAUS.map((id) => [id, []]));
    for (const id of ACES_TABLEAUS) piles[id].push(faceUp(deck.pop()));
    piles.stock = deck.map(faceDown);
    piles.discard = [];
    return { piles, meta: { difficulty: selected, moves: 0 } };
  },

  getPiles(state) {
    return [
      pileView(state, 'stock', '牌堆', 'stock', 0, 0, 'none', state.piles.stock.length > 0),
      pileView(state, 'discard', '已消除', 'discard', 3, 0),
      ...ACES_TABLEAUS.map((id, x) => pileView(state, id, `第 ${x + 1} 列`, 'tableau', x, 1, 'down', acesCanDiscard(state, id)))
    ];
  },

  canSelect(state, pileId, index) {
    return validStatePile(state, pileId)
      && ACES_TABLEAUS.includes(pileId)
      && index >= 0
      && index === state.piles[pileId].length - 1;
  },

  canMove(state, fromId, index, toId) {
    if (!this.canSelect(state, fromId, index) || fromId === toId) return false;
    if (toId === 'discard') return validStatePile(state, 'discard') && acesCanDiscard(state, fromId);
    return ACES_TABLEAUS.includes(toId)
      && validStatePile(state, toId)
      && state.piles[toId].length === 0;
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    rememberMove(state, fromId, index, toId);
    state.piles[toId].push(state.piles[fromId].pop());
    incrementMoves(state);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId === 'stock') {
      if (!state.piles.stock.length) return false;
      clearRememberedMove(state);
      for (const id of ACES_TABLEAUS) {
        if (state.piles.stock.length) state.piles[id].push(faceUp(state.piles.stock.pop()));
      }
      incrementMoves(state);
      return true;
    }
    if (acesCanDiscard(state, pileId)) {
      return this.move(state, pileId, state.piles[pileId].length - 1, 'discard');
    }
    return false;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    if (this.canMove(state, fromId, index, 'discard')) return { toId: 'discard' };
    // Moving a one-card column to an empty column merely moves the empty space
    // and creates an endless one-click loop. Keep it legal for manual play, but
    // only suggest it automatically when it exposes another card.
    if (state.piles[fromId].length <= 1) return null;
    const empty = ACES_TABLEAUS.find((id) => this.canMove(state, fromId, index, id)
      && !immediatelyReversesLastMove(state, fromId, index, id));
    return empty ? { toId: empty } : null;
  },

  hint(state) {
    for (const id of ACES_TABLEAUS) {
      const index = state.piles[id].length - 1;
      if (this.canMove(state, id, index, 'discard')) {
        return moveHint(id, index, 'discard', '这张是同花色中较小的顶牌，可以消除。');
      }
    }
    const empty = ACES_TABLEAUS.find((id) => state.piles[id].length === 0);
    if (empty) {
      for (const fromId of ACES_TABLEAUS) {
        const index = state.piles[fromId].length - 1;
        if (state.piles[fromId].length > 1
          && this.canMove(state, fromId, index, empty)
          && !immediatelyReversesLastMove(state, fromId, index, empty)) {
          return moveHint(fromId, index, empty, '可把顶牌移到空列，露出下面的牌。');
        }
      }
    }
    return state.piles.stock.length ? clickHint('stock', '没有可消除的牌时，可继续发牌。') : null;
  },

  isWon(state) {
    if (!validStatePile(state, 'stock')
      || !validStatePile(state, 'discard')
      || !ACES_TABLEAUS.every((id) => validStatePile(state, id))) return false;
    const remaining = ACES_TABLEAUS.flatMap((id) => state.piles[id]);
    return state.piles.stock.length === 0
      && state.piles.discard.length === 48
      && remaining.length === 4
      && remaining.every((card) => card.rank === 1);
  },

  isLost(state) {
    if (this.isWon(state) || state.piles.stock.length > 0) return false;
    if (ACES_TABLEAUS.some((id) => acesCanDiscard(state, id))) return false;
    const empty = ACES_TABLEAUS.find((id) => state.piles[id].length === 0);
    const canExposeCard = empty && ACES_TABLEAUS.some((fromId) => {
      const index = state.piles[fromId].length - 1;
      return state.piles[fromId].length > 1
        && this.canMove(state, fromId, index, empty)
        && !immediatelyReversesLastMove(state, fromId, index, empty);
    });
    return !canExposeCard;
  }
};

// ---------------------------------------------------------------------------
// Clock Solitaire / 时钟纸牌

const CLOCK_PILES = Array.from({ length: 13 }, (_, index) => `c${index + 1}`);
const CLOCK_POSITIONS = [
  [4, 0], [5, 1], [6, 2], [5, 3], [4, 4], [3, 4],
  [2, 4], [1, 3], [0, 2], [1, 1], [2, 0], [3, 0], [3, 2]
];
const clockLabel = (rank) => rank === 13 ? 'K（中央）' : `${rank} 点位`;
const nextClockCardIndex = (state, pileId) => {
  const cards = state.piles[pileId];
  if (!cards) return -1;
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    if (!cards[index].faceUp) return index;
  }
  return -1;
};

function clockStep(state) {
  if (state.meta.finished) return false;
  const sourceId = state.meta.currentPile;
  const index = nextClockCardIndex(state, sourceId);
  if (index < 0) {
    state.meta.finished = true;
    state.meta.won = state.meta.revealed === 52;
    return false;
  }
  const [card] = state.piles[sourceId].splice(index, 1);
  card.faceUp = true;
  const destinationId = `c${card.rank}`;
  // Face-up cards are tucked beneath the remaining face-down cards, as in the
  // physical game, so the next card to turn remains visible on top.
  state.piles[destinationId].unshift(card);
  state.meta.currentPile = destinationId;
  state.meta.lastCardId = card.id;
  state.meta.revealed += 1;
  incrementMoves(state);
  if (nextClockCardIndex(state, destinationId) < 0) {
    state.meta.finished = true;
    state.meta.won = state.meta.revealed === 52;
  }
  return true;
}

const ClockSolitaire = {
  id: 'clock-solitaire',
  name: '时钟纸牌',
  description: '按牌面点数在时钟的十三个位置间翻牌，有很强的运气成分。',
  instructions: ['从中央 K 牌位开始；翻出几点就到对应牌位继续翻。', 'J 是 11、Q 是 12、K 回到中央。如果第四张 K 恰好是最后一张暗牌，则获胜。'],
  difficulties: [difficulty('classic', '经典（纯运气）')],
  defaultDifficulty: 'classic',
  board: standardBoard(7, 5),

  createGame({ difficulty: selected = 'classic', seed } = {}) {
    const deck = shuffledDeck(1, seed);
    const piles = Object.fromEntries(CLOCK_PILES.map((id) => [id, []]));
    for (let round = 0; round < 4; round += 1) {
      for (const id of CLOCK_PILES) piles[id].push(faceDown(deck.pop()));
    }
    return {
      piles,
      meta: {
        difficulty: selected,
        moves: 0,
        currentPile: 'c13',
        revealed: 0,
        finished: false,
        won: false,
        lastCardId: null
      }
    };
  },

  getPiles(state) {
    return CLOCK_PILES.map((id, index) => pileView(
      state,
      id,
      clockLabel(index + 1),
      index === 12 ? 'center' : 'tableau',
      CLOCK_POSITIONS[index][0],
      CLOCK_POSITIONS[index][1],
      'none',
      !state.meta.finished && state.meta.currentPile === id
    ));
  },

  canSelect(state, pileId, index) {
    // Clock has no choice of card or destination. Returning false makes the
    // UI treat a click on the current face-down card as a pile click, so the
    // game remains playable even when "single-click move" is disabled.
    return false;
  },

  canMove() {
    return false;
  },

  move() {
    return false;
  },

  clickPile(state, pileId) {
    return pileId === state.meta.currentPile ? clockStep(state) : false;
  },

  autoMove() {
    return null;
  },

  hint(state) {
    return state.meta.finished
      ? null
      : clickHint(state.meta.currentPile, '点击高亮的牌位，翻开下一张牌。');
  },

  isWon(state) {
    return totalStateCards(state) === 52
      && CLOCK_PILES.every((id) => validStatePile(state, id)
        && state.piles[id].every((card) => card.faceUp));
  },

  isLost(state) {
    return Boolean(state.meta.finished) && !this.isWon(state);
  }
};

export const EXPANSION_GAMES = [
  Golf,
  Yukon,
  Scorpion,
  FortyThieves,
  BakersGame,
  AcesUp,
  ClockSolitaire
];

export function getExpansionGame(id) {
  return EXPANSION_GAMES.find((game) => game.id === id) ?? null;
}

export const findExpansionGame = getExpansionGame;

export {
  Golf,
  Yukon,
  Scorpion,
  FortyThieves,
  BakersGame,
  AcesUp,
  ClockSolitaire
};

export default EXPANSION_GAMES;
