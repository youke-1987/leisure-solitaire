import test from "node:test";
import assert from "node:assert/strict";

import {
  BASIC_GAMES,
  KLONDIKE,
  FREECELL,
  SPIDER,
  TRIPEAKS,
  PYRAMID,
  getBasicGame,
} from "../src/games/basic.js";

let nextCardId = 1;
function card(suit, rank, faceUp = true) {
  return { id: `test-${nextCardId++}`, suit, rank, faceUp };
}

function cardCount(state) {
  return Object.values(state.piles)
    .reduce((sum, pile) => sum + pile.length, 0);
}

function emptyFoundations() {
  return {
    "foundation-spades": [],
    "foundation-hearts": [],
    "foundation-diamonds": [],
    "foundation-clubs": [],
  };
}

test("五个基本游戏都遵循统一游戏契约", () => {
  assert.equal(BASIC_GAMES.length, 5);
  assert.deepEqual(BASIC_GAMES.map((game) => game.id), [
    "klondike",
    "freecell",
    "spider",
    "tripeaks",
    "pyramid",
  ]);
  assert.equal(getBasicGame("spider"), SPIDER);
  assert.equal(getBasicGame("missing"), null);

  for (const game of BASIC_GAMES) {
    assert.equal(typeof game.name, "string");
    assert.equal(typeof game.description, "string");
    assert.ok(Array.isArray(game.instructions));
    assert.ok(Array.isArray(game.difficulties));
    assert.ok(game.difficulties.some(({ id }) => id === game.defaultDifficulty));
    assert.equal(typeof game.board.columns, "number");
    for (const method of ["createGame", "getPiles", "canSelect", "canMove", "move", "clickPile", "autoMove", "hint", "isWon"]) {
      assert.equal(typeof game[method], "function", `${game.id}.${method}`);
    }
  }
});

test("纸牌发出 28 张牌列牌并留下 24 张牌库牌", () => {
  const state = KLONDIKE.createGame({ seed: "klondike-layout" });
  assert.equal(cardCount(state), 52);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => state.piles[`tableau-${index}`].length),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(state.piles.stock.length, 24);
  for (let column = 0; column < 7; column += 1) {
    const pile = state.piles[`tableau-${column}`];
    assert.ok(pile.at(-1).faceUp);
    assert.ok(pile.slice(0, -1).every((item) => !item.faceUp));
  }
});

test("纸牌只允许红黑交替下降，并会翻开来源列的新顶牌", () => {
  const hidden = card("clubs", 12, false);
  const moving = card("hearts", 6);
  const state = {
    piles: {
      stock: [], waste: [],
      ...emptyFoundations(),
      "tableau-0": [card("spades", 7)],
      "tableau-1": [hidden, moving],
      "tableau-2": [card("clubs", 6)],
      "tableau-3": [], "tableau-4": [], "tableau-5": [], "tableau-6": [],
    },
    meta: { difficulty: "draw1" },
  };
  assert.equal(KLONDIKE.canMove(state, "tableau-1", 1, "tableau-0"), true);
  assert.equal(KLONDIKE.canMove(state, "tableau-2", 0, "tableau-0"), false);
  assert.equal(KLONDIKE.move(state, "tableau-1", 1, "tableau-0"), true);
  assert.equal(hidden.faceUp, true);
  assert.equal(state.piles["tableau-0"].at(-1), moving);
});

test("纸牌牌库翻牌、回收及胜利判断有效", () => {
  const state = KLONDIKE.createGame({ difficulty: "draw3", seed: 2 });
  assert.equal(KLONDIKE.clickPile(state, "stock"), true);
  assert.equal(state.piles.stock.length, 21);
  assert.equal(state.piles.waste.length, 3);
  assert.ok(state.piles.waste.every((item) => item.faceUp));

  state.piles.stock = [];
  assert.equal(KLONDIKE.clickPile(state, "stock"), true);
  assert.equal(state.piles.waste.length, 0);
  assert.ok(state.piles.stock.every((item) => !item.faceUp));

  const won = { piles: emptyFoundations() };
  for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
    won.piles[`foundation-${suit}`] = Array.from({ length: 13 }, (_, index) => card(suit, index + 1));
  }
  assert.equal(KLONDIKE.isWon(won), true);
  won.piles["foundation-spades"].pop();
  assert.equal(KLONDIKE.isWon(won), false);
});

