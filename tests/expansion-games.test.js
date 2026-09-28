import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPANSION_GAMES,
  getExpansionGame,
  Golf,
  Yukon,
  Scorpion,
  FortyThieves,
  BakersGame,
  AcesUp,
  ClockSolitaire
} from '../src/games/expansion.js';

const card = (suit, rank, faceUp = true, suffix = '') => ({
  id: `test-${suit}-${rank}-${suffix}`,
  suit,
  rank,
  faceUp
});

const totalCards = (state) => Object.values(state.piles)
  .reduce((sum, pile) => sum + pile.length, 0);

const emptyPiles = (...ids) => Object.fromEntries(ids.map((id) => [id, []]));
const suits = ['spades', 'hearts', 'diamonds', 'clubs'];

test('expansion catalogue exposes seven complete, deterministic games', () => {
  assert.equal(EXPANSION_GAMES.length, 7);
  assert.deepEqual(
    EXPANSION_GAMES.map((game) => game.id),
    ['golf', 'yukon', 'scorpion', 'forty-thieves', 'bakers-game', 'aces-up', 'clock-solitaire']
  );

  const requiredMethods = [
    'createGame', 'getPiles', 'canSelect', 'canMove', 'move',
    'clickPile', 'autoMove', 'hint', 'isWon', 'isLost'
  ];
  for (const game of EXPANSION_GAMES) {
    assert.equal(getExpansionGame(game.id), game);
    assert.equal(typeof game.name, 'string');
    assert.equal(typeof game.description, 'string');
    assert.ok(Array.isArray(game.instructions) && game.instructions.length > 0);
    assert.ok(Array.isArray(game.difficulties) && game.difficulties.length > 0);
    assert.ok(game.difficulties.some(({ id }) => id === game.defaultDifficulty));
    assert.ok(Number.isInteger(game.board.columns));
    assert.ok(Number.isInteger(game.board.minRows));
    for (const method of requiredMethods) assert.equal(typeof game[method], 'function');

    const first = game.createGame({ difficulty: game.defaultDifficulty, seed: 1234 });
    const second = game.createGame({ difficulty: game.defaultDifficulty, seed: 1234 });
    assert.deepEqual(first, second, `${game.id} should reproduce a seeded deal`);
    for (const descriptor of game.getPiles(first)) {
      assert.equal(descriptor.cards, first.piles[descriptor.id]);
      assert.ok(['none', 'down', 'up'].includes(descriptor.fan));
    }
  }
  assert.equal(getExpansionGame('missing'), null);
});

test('Golf deals 35 tableau cards, one waste card and a 16-card stock', () => {
  const state = Golf.createGame({ seed: 10 });
  assert.equal(totalCards(state), 52);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`].length),
    [5, 5, 5, 5, 5, 5, 5]
  );
  assert.equal(state.piles.stock.length, 16);
  assert.equal(state.piles.waste.length, 1);
  assert.ok(Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`])
    .flat().every((item) => item.faceUp));
  assert.ok(state.piles.stock.every((item) => !item.faceUp));
});

test('Golf only removes an exposed adjacent rank and supports relaxed A-K wrapping', () => {
  const state = {
    piles: { ...emptyPiles('t0', 't1', 't2', 't3', 't4', 't5', 't6', 'stock'), waste: [card('clubs', 7)] },
    meta: { difficulty: 'classic', moves: 0 }
  };
  state.piles.t0.push(card('hearts', 6));
  state.piles.t1.push(card('spades', 9));
  assert.equal(Golf.canMove(state, 't0', 0, 'waste'), true);
  assert.equal(Golf.canMove(state, 't1', 0, 'waste'), false);
  assert.equal(Golf.move(state, 't0', 0, 'waste'), true);
  assert.equal(state.piles.t0.length, 0);

  state.piles.t2.push(card('diamonds', 13));
  state.piles.waste.push(card('clubs', 1));
  assert.equal(Golf.canMove(state, 't2', 0, 'waste'), false);
  state.meta.difficulty = 'relaxed';
  assert.equal(Golf.canMove(state, 't2', 0, 'waste'), true);

  const won = Golf.createGame({ seed: 12 });
  for (let index = 0; index < 7; index += 1) won.piles.waste.push(...won.piles[`t${index}`].splice(0));
  assert.equal(Golf.isWon(won), true);
});

