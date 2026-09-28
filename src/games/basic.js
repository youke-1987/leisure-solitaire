import {
  SUITS,
  createDeck,
  seededRandom,
  shuffle,
  isRed,
} from "../core.js";

const SUIT_NAMES = {
  spades: "黑桃",
  hearts: "红桃",
  diamonds: "方块",
  clubs: "梅花",
};

const FOUNDATION_IDS = SUITS.map((suit) => `foundation-${suit}`);
const KLONDIKE_TABLEAUS = Array.from({ length: 7 }, (_, index) => `tableau-${index}`);
const FREECELL_TABLEAUS = Array.from({ length: 8 }, (_, index) => `tableau-${index}`);

function cardsIn(state, pileId) {
  const pile = state?.piles?.[pileId];
  if (Array.isArray(pile)) return pile;
  return pile?.cards ?? [];
}

function top(state, pileId) {
  const cards = cardsIn(state, pileId);
  return cards[cards.length - 1] ?? null;
}

function freshState(gameId, difficulty, seed, piles, extraMeta = {}) {
  return {
    piles,
    meta: {
      gameId,
      difficulty,
      seed,
      ...extraMeta,
    },
  };
}

function shuffledDeck(seed, count = 1) {
  return shuffle(createDeck(count), seededRandom(seed));
}

function setFace(card, faceUp) {
  card.faceUp = faceUp;
  return card;
}

function oppositeColours(a, b) {
  return isRed(a) !== isRed(b);
}

function alternatingDescending(cards, start = 0) {
  if (start < 0 || start >= cards.length) return false;
  for (let index = start; index < cards.length; index += 1) {
    if (!cards[index].faceUp) return false;
    if (index > start) {
      const previous = cards[index - 1];
      const current = cards[index];
      if (previous.rank !== current.rank + 1 || !oppositeColours(previous, current)) {
        return false;
      }
    }
  }
  return true;
}

function sameSuitDescending(cards, start = 0) {
  if (start < 0 || start >= cards.length) return false;
  for (let index = start; index < cards.length; index += 1) {
    if (!cards[index].faceUp) return false;
    if (index > start) {
      const previous = cards[index - 1];
      const current = cards[index];
      if (previous.suit !== current.suit || previous.rank !== current.rank + 1) return false;
    }
  }
  return true;
}

function foundationAccepts(state, pileId, card) {
  if (!FOUNDATION_IDS.includes(pileId) || pileId !== `foundation-${card.suit}`) return false;
  const target = top(state, pileId);
  return target ? target.suit === card.suit && card.rank === target.rank + 1 : card.rank === 1;
}

function moveSlice(state, fromId, index, toId) {
  const from = cardsIn(state, fromId);
  const to = cardsIn(state, toId);
  const moving = from.splice(index);
  to.push(...moving);
  return moving;
}

function exposeTableauTop(state, pileId) {
  if (!pileId.startsWith("tableau-")) return;
  const card = top(state, pileId);
  if (card) card.faceUp = true;
}

function moveHint(fromId, index, toId, message) {
  return { type: "move", fromId, index, toId, message };
}

function clickHint(pileId, message) {
  return { type: "click", pileId, message };
}

function uniqueLegalDestination(game, state, fromId, index, destinationIds) {
  const legal = destinationIds.filter((toId) => game.canMove(state, fromId, index, toId));
  return legal.length === 1 ? { toId: legal[0] } : null;
}

function gamePilesWithFoundations(state, tableauCount) {
  return [
    { id: "stock", label: "牌库", role: "stock", x: 0, y: 0, fan: "none", cards: cardsIn(state, "stock"), clickable: true },
    { id: "waste", label: "翻牌区", role: "waste", x: 1, y: 0, fan: "none", cards: cardsIn(state, "waste") },
    ...SUITS.map((suit, index) => ({
      id: `foundation-${suit}`,
      label: SUIT_NAMES[suit],
      role: "foundation",
      x: index + 3,
      y: 0,
      fan: "none",
      cards: cardsIn(state, `foundation-${suit}`),
    })),
    ...Array.from({ length: tableauCount }, (_, index) => ({
      id: `tableau-${index}`,
      label: `第 ${index + 1} 列`,
      role: "tableau",
      x: index,
      y: 2,
      fan: "down",
      cards: cardsIn(state, `tableau-${index}`),
    })),
  ];
}