test("空当接龙把 52 张明牌按 7/6 张分到八列", () => {
  const state = FREECELL.createGame({ seed: "freecell-layout" });
  assert.equal(cardCount(state), 52);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => state.piles[`tableau-${index}`].length),
    [7, 7, 7, 7, 6, 6, 6, 6],
  );
  assert.ok(Object.values(state.piles).flat().every((item) => item.faceUp));
});

test("空当接龙校验交替牌列、空当和多牌移动容量", () => {
  const state = {
    piles: {
      ...emptyFoundations(),
      "cell-0": [card("clubs", 2)],
      "cell-1": [card("diamonds", 3)],
      "cell-2": [card("clubs", 4)],
      "cell-3": [card("diamonds", 5)],
      "tableau-0": [card("spades", 9)],
      "tableau-1": [card("hearts", 8), card("clubs", 7)],
      "tableau-2": [card("clubs", 8)],
      "tableau-3": [card("hearts", 10)],
      "tableau-4": [card("clubs", 11)],
      "tableau-5": [card("hearts", 12)],
      "tableau-6": [card("clubs", 13)],
      "tableau-7": [card("spades", 6)],
    },
    meta: {},
  };
  assert.equal(FREECELL.canMove(state, "tableau-1", 0, "tableau-0"), false, "四个空当全满时不能一次搬两张");
  assert.equal(FREECELL.canMove(state, "tableau-7", 0, "tableau-1"), false, "不能把黑 6 放到黑 7 上");
  state.piles["cell-0"] = [];
  assert.equal(FREECELL.canMove(state, "tableau-1", 0, "tableau-0"), true);
  assert.equal(FREECELL.move(state, "tableau-1", 0, "tableau-0"), true);
  assert.equal(state.piles["tableau-0"].length, 3);
  assert.equal(FREECELL.canMove(state, "tableau-2", 0, "cell-0"), true);
});

test("空当接龙按花色从 A 开始收牌，并正确判断胜利", () => {
  const state = {
    piles: {
      ...emptyFoundations(),
      "cell-0": [card("hearts", 1)], "cell-1": [], "cell-2": [], "cell-3": [],
      ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`tableau-${index}`, []])),
    },
    meta: {},
  };
  assert.equal(FREECELL.canMove(state, "cell-0", 0, "foundation-hearts"), true);
  assert.equal(FREECELL.canMove(state, "cell-0", 0, "foundation-diamonds"), false);
  FREECELL.move(state, "cell-0", 0, "foundation-hearts");
  assert.equal(state.piles["foundation-hearts"].length, 1);

  for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
    state.piles[`foundation-${suit}`] = Array.from({ length: 13 }, (_, index) => card(suit, index + 1));
  }
  assert.equal(FREECELL.isWon(state), true);
});

test("蜘蛛纸牌按难度生成 1、2、4 种花色，并正确发牌", () => {
  for (const [difficulty, suitCount] of [["one-suit", 1], ["two-suit", 2], ["four-suit", 4]]) {
    const state = SPIDER.createGame({ difficulty, seed: `spider-${difficulty}` });
    assert.equal(cardCount(state), 104);
    assert.equal(new Set(Object.values(state.piles).flat().map((item) => item.id)).size, 104);
    assert.equal(new Set(Object.values(state.piles).flat().map((item) => item.suit)).size, suitCount);
    assert.equal(state.piles.stock.length, 50);
    assert.deepEqual(
      Array.from({ length: 10 }, (_, index) => state.piles[`tableau-${index}`].length),
      [6, 6, 6, 6, 5, 5, 5, 5, 5, 5],
    );
  }
});