test('Yukon uses its 1/6/7/8/9/10/11 deal with 21 hidden cards', () => {
  const state = Yukon.createGame({ seed: 20 });
  assert.equal(totalCards(state), 52);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`].length),
    [1, 6, 7, 8, 9, 10, 11]
  );
  const hidden = Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`])
    .flat().filter((item) => !item.faceUp);
  assert.equal(hidden.length, 21);
});

test('Yukon moves any face-up tail by its first card and reveals the source top', () => {
  const piles = {
    ...emptyPiles('t0', 't1', 't2', 't3', 't4', 't5', 't6'),
    ...emptyPiles(...suits.map((suit) => `f-${suit}`))
  };
  piles.t0 = [card('spades', 2, false), card('hearts', 5), card('diamonds', 12)];
  piles.t1 = [card('clubs', 6)];
  const state = { piles, meta: { difficulty: 'classic' } };

  assert.equal(Yukon.canSelect(state, 't0', 1), true, 'the tail need not itself be ordered in Yukon');
  assert.equal(Yukon.canMove(state, 't0', 1, 't1'), true);
  assert.equal(Yukon.move(state, 't0', 1, 't1'), true);
  assert.equal(state.piles.t1.length, 3);
  assert.equal(state.piles.t0[0].faceUp, true);

  state.piles.t2.push(card('diamonds', 1));
  assert.deepEqual(Yukon.autoMove(state, 't2', 0), { toId: 'f-diamonds' });
  assert.equal(Yukon.move(state, 't2', 0, 'f-diamonds'), true);
});

test('Yukon win requires four complete suit foundations', () => {
  const state = Yukon.createGame({ seed: 21 });
  for (const suit of suits) {
    state.piles[`f-${suit}`] = Array.from({ length: 13 }, (_, index) => card(suit, index + 1));
  }
  for (let index = 0; index < 7; index += 1) state.piles[`t${index}`] = [];
  assert.equal(Yukon.isWon(state), true);
  state.piles['f-spades'].pop();
  assert.equal(Yukon.isWon(state), false);
});