// ---------------------------------------------------------------------------
// 纸牌（Klondike）

export const KLONDIKE = {
  id: "klondike",
  name: "纸牌",
  description: "经典的红黑交替接龙，把四种花色从 A 收到 K。",
  instructions: [
    "牌列按红黑交替、点数递减排列，空列只能放 K。",
    "A 可以移到右上角的收牌区，之后按同花色从小到大叠放。",
    "点牌库翻牌；牌库用完后可以重新翻阅。",
  ],
  difficulties: [
    { id: "draw1", label: "轻松（每次翻 1 张）" },
    { id: "draw3", label: "经典（每次翻 3 张）" },
  ],
  defaultDifficulty: "draw1",
  board: { columns: 7, minRows: 8 },

  createGame({ difficulty = "draw1", seed = Date.now() } = {}) {
    const chosen = difficulty === "draw3" ? "draw3" : "draw1";
    const deck = shuffledDeck(seed);
    const piles = { stock: [], waste: [] };
    for (const id of FOUNDATION_IDS) piles[id] = [];
    for (let column = 0; column < 7; column += 1) piles[`tableau-${column}`] = [];

    for (let column = 0; column < 7; column += 1) {
      for (let row = 0; row <= column; row += 1) {
        const card = deck.pop();
        piles[`tableau-${column}`].push(setFace(card, row === column));
      }
    }
    piles.stock = deck.map((card) => setFace(card, false));
    return freshState(this.id, chosen, seed, piles);
  },

  getPiles(state) {
    return gamePilesWithFoundations(state, 7);
  },

  canSelect(state, pileId, index) {
    const pile = cardsIn(state, pileId);
    if (index < 0 || index >= pile.length) return false;
    if (pileId === "waste" || FOUNDATION_IDS.includes(pileId)) {
      return index === pile.length - 1 && pile[index].faceUp;
    }
    if (KLONDIKE_TABLEAUS.includes(pileId)) return alternatingDescending(pile, index);
    return false;
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !this.canSelect(state, fromId, index)) return false;
    const moving = cardsIn(state, fromId).slice(index);
    const card = moving[0];
    if (FOUNDATION_IDS.includes(toId)) {
      return moving.length === 1 && foundationAccepts(state, toId, card);
    }
    if (!KLONDIKE_TABLEAUS.includes(toId)) return false;
    const target = top(state, toId);
    return target
      ? target.faceUp && target.rank === card.rank + 1 && oppositeColours(target, card)
      : card.rank === 13;
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    moveSlice(state, fromId, index, toId);
    exposeTableauTop(state, fromId);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== "stock") return false;
    const stock = cardsIn(state, "stock");
    const waste = cardsIn(state, "waste");
    if (stock.length === 0) {
      if (waste.length === 0) return false;
      stock.push(...waste.splice(0).reverse().map((card) => setFace(card, false)));
      return true;
    }
    const drawCount = state.meta?.difficulty === "draw3" ? 3 : 1;
    for (let count = 0; count < drawCount && stock.length; count += 1) {
      waste.push(setFace(stock.pop(), true));
    }
    return true;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    const moving = cardsIn(state, fromId).slice(index);
    if (moving.length === 1) {
      const foundation = `foundation-${moving[0].suit}`;
      if (this.canMove(state, fromId, index, foundation)) return { toId: foundation };
    }
    if (FOUNDATION_IDS.includes(fromId)) return null;
    // app.js enables single-click by default.  Only choose a tableau when the
    // destination is unambiguous; otherwise leave the card selected so the
    // player, rather than array order, decides between two valid columns.
    return uniqueLegalDestination(this, state, fromId, index, KLONDIKE_TABLEAUS);
  },

  hint(state) {
    const sources = ["waste", ...Array.from({ length: 7 }, (_, index) => `tableau-${index}`)];
    for (const fromId of sources) {
      const pile = cardsIn(state, fromId);
      for (let index = pile.length - 1; index >= 0; index -= 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        const card = pile[index];
        const foundation = `foundation-${card.suit}`;
        if (this.canMove(state, fromId, index, foundation)) {
          return moveHint(fromId, index, foundation, "这张牌可以收到右上角。 ");
        }
      }
    }
    for (const fromId of sources) {
      const pile = cardsIn(state, fromId);
      for (let index = 0; index < pile.length; index += 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        for (let column = 0; column < 7; column += 1) {
          const toId = `tableau-${column}`;
          if (this.canMove(state, fromId, index, toId)) {
            return moveHint(fromId, index, toId, "把这组牌移到相邻的牌列。 ");
          }
        }
      }
    }
    if (cardsIn(state, "stock").length || cardsIn(state, "waste").length) {
      return clickHint("stock", cardsIn(state, "stock").length ? "翻一张牌看看。" : "重新整理牌库。 ");
    }
    return null;
  },

  isWon(state) {
    return FOUNDATION_IDS.every((id) => cardsIn(state, id).length === 13)
      && cardsIn(state, "stock").length === 0
      && cardsIn(state, "waste").length === 0
      && KLONDIKE_TABLEAUS.every((id) => cardsIn(state, id).length === 0);
  },
};