test("蜘蛛纸牌只能整组移动同花色序列，K-A 完整牌组会自动收走", () => {
  const run = Array.from({ length: 13 }, (_, index) => card("spades", 13 - index));
  const state = {
    piles: {
      stock: [],
      ...Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`tableau-${index}`, []])),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`completed-${index}`, []])),
    },
    meta: {},
  };
  state.piles["tableau-0"] = run;
  assert.equal(SPIDER.canMove(state, "tableau-0", 0, "tableau-1"), true);
  assert.equal(SPIDER.move(state, "tableau-0", 0, "tableau-1"), true);
  assert.equal(state.piles["tableau-1"].length, 0);
  assert.equal(state.piles["completed-0"].length, 13);

  state.piles["tableau-2"] = [card("spades", 7), card("hearts", 6)];
  assert.equal(SPIDER.canSelect(state, "tableau-2", 0), false);
});

test("蜘蛛纸牌有空列时不能发牌，收满八组后胜利", () => {
  const state = SPIDER.createGame({ seed: 7 });
  state.piles["tableau-0"] = [];
  assert.equal(SPIDER.clickPile(state, "stock"), false);
  state.piles.stock = [];
  for (let index = 0; index < 10; index += 1) state.piles[`tableau-${index}`] = [];
  for (let index = 0; index < 8; index += 1) {
    state.piles[`completed-${index}`] = Array.from({ length: 13 }, (_, offset) => card("spades", 13 - offset));
  }
  assert.equal(SPIDER.isWon(state), true);
  state.piles["completed-7"].pop();
  assert.equal(SPIDER.isWon(state), false);
});

test("三峰纸牌发出 28 张山峰牌、1 张翻牌和 23 张牌库牌", () => {
  const state = TRIPEAKS.createGame({ seed: "tripeaks-layout" });
  assert.equal(cardCount(state), 52);
  assert.equal(state.piles.stock.length, 23);
  assert.equal(state.piles.waste.length, 1);
  assert.equal(Array.from({ length: 28 }, (_, index) => state.piles[`tri-${index}`].length).reduce((a, b) => a + b), 28);
});

test("三峰纸牌只允许移动未被遮挡且相邻点数的牌", () => {
  const piles = { stock: [], waste: [card("clubs", 5)] };
  for (let index = 0; index < 28; index += 1) piles[`tri-${index}`] = [];
  piles["tri-18"] = [card("hearts", 6)];
  piles["tri-19"] = [card("spades", 8)];
  piles["tri-0"] = [card("diamonds", 4)];
  piles["tri-3"] = [card("clubs", 10)];
  const state = { piles, meta: {} };
  assert.equal(TRIPEAKS.canMove(state, "tri-18", 0, "waste"), true);
  assert.equal(TRIPEAKS.canMove(state, "tri-19", 0, "waste"), false);
  assert.equal(TRIPEAKS.canSelect(state, "tri-0", 0), false, "上层牌仍被第 4 张牌压住");
  assert.equal(TRIPEAKS.move(state, "tri-18", 0, "waste"), true);
  assert.equal(state.piles.waste.at(-1).rank, 6);
  assert.equal(TRIPEAKS.isWon({ piles: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`tri-${i}`, []])) }), true);
});

test("金字塔发出 28 张桌面牌并留下 24 张牌库牌", () => {
  const state = PYRAMID.createGame({ seed: "pyramid-layout" });
  assert.equal(cardCount(state), 52);
  assert.equal(state.piles.stock.length, 24);
  assert.equal(state.piles.waste.length, 0);
  assert.equal(Array.from({ length: 28 }, (_, index) => state.piles[`pyramid-${index}`].length).reduce((a, b) => a + b), 28);
});