test('Scorpion deals 49 tableau cards, 12 face-down cards and a three-card stock', () => {
  const state = Scorpion.createGame({ seed: 30 });
  assert.equal(totalCards(state), 52);
  assert.equal(state.piles.stock.length, 3);
  assert.ok(Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`].length)
    .every((length) => length === 7));
  assert.equal(Array.from({ length: 7 }, (_, index) => state.piles[`t${index}`])
    .flat().filter((item) => !item.faceUp).length, 12);
});

test('Scorpion carries unordered face-up tails but builds by suit, and collects K-to-A', () => {
  const piles = {
    ...emptyPiles('t0', 't1', 't2', 't3', 't4', 't5', 't6'),
    ...emptyPiles('completed0', 'completed1', 'completed2', 'completed3', 'stock')
  };
  piles.t0 = Array.from({ length: 12 }, (_, index) => card('spades', 13 - index));
  piles.t1 = [card('spades', 1)];
  const state = { piles, meta: { difficulty: 'classic' } };
  assert.equal(Scorpion.canMove(state, 't1', 0, 't0'), true);
  assert.equal(Scorpion.move(state, 't1', 0, 't0'), true);
  assert.equal(state.piles.completed0.length, 13);
  assert.equal(state.piles.t0.length, 0);

  state.piles.t2 = [card('spades', 7), card('hearts', 6)];
  state.piles.t3 = [card('spades', 8)];
  assert.equal(Scorpion.canSelect(state, 't2', 0), true);
  assert.equal(Scorpion.canMove(state, 't2', 0, 't3'), true);
  state.piles.t4 = [card('hearts', 8)];
  assert.equal(Scorpion.canMove(state, 't2', 0, 't4'), false);
});

test('Scorpion stock deals one face-up card to each of the first three columns', () => {
  const state = Scorpion.createGame({ seed: 31 });
  const before = [state.piles.t0.length, state.piles.t1.length, state.piles.t2.length];
  assert.equal(Scorpion.clickPile(state, 'stock'), true);
  assert.deepEqual([state.piles.t0.length, state.piles.t1.length, state.piles.t2.length], before.map((n) => n + 1));
  assert.equal(state.piles.stock.length, 0);
  assert.ok(['t0', 't1', 't2'].every((id) => state.piles[id].at(-1).faceUp));
});

test('Scorpion does not auto-relocate a whole King column into another empty column', () => {
  const piles = {
    ...emptyPiles('t0', 't1', 't2', 't3', 't4', 't5', 't6'),
    ...emptyPiles('completed0', 'completed1', 'completed2', 'completed3')
  };
  piles.t0 = [card('spades', 13)];
  piles.stock = [card('clubs', 4, false)];
  const state = { piles, meta: {} };
  assert.equal(Scorpion.canMove(state, 't0', 0, 't1'), true, 'the manual move remains legal');
  assert.equal(Scorpion.autoMove(state, 't0', 0), null, 'one click must not just move the empty space');
  assert.deepEqual(Scorpion.hint(state), {
    type: 'click',
    pileId: 'stock',
    message: '可以把剩下的三张牌发到前三列。'
  });
  assert.equal(Scorpion.isLost(state), false);
  state.piles.stock = [];
  assert.equal(Scorpion.isLost(state), true);
});

test('Forty Thieves deals 40 face-up cards and leaves 64 in the stock', () => {
  const state = FortyThieves.createGame({ seed: 40 });
  assert.equal(totalCards(state), 104);
  assert.ok(Array.from({ length: 10 }, (_, index) => state.piles[`t${index}`].length === 4).every(Boolean));
  assert.equal(state.piles.stock.length, 64);
  assert.ok(Array.from({ length: 10 }, (_, index) => state.piles[`t${index}`])
    .flat().every((item) => item.faceUp));
});

test('Forty Thieves moves one card, builds same-suit downward, and has two foundations per suit', () => {
  const piles = {
    ...emptyPiles(...Array.from({ length: 10 }, (_, index) => `t${index}`)),
    ...emptyPiles(...Array.from({ length: 8 }, (_, index) => `f${index}`)),
    stock: [],
    waste: []
  };
  piles.t0 = [card('spades', 8)];
  piles.t1 = [card('spades', 9)];
  piles.t2 = [card('hearts', 9)];
  const state = { piles, meta: { difficulty: 'classic' } };
  assert.equal(FortyThieves.canMove(state, 't0', 0, 't1'), true);
  assert.equal(FortyThieves.canMove(state, 't0', 0, 't2'), false);

  state.piles.t3 = [card('spades', 1)];
  assert.equal(FortyThieves.canMove(state, 't3', 0, 'f0'), true);
  assert.equal(FortyThieves.canMove(state, 't3', 0, 'f1'), true);
  assert.equal(FortyThieves.canMove(state, 't3', 0, 'f2'), false);
  state.piles.f0 = [card('spades', 1)];
  assert.equal(FortyThieves.canSelect(state, 'f0', 0), false, 'classic foundations are locked');
});

test('Forty Thieves wins with 104 cards in the eight foundations', () => {
  const state = FortyThieves.createGame({ seed: 41 });
  for (let index = 0; index < 8; index += 1) {
    state.piles[`f${index}`] = Array.from({ length: 13 }, (_, rank) => card(suits[Math.floor(index / 2)], rank + 1, true, index));
  }
  for (let index = 0; index < 10; index += 1) state.piles[`t${index}`] = [];
  state.piles.stock = [];
  state.piles.waste = [];
  assert.equal(FortyThieves.isWon(state), true);
  state.piles.f7.pop();
  assert.equal(FortyThieves.isWon(state), false);
});

test('Forty Thieves hints do not immediately reverse a move and report a true dead end', () => {
  const piles = {
    ...emptyPiles(...Array.from({ length: 10 }, (_, index) => `t${index}`)),
    ...emptyPiles(...Array.from({ length: 8 }, (_, index) => `f${index}`)),
    stock: [card('clubs', 5, false)],
    waste: []
  };
  piles.t0 = [card('spades', 8)];
  piles.t1 = [card('spades', 9)];
  for (let index = 2; index < 10; index += 1) piles[`t${index}`] = [card('hearts', 3, true, index)];
  const state = { piles, meta: {} };
  assert.equal(FortyThieves.move(state, 't0', 0, 't1'), true);
  assert.equal(FortyThieves.canMove(state, 't1', 1, 't0'), true, 'manual backtracking stays legal');
  assert.equal(FortyThieves.hint(state).type, 'click');
  assert.equal(FortyThieves.hint(state).pileId, 'stock');
  assert.equal(FortyThieves.isLost(state), false);
  state.piles.stock = [];
  assert.equal(FortyThieves.isLost(state), true);
});

test("Baker's Game deals all 52 cards face-up in eight columns", () => {
  const state = BakersGame.createGame({ seed: 50 });
  assert.equal(totalCards(state), 52);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => state.piles[`t${index}`].length),
    [7, 7, 7, 7, 6, 6, 6, 6]
  );
  assert.ok(Array.from({ length: 8 }, (_, index) => state.piles[`t${index}`])
    .flat().every((item) => item.faceUp));
});

test("Baker's Game builds by suit and limits supermoves by free capacity", () => {
  const piles = {
    ...emptyPiles(...Array.from({ length: 8 }, (_, index) => `t${index}`)),
    ...emptyPiles('cell0', 'cell1', 'cell2', 'cell3'),
    ...emptyPiles(...suits.map((suit) => `f-${suit}`))
  };
  piles.t0 = [card('spades', 7), card('spades', 6)];
  piles.t1 = [card('spades', 8)];
  for (let index = 2; index < 8; index += 1) piles[`t${index}`] = [card('clubs', 10, true, index)];
  for (let index = 0; index < 4; index += 1) piles[`cell${index}`] = [card('hearts', index + 2, true, index)];
  const state = { piles, meta: { difficulty: 'classic' } };

  assert.equal(BakersGame.canSelect(state, 't0', 0), true);
  assert.equal(BakersGame.canMove(state, 't0', 0, 't1'), false, 'no spare space means only one card can move');
  state.piles.cell0 = [];
  assert.equal(BakersGame.canMove(state, 't0', 0, 't1'), true, 'one free cell permits a two-card run');

  state.piles.t4 = [card('hearts', 8)];
  assert.equal(BakersGame.canMove(state, 't0', 0, 't4'), false, 'a different suit is not a valid build');
});

test("Baker's Game wins with four complete foundations", () => {
  const state = BakersGame.createGame({ seed: 51 });
  for (const suit of suits) {
    state.piles[`f-${suit}`] = Array.from({ length: 13 }, (_, index) => card(suit, index + 1));
  }
  for (let index = 0; index < 8; index += 1) state.piles[`t${index}`] = [];
  for (let index = 0; index < 4; index += 1) state.piles[`cell${index}`] = [];
  assert.equal(BakersGame.isWon(state), true);
});

test("Baker's Game hint can recommend a free cell and does not call movable states lost", () => {
  const piles = {
    ...emptyPiles(...Array.from({ length: 8 }, (_, index) => `t${index}`)),
    ...emptyPiles('cell0', 'cell1', 'cell2', 'cell3'),
    ...emptyPiles(...suits.map((suit) => `f-${suit}`))
  };
  for (let index = 0; index < 8; index += 1) piles[`t${index}`] = [card(suits[index % 4], 7, true, index)];
  const state = { piles, meta: {} };
  const hint = BakersGame.hint(state);
  assert.equal(hint.type, 'move');
  assert.equal(hint.toId, 'cell0');
  assert.equal(BakersGame.canMove(state, hint.fromId, hint.index, hint.toId), true);
  assert.equal(BakersGame.isLost(state), false);
});

test('Aces Up starts with four visible cards and a 48-card stock', () => {
  const state = AcesUp.createGame({ seed: 60 });
  assert.equal(totalCards(state), 52);
  assert.equal(state.piles.stock.length, 48);
  assert.ok(['t0', 't1', 't2', 't3'].every((id) => state.piles[id].length === 1 && state.piles[id][0].faceUp));
});

test('Aces Up discards the lower exposed card of a suit and treats Ace as high', () => {
  const state = {
    piles: {
      t0: [card('spades', 5)],
      t1: [card('spades', 9)],
      t2: [card('hearts', 1)],
      t3: [card('hearts', 13)],
      stock: [],
      discard: []
    },
    meta: { difficulty: 'classic' }
  };
  assert.equal(AcesUp.canMove(state, 't0', 0, 'discard'), true);
  assert.equal(AcesUp.canMove(state, 't1', 0, 'discard'), false);
  assert.equal(AcesUp.canMove(state, 't2', 0, 'discard'), false);
  assert.equal(AcesUp.canMove(state, 't3', 0, 'discard'), true);
  assert.equal(AcesUp.clickPile(state, 't0'), true);
  assert.equal(state.piles.discard.length, 1);
  assert.equal(AcesUp.canMove(state, 't1', 0, 't0'), true, 'a top card may fill an empty column');
});

test('Aces Up wins only when four aces remain after all other cards are discarded', () => {
  const state = {
    piles: {
      t0: [card('spades', 1)],
      t1: [card('hearts', 1)],
      t2: [card('diamonds', 1)],
      t3: [card('clubs', 1)],
      stock: [],
      discard: Array.from({ length: 48 }, (_, index) => card('spades', 2, true, index))
    },
    meta: {}
  };
  assert.equal(AcesUp.isWon(state), true);
  state.piles.t3[0] = card('clubs', 13);
  assert.equal(AcesUp.isWon(state), false);
});

test('Aces Up avoids empty-column ping-pong and detects exhausted dead ends', () => {
  const state = {
    piles: {
      t0: [],
      t1: [card('spades', 1)],
      t2: [card('hearts', 1)],
      t3: [card('clubs', 13)],
      stock: [],
      discard: []
    },
    meta: {}
  };
  assert.equal(AcesUp.canMove(state, 't1', 0, 't0'), true, 'manual relocation is still legal');
  assert.equal(AcesUp.autoMove(state, 't1', 0), null);
  assert.equal(AcesUp.hint(state), null);
  assert.equal(AcesUp.isLost(state), true);

  state.piles.t1.push(card('diamonds', 7));
  assert.deepEqual(AcesUp.autoMove(state, 't1', 1), { toId: 't0' });
  assert.equal(AcesUp.isLost(state), false);
});

test('Clock Solitaire deals four hidden cards to each of thirteen positions', () => {
  const state = ClockSolitaire.createGame({ seed: 70 });
  assert.equal(totalCards(state), 52);
  assert.ok(Array.from({ length: 13 }, (_, index) => state.piles[`c${index + 1}`].length === 4).every(Boolean));
  assert.ok(Object.values(state.piles).flat().every((item) => !item.faceUp));
  assert.equal(state.meta.currentPile, 'c13');
});

test('Clock Solitaire follows the revealed rank to the next clock position', () => {
  const state = ClockSolitaire.createGame({ seed: 71 });
  assert.equal(ClockSolitaire.clickPile(state, 'c1'), false);
  const sourceIndex = state.piles.c13.length - 1;
  const expectedRank = state.piles.c13[sourceIndex].rank;
  assert.equal(ClockSolitaire.canSelect(state, 'c13', sourceIndex), false);
  assert.equal(ClockSolitaire.autoMove(state, 'c13', sourceIndex), null);
  assert.equal(ClockSolitaire.move(state, 'c13', sourceIndex, `c${expectedRank}`), false);
  assert.equal(ClockSolitaire.getPiles(state).find(({ id }) => id === 'c13').clickable, true);
  assert.equal(ClockSolitaire.clickPile(state, 'c13'), true);
  assert.equal(state.meta.currentPile, `c${expectedRank}`);
  assert.equal(state.meta.revealed, 1);
  assert.equal(Object.values(state.piles).flat().filter((item) => item.faceUp).length, 1);
  assert.equal(totalCards(state), 52);
});

test('Clock Solitaire finishes cleanly as a loss when the fourth King appears early', () => {
  const state = ClockSolitaire.createGame({ seed: 0 });
  let safety = 60;
  while (!state.meta.finished && safety > 0) {
    assert.equal(ClockSolitaire.clickPile(state, state.meta.currentPile), true);
    safety -= 1;
  }
  assert.ok(safety > 0);
  assert.equal(state.meta.finished, true);
  assert.equal(state.meta.won, false);
  assert.equal(ClockSolitaire.isWon(state), false);
  assert.equal(ClockSolitaire.isLost(state), true);
  assert.equal(ClockSolitaire.hint(state), null);
  assert.equal(ClockSolitaire.getPiles(state).some(({ clickable }) => clickable), false);
});

test('every generated hint is executable through the same move/click contract as the UI', () => {
  for (const game of EXPANSION_GAMES) {
    for (let seed = 0; seed < 20; seed += 1) {
      const state = game.createGame({ difficulty: game.defaultDifficulty, seed });
      const hint = game.hint(state);
      if (!hint) continue;
      const copy = structuredClone(state);
      if (hint.type === 'move') {
        assert.equal(game.canMove(copy, hint.fromId, hint.index, hint.toId), true, `${game.id} hint must be legal`);
        assert.equal(game.move(copy, hint.fromId, hint.index, hint.toId), true, `${game.id} hint must execute`);
      } else {
        assert.equal(hint.type, 'click');
        assert.equal(game.clickPile(copy, hint.pileId), true, `${game.id} click hint must execute`);
      }
    }
  }
});

test('missing piles are never treated as empty destinations and residual cards block victory', () => {
  const scorpion = {
    piles: {
      t0: [card('spades', 13)],
      t2: [], t3: [], t4: [], t5: [], t6: [],
      completed0: [], completed1: [], completed2: [], completed3: [], stock: []
    },
    meta: {}
  };
  assert.equal(Scorpion.canMove(scorpion, 't0', 0, 't1'), false);

  const forty = FortyThieves.createGame({ seed: 90 });
  for (let index = 0; index < 8; index += 1) {
    forty.piles[`f${index}`] = Array.from({ length: 13 }, (_, rank) =>
      card(suits[Math.floor(index / 2)], rank + 1, true, `full-${index}`));
  }
  assert.equal(FortyThieves.isWon(forty), false, 'full foundations cannot hide a still-populated board');

  const baker = BakersGame.createGame({ seed: 91 });
  for (const suit of suits) {
    baker.piles[`f-${suit}`] = Array.from({ length: 13 }, (_, rank) => card(suit, rank + 1));
  }
  assert.equal(BakersGame.isWon(baker), false);
});

test('Clock Solitaire wins when the final hidden card completes the whole chain', () => {
  const piles = emptyPiles(...Array.from({ length: 13 }, (_, index) => `c${index + 1}`));
  piles.c1 = Array.from({ length: 51 }, (_, index) => card('hearts', (index % 12) + 1, true, index));
  piles.c13 = [card('spades', 13, false, 'last')];
  const state = {
    piles,
    meta: {
      difficulty: 'classic',
      moves: 51,
      currentPile: 'c13',
      revealed: 51,
      finished: false,
      won: false
    }
  };
  assert.equal(ClockSolitaire.clickPile(state, 'c13'), true);
  assert.equal(state.meta.finished, true);
  assert.equal(state.meta.won, true);
  assert.equal(ClockSolitaire.isWon(state), true);
});