// ---------------------------------------------------------------------------
// 空当接龙（FreeCell）

const CELL_IDS = Array.from({ length: 4 }, (_, index) => `cell-${index}`);

export const FREECELL = {
  id: "freecell",
  name: "空当接龙",
  description: "所有牌都看得见，利用四个空当把牌按花色收好。",
  instructions: [
    "牌列按红黑交替、点数递减排列，空列可以放任意牌。",
    "左上角四个空当各放一张牌，用来临时周转。",
    "右上角按同花色从 A 到 K 收牌，收完 52 张即获胜。",
  ],
  difficulties: [{ id: "classic", label: "经典" }],
  defaultDifficulty: "classic",
  board: { columns: 8, minRows: 9 },

  createGame({ difficulty = "classic", seed = Date.now() } = {}) {
    const deck = shuffledDeck(seed).map((card) => setFace(card, true));
    const piles = {};
    for (const id of CELL_IDS) piles[id] = [];
    for (const id of FOUNDATION_IDS) piles[id] = [];
    for (let column = 0; column < 8; column += 1) piles[`tableau-${column}`] = [];
    let column = 0;
    while (deck.length) {
      piles[`tableau-${column}`].push(deck.pop());
      column = (column + 1) % 8;
    }
    return freshState(this.id, "classic", seed, piles);
  },

  getPiles(state) {
    return [
      ...CELL_IDS.map((id, index) => ({
        id,
        label: `空当 ${index + 1}`,
        role: "cell",
        x: index,
        y: 0,
        fan: "none",
        cards: cardsIn(state, id),
      })),
      ...SUITS.map((suit, index) => ({
        id: `foundation-${suit}`,
        label: SUIT_NAMES[suit],
        role: "foundation",
        x: index + 4,
        y: 0,
        fan: "none",
        cards: cardsIn(state, `foundation-${suit}`),
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `tableau-${index}`,
        label: `第 ${index + 1} 列`,
        role: "tableau",
        x: index,
        y: 2,
        fan: "down",
        cards: cardsIn(state, `tableau-${index}`),
      })),
    ];
  },

  canSelect(state, pileId, index) {
    const pile = cardsIn(state, pileId);
    if (index < 0 || index >= pile.length) return false;
    if (CELL_IDS.includes(pileId) || FOUNDATION_IDS.includes(pileId)) return index === pile.length - 1;
    if (FREECELL_TABLEAUS.includes(pileId)) return alternatingDescending(pile, index);
    return false;
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !this.canSelect(state, fromId, index)) return false;
    const moving = cardsIn(state, fromId).slice(index);
    const card = moving[0];
    if (CELL_IDS.includes(toId)) return moving.length === 1 && cardsIn(state, toId).length === 0;
    if (FOUNDATION_IDS.includes(toId)) {
      return moving.length === 1 && foundationAccepts(state, toId, card);
    }
    if (!FREECELL_TABLEAUS.includes(toId)) return false;
    const target = top(state, toId);
    if (target && (target.rank !== card.rank + 1 || !oppositeColours(target, card))) return false;

    if (moving.length > 1) {
      const emptyCells = CELL_IDS.filter((id) => cardsIn(state, id).length === 0).length;
      let emptyColumns = FREECELL_TABLEAUS.filter((id) => cardsIn(state, id).length === 0).length;
      if (!target) emptyColumns -= 1; // The destination cannot also be used as a temporary column.
      const capacity = (emptyCells + 1) * (2 ** Math.max(0, emptyColumns));
      if (moving.length > capacity) return false;
    }
    return true;
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    moveSlice(state, fromId, index, toId);
    return true;
  },

  clickPile() {
    return false;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    const pile = cardsIn(state, fromId);
    if (index === pile.length - 1) {
      const foundation = `foundation-${pile[index].suit}`;
      if (this.canMove(state, fromId, index, foundation)) return { toId: foundation };
    }
    if (FOUNDATION_IDS.includes(fromId)) return null;
    return uniqueLegalDestination(
      this,
      state,
      fromId,
      index,
      [...FREECELL_TABLEAUS, ...CELL_IDS],
    );
  },

  hint(state) {
    const sources = [
      ...CELL_IDS,
      ...Array.from({ length: 8 }, (_, index) => `tableau-${index}`),
    ];
    for (const fromId of sources) {
      const pile = cardsIn(state, fromId);
      if (!pile.length) continue;
      const index = pile.length - 1;
      const foundation = `foundation-${pile[index].suit}`;
      if (this.canMove(state, fromId, index, foundation)) {
        return moveHint(fromId, index, foundation, "这张牌可以收到右上角。 ");
      }
    }
    for (const fromId of sources) {
      const pile = cardsIn(state, fromId);
      for (let index = 0; index < pile.length; index += 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        for (let column = 0; column < 8; column += 1) {
          const toId = `tableau-${column}`;
          if (this.canMove(state, fromId, index, toId)) {
            return moveHint(fromId, index, toId, "把这张牌或这一组牌移到另一列。 ");
          }
        }
      }
    }
    for (const fromId of sources) {
      const pile = cardsIn(state, fromId);
      if (!pile.length) continue;
      const index = pile.length - 1;
      const toId = CELL_IDS.find((id) => this.canMove(state, fromId, index, id));
      if (toId) return moveHint(fromId, index, toId, "先把这张牌放到空当中周转。 ");
    }
    return null;
  },

  isWon(state) {
    return FOUNDATION_IDS.every((id) => cardsIn(state, id).length === 13)
      && CELL_IDS.every((id) => cardsIn(state, id).length === 0)
      && FREECELL_TABLEAUS.every((id) => cardsIn(state, id).length === 0);
  },
};