test("金字塔只消除未被遮挡且合计为 13 的牌，K 可单独消除", () => {
  const piles = { stock: [], waste: [], removed: [] };
  for (let index = 0; index < 28; index += 1) piles[`pyramid-${index}`] = [];
  piles["pyramid-21"] = [card("clubs", 5)];
  piles["pyramid-22"] = [card("hearts", 8)];
  piles["pyramid-23"] = [card("spades", 13)];
  piles["pyramid-0"] = [card("diamonds", 12)];
  piles["pyramid-1"] = [card("clubs", 7)];
  const state = { piles, meta: {} };

  assert.equal(PYRAMID.canSelect(state, "pyramid-0", 0), false);
  assert.equal(PYRAMID.canMove(state, "pyramid-21", 0, "pyramid-22"), true);
  assert.equal(PYRAMID.move(state, "pyramid-21", 0, "pyramid-22"), true);
  assert.equal(state.piles.removed.length, 2);
  assert.equal(PYRAMID.canMove(state, "pyramid-23", 0, "removed"), true);
  assert.equal(PYRAMID.move(state, "pyramid-23", 0, "removed"), true);
  assert.equal(state.piles.removed.length, 3);
  assert.equal(PYRAMID.isWon(state), false);

  for (let index = 0; index < 28; index += 1) piles[`pyramid-${index}`] = [];
  assert.equal(PYRAMID.isWon(state), true);
});

test("默认单击只在目的地明确时自动移动，不替玩家武断选择", () => {
  const klondike = {
    piles: {
      stock: [], waste: [], ...emptyFoundations(),
      "tableau-0": [card("hearts", 6)],
      "tableau-1": [card("spades", 7)],
      "tableau-2": [card("clubs", 7)],
      "tableau-3": [card("spades", 10)],
      "tableau-4": [card("hearts", 11)],
      "tableau-5": [card("clubs", 12)],
      "tableau-6": [card("hearts", 13)],
    },
    meta: {},
  };
  assert.equal(KLONDIKE.autoMove(klondike, "tableau-0", 0), null);
  klondike.piles["tableau-2"] = [card("clubs", 8)];
  assert.deepEqual(KLONDIKE.autoMove(klondike, "tableau-0", 0), { toId: "tableau-1" });

  const freecell = {
    piles: {
      ...emptyFoundations(),
      "cell-0": [card("clubs", 2)], "cell-1": [card("diamonds", 3)],
      "cell-2": [card("clubs", 4)], "cell-3": [card("diamonds", 5)],
      "tableau-0": [card("hearts", 6)],
      "tableau-1": [card("spades", 7)],
      "tableau-2": [card("clubs", 7)],
      "tableau-3": [card("spades", 10)], "tableau-4": [card("hearts", 11)],
      "tableau-5": [card("clubs", 12)], "tableau-6": [card("hearts", 13)],
      "tableau-7": [card("diamonds", 9)],
    },
    meta: {},
  };
  assert.equal(FREECELL.autoMove(freecell, "tableau-0", 0), null);
  freecell.piles["tableau-2"] = [card("clubs", 8)];
  assert.deepEqual(FREECELL.autoMove(freecell, "tableau-0", 0), { toId: "tableau-1" });

  const spider = {
    piles: {
      stock: [],
      ...Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`tableau-${index}`, []])),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`completed-${index}`, []])),
    },
    meta: {},
  };
  spider.piles["tableau-0"] = [card("hearts", 6)];
  spider.piles["tableau-1"] = [card("spades", 7)];
  spider.piles["tableau-2"] = [card("clubs", 7)];
  assert.equal(SPIDER.autoMove(spider, "tableau-0", 0), null);
  spider.piles["tableau-3"] = [card("hearts", 7)];
  assert.deepEqual(SPIDER.autoMove(spider, "tableau-0", 0), { toId: "tableau-3" }, "优先唯一的同花色目标");

  const pyramidPiles = { stock: [], waste: [], removed: [] };
  for (let index = 0; index < 28; index += 1) pyramidPiles[`pyramid-${index}`] = [];
  pyramidPiles["pyramid-21"] = [card("clubs", 5)];
  pyramidPiles["pyramid-22"] = [card("hearts", 8)];
  pyramidPiles["pyramid-23"] = [card("diamonds", 8)];
  const pyramid = { piles: pyramidPiles, meta: {} };
  assert.equal(PYRAMID.autoMove(pyramid, "pyramid-21", 0), null);
  pyramidPiles["pyramid-23"] = [];
  assert.deepEqual(PYRAMID.autoMove(pyramid, "pyramid-21", 0), { toId: "pyramid-22" });
});