// ---------------------------------------------------------------------------
// 蜘蛛纸牌（Spider）

const SPIDER_TABLEAUS = Array.from({ length: 10 }, (_, index) => `tableau-${index}`);
const SPIDER_COMPLETED = Array.from({ length: 8 }, (_, index) => `completed-${index}`);

function spiderDeck(seed, difficulty) {
  const cards = createDeck(2);
  if (difficulty === "one-suit") {
    for (const card of cards) card.suit = "spades";
  } else if (difficulty === "two-suit") {
    for (const card of cards) card.suit = isRed(card) ? "hearts" : "spades";
  }
  return shuffle(cards, seededRandom(seed));
}

function spiderRunAtTop(pile) {
  if (pile.length < 13) return false;
  const start = pile.length - 13;
  if (!sameSuitDescending(pile, start)) return false;
  return pile[start].rank === 13 && pile[pile.length - 1].rank === 1;
}

function collectSpiderRuns(state) {
  let changed = false;
  let found = true;
  while (found) {
    found = false;
    for (const tableauId of SPIDER_TABLEAUS) {
      const pile = cardsIn(state, tableauId);
      if (!spiderRunAtTop(pile)) continue;
      const completedId = SPIDER_COMPLETED.find((id) => cardsIn(state, id).length === 0);
      if (!completedId) return changed;
      cardsIn(state, completedId).push(...pile.splice(pile.length - 13));
      exposeTableauTop(state, tableauId);
      changed = true;
      found = true;
    }
  }
  return changed;
}

export const SPIDER = {
  id: "spider",
  name: "蜘蛛纸牌",
  description: "整理两副牌，凑齐同花色从 K 到 A 的八组牌。",
  instructions: [
    "牌可以叠到点数大 1 的牌下面；同花色连续牌可以整组移动。",
    "空列可以放任意牌或连续牌组。",
    "同花色 K 到 A 排齐后会自动收走；无空列时可点牌库发一排牌。",
  ],
  difficulties: [
    { id: "one-suit", label: "单花色（推荐）" },
    { id: "two-suit", label: "双花色" },
    { id: "four-suit", label: "四花色" },
  ],
  defaultDifficulty: "one-suit",
  board: { columns: 10, minRows: 10 },

  createGame({ difficulty = "one-suit", seed = Date.now() } = {}) {
    const chosen = ["one-suit", "two-suit", "four-suit"].includes(difficulty)
      ? difficulty
      : "one-suit";
    const deck = spiderDeck(seed, chosen);
    const piles = { stock: [] };
    for (const id of SPIDER_TABLEAUS) piles[id] = [];
    for (const id of SPIDER_COMPLETED) piles[id] = [];

    for (let round = 0; round < 6; round += 1) {
      for (let column = 0; column < 10; column += 1) {
        if (round === 5 && column >= 4) continue;
        const card = deck.pop();
        const finalRound = column < 4 ? 5 : 4;
        piles[`tableau-${column}`].push(setFace(card, round === finalRound));
      }
    }
    piles.stock = deck.map((card) => setFace(card, false));
    return freshState(this.id, chosen, seed, piles);
  },

  getPiles(state) {
    return [
      { id: "stock", label: "待发牌", role: "stock", x: 0, y: 0, fan: "none", cards: cardsIn(state, "stock"), clickable: true },
      ...SPIDER_COMPLETED.map((id, index) => ({
        id,
        label: `完成 ${index + 1}`,
        role: "completed",
        x: index + 2,
        y: 0,
        fan: "none",
        cards: cardsIn(state, id),
      })),
      ...SPIDER_TABLEAUS.map((id, index) => ({
        id,
        label: `第 ${index + 1} 列`,
        role: "tableau",
        x: index,
        y: 2,
        fan: "down",
        cards: cardsIn(state, id),
      })),
    ];
  },

  canSelect(state, pileId, index) {
    if (!SPIDER_TABLEAUS.includes(pileId)) return false;
    return sameSuitDescending(cardsIn(state, pileId), index);
  },

  canMove(state, fromId, index, toId) {
    if (fromId === toId || !SPIDER_TABLEAUS.includes(toId) || !this.canSelect(state, fromId, index)) {
      return false;
    }
    const card = cardsIn(state, fromId)[index];
    const target = top(state, toId);
    return !target || (target.faceUp && target.rank === card.rank + 1);
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    moveSlice(state, fromId, index, toId);
    exposeTableauTop(state, fromId);
    collectSpiderRuns(state);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== "stock") return false;
    const stock = cardsIn(state, "stock");
    if (stock.length < 10 || SPIDER_TABLEAUS.some((id) => cardsIn(state, id).length === 0)) return false;
    for (const tableauId of SPIDER_TABLEAUS) {
      cardsIn(state, tableauId).push(setFace(stock.pop(), true));
    }
    collectSpiderRuns(state);
    return true;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    const moving = cardsIn(state, fromId)[index];
    const occupied = SPIDER_TABLEAUS.filter((toId) => cardsIn(state, toId).length > 0);
    const sameSuitTargets = occupied.filter((toId) => top(state, toId)?.suit === moving.suit);
    const sameSuit = uniqueLegalDestination(this, state, fromId, index, sameSuitTargets);
    if (sameSuit) return sameSuit;
    if (sameSuitTargets.filter((toId) => this.canMove(state, fromId, index, toId)).length > 1) return null;
    return uniqueLegalDestination(this, state, fromId, index, SPIDER_TABLEAUS);
  },

  hint(state) {
    for (const fromId of SPIDER_TABLEAUS) {
      const pile = cardsIn(state, fromId);
      for (let index = 0; index < pile.length; index += 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        for (const toId of SPIDER_TABLEAUS) {
          if (cardsIn(state, toId).length && this.canMove(state, fromId, index, toId)) {
            return moveHint(fromId, index, toId, "把这组同花色的牌移到点数大 1 的牌上。 ");
          }
        }
      }
    }
    for (const fromId of SPIDER_TABLEAUS) {
      const pile = cardsIn(state, fromId);
      for (let index = 0; index < pile.length; index += 1) {
        if (!this.canSelect(state, fromId, index)) continue;
        const empty = SPIDER_TABLEAUS.find((toId) => this.canMove(state, fromId, index, toId));
        if (empty) return moveHint(fromId, index, empty, "可以先把这组牌移到空列。 ");
      }
    }
    if (cardsIn(state, "stock").length >= 10 && SPIDER_TABLEAUS.every((id) => cardsIn(state, id).length)) {
      return clickHint("stock", "没有合适的移动时，发一排新牌。 ");
    }
    return null;
  },

  isWon(state) {
    return SPIDER_COMPLETED.every((id) => cardsIn(state, id).length === 13)
      && cardsIn(state, "stock").length === 0
      && SPIDER_TABLEAUS.every((id) => cardsIn(state, id).length === 0);
  },
};