test("被遮挡牌必须等两个覆盖位置都清空后才能选择", () => {
  const triPiles = { stock: [], waste: [card("clubs", 5)] };
  for (let index = 0; index < 28; index += 1) triPiles[`tri-${index}`] = [];
  triPiles["tri-0"] = [card("spades", 4)];
  triPiles["tri-3"] = [card("hearts", 9)];
  triPiles["tri-4"] = [card("clubs", 10)];
  const tri = { piles: triPiles, meta: {} };
  assert.equal(TRIPEAKS.canSelect(tri, "tri-0", 0), false);
  triPiles["tri-3"] = [];
  assert.equal(TRIPEAKS.canSelect(tri, "tri-0", 0), false);
  triPiles["tri-4"] = [];
  assert.equal(TRIPEAKS.canSelect(tri, "tri-0", 0), true);

  const pyramidPiles = { stock: [], waste: [], removed: [] };
  for (let index = 0; index < 28; index += 1) pyramidPiles[`pyramid-${index}`] = [];
  pyramidPiles["pyramid-0"] = [card("spades", 13)];
  pyramidPiles["pyramid-1"] = [card("hearts", 6)];
  pyramidPiles["pyramid-2"] = [card("clubs", 7)];
  const pyramid = { piles: pyramidPiles, meta: {} };
  assert.equal(PYRAMID.canSelect(pyramid, "pyramid-0", 0), false);
  pyramidPiles["pyramid-1"] = [];
  assert.equal(PYRAMID.canSelect(pyramid, "pyramid-0", 0), false);
  pyramidPiles["pyramid-2"] = [];
  assert.equal(PYRAMID.canSelect(pyramid, "pyramid-0", 0), true);
});

test("翻三张纸牌回收后保持原来的翻阅次序", () => {
  const stock = [1, 2, 3, 4].map((rank) => card("spades", rank, false));
  const state = {
    piles: {
      stock, waste: [], ...emptyFoundations(),
      ...Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`tableau-${index}`, []])),
    },
    meta: { difficulty: "draw3" },
  };
  KLONDIKE.clickPile(state, "stock");
  assert.deepEqual(state.piles.waste.map(({ rank }) => rank), [4, 3, 2]);
  KLONDIKE.clickPile(state, "stock");
  assert.deepEqual(state.piles.waste.map(({ rank }) => rank), [4, 3, 2, 1]);
  KLONDIKE.clickPile(state, "stock");
  assert.deepEqual(state.piles.stock.map(({ rank }) => rank), [1, 2, 3, 4]);
  KLONDIKE.clickPile(state, "stock");
  assert.deepEqual(state.piles.waste.map(({ rank }) => rank), [4, 3, 2]);
});

test("蜘蛛成功发一排时每列增加一张明牌且牌库减少十张", () => {
  const state = SPIDER.createGame({ difficulty: "four-suit", seed: 93 });
  const before = Array.from({ length: 10 }, (_, index) => state.piles[`tableau-${index}`].length);
  assert.equal(SPIDER.clickPile(state, "stock"), true);
  assert.equal(state.piles.stock.length, 40);
  for (let index = 0; index < 10; index += 1) {
    const pile = state.piles[`tableau-${index}`];
    assert.equal(pile.length, before[index] + 1);
    assert.equal(pile.at(-1).faceUp, true);
  }
});