// ---------------------------------------------------------------------------
// 三峰纸牌（TriPeaks）

const TRI_COVERS = new Map([
  [0, [3, 4]], [1, [5, 6]], [2, [7, 8]],
  [3, [9, 10]], [4, [10, 11]], [5, [12, 13]], [6, [13, 14]],
  [7, [15, 16]], [8, [16, 17]],
  [9, [18, 19]], [10, [19, 20]], [11, [20, 21]], [12, [21, 22]],
  [13, [22, 23]], [14, [23, 24]], [15, [24, 25]], [16, [25, 26]], [17, [26, 27]],
]);

const TRI_POSITIONS = [
  ...[1.5, 4.5, 7.5].map((x) => ({ x, y: 0 })),
  ...[1, 2, 4, 5, 7, 8].map((x) => ({ x, y: 1 })),
  ...Array.from({ length: 9 }, (_, index) => ({ x: index + 0.5, y: 2 })),
  ...Array.from({ length: 10 }, (_, index) => ({ x: index, y: 3 })),
];

function triIsOpen(state, index) {
  const pile = cardsIn(state, `tri-${index}`);
  if (pile.length === 0) return false;
  const covers = TRI_COVERS.get(index) ?? [];
  return covers.every((cover) => cardsIn(state, `tri-${cover}`).length === 0);
}

function neighbouringRanks(a, b) {
  const difference = Math.abs(a - b);
  return difference === 1 || difference === 12;
}

export const TRIPEAKS = {
  id: "tripeaks",
  name: "三峰纸牌",
  description: "从山脚向上消牌，只需寻找大 1 或小 1 的牌。",
  instructions: [
    "只能拿没有被压住的牌。",
    "可拿的牌若比翻牌区顶牌大 1 或小 1，就可以移走；A 与 K 也相邻。",
    "没有可移的牌时点牌库翻一张；清空三座山峰即获胜。",
  ],
  difficulties: [{ id: "classic", label: "经典" }],
  defaultDifficulty: "classic",
  board: { columns: 10, minRows: 7 },

  createGame({ difficulty = "classic", seed = Date.now() } = {}) {
    const deck = shuffledDeck(seed);
    const piles = { stock: [], waste: [] };
    for (let index = 0; index < 28; index += 1) {
      piles[`tri-${index}`] = [setFace(deck.pop(), true)];
    }
    piles.waste.push(setFace(deck.pop(), true));
    piles.stock = deck.map((card) => setFace(card, false));
    return freshState(this.id, "classic", seed, piles);
  },

  getPiles(state) {
    return [
      ...TRI_POSITIONS.map((position, index) => ({
        id: `tri-${index}`,
        label: `山峰牌 ${index + 1}`,
        role: "tableau",
        x: position.x,
        y: position.y,
        fan: "none",
        cards: cardsIn(state, `tri-${index}`),
      })),
      { id: "stock", label: "牌库", role: "stock", x: 5.5, y: 5, fan: "none", cards: cardsIn(state, "stock"), clickable: true },
      { id: "waste", label: "翻牌区", role: "waste", x: 4.5, y: 5, fan: "none", cards: cardsIn(state, "waste") },
    ];
  },

  canSelect(state, pileId, index) {
    if (!pileId.startsWith("tri-")) return false;
    const position = Number(pileId.slice(4));
    return Number.isInteger(position) && position >= 0 && position < 28 && index === 0 && triIsOpen(state, position);
  },

  canMove(state, fromId, index, toId) {
    if (toId !== "waste" || !this.canSelect(state, fromId, index)) return false;
    const target = top(state, "waste");
    return Boolean(target && neighbouringRanks(cardsIn(state, fromId)[index].rank, target.rank));
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    moveSlice(state, fromId, index, toId);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== "stock" || cardsIn(state, "stock").length === 0) return false;
    cardsIn(state, "waste").push(setFace(cardsIn(state, "stock").pop(), true));
    return true;
  },

  autoMove(state, fromId, index) {
    return this.canMove(state, fromId, index, "waste") ? { toId: "waste" } : null;
  },

  hint(state) {
    for (let index = 0; index < 28; index += 1) {
      const fromId = `tri-${index}`;
      if (this.canMove(state, fromId, 0, "waste")) {
        return moveHint(fromId, 0, "waste", "这张牌与翻牌区顶牌相邻，可以移走。 ");
      }
    }
    if (cardsIn(state, "stock").length) return clickHint("stock", "翻一张新牌。 ");
    return null;
  },

  isWon(state) {
    return Array.from({ length: 28 }, (_, index) => cardsIn(state, `tri-${index}`).length)
      .every((length) => length === 0);
  },
};

// ---------------------------------------------------------------------------
// 金字塔纸牌（Pyramid）

const PYRAMID_POSITIONS = [];
const PYRAMID_COVERS = new Map();
let pyramidIndex = 0;
for (let row = 0; row < 7; row += 1) {
  for (let column = 0; column <= row; column += 1) {
    PYRAMID_POSITIONS.push({ x: (6 - row) + (column * 2), y: row, row, column });
    if (row < 6) {
      const nextRowStart = ((row + 1) * (row + 2)) / 2;
      PYRAMID_COVERS.set(pyramidIndex, [nextRowStart + column, nextRowStart + column + 1]);
    }
    pyramidIndex += 1;
  }
}

function pyramidIsOpen(state, pileId) {
  if (pileId === "waste") return cardsIn(state, "waste").length > 0;
  if (!pileId.startsWith("pyramid-")) return false;
  const index = Number(pileId.slice(8));
  if (!Number.isInteger(index) || index < 0 || index >= 28 || !cardsIn(state, pileId).length) return false;
  return (PYRAMID_COVERS.get(index) ?? [])
    .every((cover) => cardsIn(state, `pyramid-${cover}`).length === 0);
}

function pyramidAvailableCards(state) {
  const result = [];
  for (let index = 0; index < 28; index += 1) {
    const id = `pyramid-${index}`;
    if (pyramidIsOpen(state, id)) result.push({ id, index: 0, card: cardsIn(state, id)[0] });
  }
  if (pyramidIsOpen(state, "waste")) {
    const index = cardsIn(state, "waste").length - 1;
    result.push({ id: "waste", index, card: cardsIn(state, "waste")[index] });
  }
  return result;
}