test("胜利判断拒绝收牌区已满但桌面仍残留牌的异常状态", () => {
  const klondike = { piles: { stock: [], waste: [], ...emptyFoundations() } };
  for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
    klondike.piles[`foundation-${suit}`] = Array.from({ length: 13 }, (_, index) => card(suit, index + 1));
  }
  klondike.piles["tableau-0"] = [card("spades", 13)];
  assert.equal(KLONDIKE.isWon(klondike), false);

  const spider = { piles: { stock: [], ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`tableau-${i}`, []])) } };
  for (let index = 0; index < 8; index += 1) {
    spider.piles[`completed-${index}`] = Array.from({ length: 13 }, (_, offset) => card("spades", 13 - offset));
  }
  spider.piles["tableau-9"] = [card("hearts", 1)];
  assert.equal(SPIDER.isWon(spider), false);
});

test("不存在的牌列不会被当成空列，避免把牌移动到界面之外", () => {
  const klondike = {
    piles: {
      stock: [], waste: [], ...emptyFoundations(),
      "tableau-0": [card("spades", 13)],
      ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`tableau-${index + 1}`, []])),
    },
    meta: {},
  };
  assert.equal(KLONDIKE.canMove(klondike, "tableau-0", 0, "tableau-99"), false);

  const freecell = {
    piles: {
      ...emptyFoundations(),
      "cell-0": [], "cell-1": [], "cell-2": [], "cell-3": [],
      "tableau-0": [card("hearts", 9)],
      ...Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`tableau-${index + 1}`, []])),
    },
    meta: {},
  };
  assert.equal(FREECELL.canMove(freecell, "tableau-0", 0, "tableau-99"), false);

  const tri = { piles: { "tri-28": [card("spades", 6)], waste: [card("hearts", 5)] }, meta: {} };
  assert.equal(TRIPEAKS.canSelect(tri, "tri-28", 0), false);
  const pyramid = { piles: { "pyramid-28": [card("spades", 13)] }, meta: {} };
  assert.equal(PYRAMID.canSelect(pyramid, "pyramid-28", 0), false);
});

test("所有基础游戏在可达状态中给出的提示都能由 app.js 原样执行", () => {
  for (const game of BASIC_GAMES) {
    const expectedCards = game.id === "spider" ? 104 : 52;
    for (let seed = 0; seed < 6; seed += 1) {
      const state = game.createGame({ difficulty: game.defaultDifficulty, seed: `hint-${seed}` });
      for (let step = 0; step < 35; step += 1) {
        assert.equal(cardCount(state), expectedCards, `${game.id} 第 ${step} 步牌数守恒`);
        const hint = game.hint(state);
        if (hint?.type === "move") {
          assert.equal(
            game.canMove(state, hint.fromId, hint.index, hint.toId),
            true,
            `${game.id} 给出的移动提示必须合法`,
          );
        } else if (hint?.type === "click") {
          const preview = structuredClone(state);
          assert.equal(game.clickPile(preview, hint.pileId), true, `${game.id} 给出的点击提示必须有效`);
        }

        const descriptors = game.getPiles(state);
        const actions = [];
        for (const from of descriptors) {
          for (let index = 0; index < from.cards.length; index += 1) {
            if (!game.canSelect(state, from.id, index)) continue;
            for (const destination of descriptors) {
              if (game.canMove(state, from.id, index, destination.id)) {
                actions.push({ type: "move", fromId: from.id, index, toId: destination.id });
              }
            }
          }
          if (from.clickable) {
            const preview = structuredClone(state);
            if (game.clickPile(preview, from.id)) actions.push({ type: "click", pileId: from.id });
          }
        }
        if (!actions.length) break;
        const action = actions[(seed * 19 + step * 7) % actions.length];
        const result = action.type === "move"
          ? game.move(state, action.fromId, action.index, action.toId)
          : game.clickPile(state, action.pileId);
        assert.equal(result, true);
      }
    }
  }
});