export const PYRAMID = {
  id: "pyramid",
  name: "金字塔纸牌",
  description: "找出点数合计为 13 的两张牌，逐层清空金字塔。",
  instructions: [
    "只能使用没有被下面两张牌压住的牌，以及翻牌区最上面一张。",
    "两张牌点数合计为 13 时可一起移走；K 自己就是 13，可以单独移走。",
    "J 算 11，Q 算 12；牌库翻完后可以重新整理继续翻阅。",
    "清空金字塔中的 28 张牌即获胜。",
  ],
  difficulties: [{ id: "classic", label: "经典" }],
  defaultDifficulty: "classic",
  board: { columns: 13, minRows: 10 },

  createGame({ difficulty = "classic", seed = Date.now() } = {}) {
    const deck = shuffledDeck(seed);
    const piles = { stock: [], waste: [], removed: [] };
    for (let index = 0; index < 28; index += 1) {
      piles[`pyramid-${index}`] = [setFace(deck.pop(), true)];
    }
    piles.stock = deck.map((card) => setFace(card, false));
    return freshState(this.id, "classic", seed, piles);
  },

  getPiles(state) {
    return [
      ...PYRAMID_POSITIONS.map((position, index) => ({
        id: `pyramid-${index}`,
        label: `金字塔第 ${position.row + 1} 层`,
        role: "tableau",
        x: position.x,
        y: position.y,
        fan: "none",
        cards: cardsIn(state, `pyramid-${index}`),
      })),
      { id: "stock", label: "牌库", role: "stock", x: 5, y: 8, fan: "none", cards: cardsIn(state, "stock"), clickable: true },
      { id: "waste", label: "翻牌区", role: "waste", x: 7, y: 8, fan: "none", cards: cardsIn(state, "waste") },
      { id: "removed", label: "已消除", role: "completed", x: 9, y: 8, fan: "none", cards: cardsIn(state, "removed") },
    ];
  },

  canSelect(state, pileId, index) {
    const pile = cardsIn(state, pileId);
    if (!pyramidIsOpen(state, pileId) || index !== pile.length - 1) return false;
    return pileId === "waste" || index === 0;
  },

  canMove(state, fromId, index, toId) {
    if (!this.canSelect(state, fromId, index)) return false;
    const card = cardsIn(state, fromId)[index];
    if (toId === "removed") return card.rank === 13;
    if (fromId === toId) return false;
    const targetPile = cardsIn(state, toId);
    const targetIndex = targetPile.length - 1;
    return this.canSelect(state, toId, targetIndex) && card.rank + targetPile[targetIndex].rank === 13;
  },

  move(state, fromId, index, toId) {
    if (!this.canMove(state, fromId, index, toId)) return false;
    const removed = cardsIn(state, "removed");
    if (toId === "removed") {
      removed.push(cardsIn(state, fromId).splice(index, 1)[0]);
      return true;
    }
    const targetPile = cardsIn(state, toId);
    const partner = targetPile.pop();
    const card = cardsIn(state, fromId).splice(index, 1)[0];
    removed.push(card, partner);
    return true;
  },

  clickPile(state, pileId) {
    if (pileId !== "stock") return false;
    const stock = cardsIn(state, "stock");
    const waste = cardsIn(state, "waste");
    if (stock.length) {
      waste.push(setFace(stock.pop(), true));
      return true;
    }
    if (!waste.length) return false;
    stock.push(...waste.splice(0).reverse().map((card) => setFace(card, false)));
    return true;
  },

  autoMove(state, fromId, index) {
    if (!this.canSelect(state, fromId, index)) return null;
    const card = cardsIn(state, fromId)[index];
    if (card.rank === 13) return { toId: "removed" };
    const partners = pyramidAvailableCards(state)
      .filter((candidate) => candidate.id !== fromId && candidate.card.rank + card.rank === 13);
    return partners.length === 1 ? { toId: partners[0].id } : null;
  },

  hint(state) {
    const available = pyramidAvailableCards(state);
    const king = available.find(({ card }) => card.rank === 13);
    if (king) return moveHint(king.id, king.index, "removed", "K 可以单独消除。 ");
    for (let first = 0; first < available.length; first += 1) {
      for (let second = first + 1; second < available.length; second += 1) {
        if (available[first].card.rank + available[second].card.rank === 13) {
          return moveHint(
            available[first].id,
            available[first].index,
            available[second].id,
            "这两张牌合计为 13，可以一起消除。",
          );
        }
      }
    }
    if (cardsIn(state, "stock").length || cardsIn(state, "waste").length) {
      return clickHint("stock", cardsIn(state, "stock").length ? "翻一张新牌。" : "重新整理牌库。 ");
    }
    return null;
  },

  isWon(state) {
    return Array.from({ length: 28 }, (_, index) => cardsIn(state, `pyramid-${index}`).length)
      .every((length) => length === 0);
  },
};

export const BASIC_GAMES = [KLONDIKE, FREECELL, SPIDER, TRIPEAKS, PYRAMID];

export function getBasicGame(id) {
  return BASIC_GAMES.find((game) => game.id === id) ?? null;
}

export const findBasicGame = getBasicGame;

export default BASIC_GAMES;
