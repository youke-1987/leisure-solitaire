import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RANKS,
  SUITS,
  canStackAlternatingDescending,
  canStackRankDescending,
  canStackSameSuitDescending,
  cardColor,
  cardLabel,
  cloneState,
  createCard,
  createDeck,
  deserialize,
  flipTop,
  foundationTargetId,
  isRed,
  isSequence,
  moveCards,
  mutateFlipTop,
  mutateMoveCards,
  pileCards,
  rankLabel,
  seededRandom,
  serialize,
  shuffle,
  suitSymbol,
  topCard,
} from '../src/core.js';

test('defines a canonical 52-card deck with unique deterministic IDs', () => {
  assert.deepEqual(SUITS, ['spades', 'hearts', 'diamonds', 'clubs']);
  assert.deepEqual(RANKS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((card) => card.id)).size, 52);
  assert.deepEqual(deck[0], {
    id: 'deck-1-spades-1',
    suit: 'spades',
    rank: 1,
    faceUp: false,
  });
  assert.equal(createDeck(2).length, 104);
  assert.equal(new Set(createDeck(2).map((card) => card.id)).size, 104);
  assert.deepEqual(createDeck(0), []);
});

test('validates cards and deck counts', () => {
  assert.deepEqual(createCard('hearts', 12, true), {
    id: 'hearts-12', suit: 'hearts', rank: 12, faceUp: true,
  });
  assert.throws(() => createCard('stars', 1), /Unknown card suit/);
  assert.throws(() => createCard('clubs', 0), /rank/);
  assert.throws(() => createDeck(-1), /Deck count/);
});

test('seededRandom and shuffle are deterministic and non-mutating', () => {
  const first = Array.from({ length: 6 }, seededRandom('same-seed'));
  const second = Array.from({ length: 6 }, seededRandom('same-seed'));
  const different = Array.from({ length: 6 }, seededRandom('different-seed'));
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
  assert.ok(first.every((number) => number >= 0 && number < 1));

  const input = [1, 2, 3, 4, 5, 6, 7];
  const shuffled = shuffle(input, seededRandom(2026));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(shuffled, shuffle(input, seededRandom(2026)));
  assert.notDeepEqual(shuffled, input);
  assert.throws(() => shuffle(input, () => 1), /range/);
});

test('formats card colours, ranks, suits and labels', () => {
  const queen = createCard('diamonds', 12);
  assert.equal(isRed(queen), true);
  assert.equal(cardColor(queen), 'red');
  assert.equal(cardColor(createCard('clubs', 4)), 'black');
  assert.equal(rankLabel(1), 'A');
  assert.equal(rankLabel(10), '10');
  assert.equal(rankLabel(13), 'K');
  assert.equal(suitSymbol('diamonds'), '♦');
  assert.equal(cardLabel(queen), 'Q♦');
});

test('reads both compact array piles and rich pile objects', () => {
  const ace = createCard('clubs', 1);
  const king = createCard('spades', 13);
  assert.equal(topCard([ace, king]), king);
  assert.equal(topCard({ cards: [king, ace], label: 'tableau' }), ace);
  assert.equal(topCard([]), null);
  assert.equal(pileCards({ invalid: true }), null);
});

test('cloneState and JSON round trip isolate nested cards', () => {
  const state = {
    game: 'freecell',
    piles: { tableau0: [createCard('clubs', 9, true)] },
    settings: { hints: true },
  };
  const clone = cloneState(state);
  clone.piles.tableau0[0].rank = 8;
  clone.settings.hints = false;
  assert.equal(state.piles.tableau0[0].rank, 9);
  assert.equal(state.settings.hints, true);

  const restored = deserialize(serialize(state));
  assert.deepEqual(restored, state);
  assert.notEqual(restored.piles.tableau0[0], state.piles.tableau0[0]);
  assert.throws(() => deserialize({}), /JSON string/);
});

test('immutable and mutable move helpers transfer a suffix in order', () => {
  const cards = [
    createCard('clubs', 8, true),
    createCard('hearts', 7, true),
    createCard('spades', 6, true),
  ];
  const state = {
    piles: {
      from: { cards, role: 'tableau' },
      to: [createCard('diamonds', 9, true)],
    },
  };

  const moved = moveCards(state, 'from', 1, 'to');
  assert.notEqual(moved, state);
  assert.deepEqual(state.piles.from.cards.map((card) => card.rank), [8, 7, 6]);
  assert.deepEqual(moved.piles.from.cards.map((card) => card.rank), [8]);
  assert.deepEqual(moved.piles.to.map((card) => card.rank), [9, 7, 6]);
  assert.equal(moved.piles.from.role, 'tableau');

  assert.equal(mutateMoveCards(state, 'from', 1, 'to'), true);
  assert.deepEqual(state.piles.from.cards.map((card) => card.rank), [8]);
  assert.deepEqual(state.piles.to.map((card) => card.rank), [9, 7, 6]);
  assert.equal(mutateMoveCards(state, 'missing', 0, 'to'), false);
  assert.equal(moveCards(state, 'from', 99, 'to'), state);
});

test('flip helpers reveal the top card without unexpectedly toggling it', () => {
  const state = { piles: { stock: [createCard('hearts', 3)] } };
  const revealed = flipTop(state, 'stock');
  assert.equal(state.piles.stock[0].faceUp, false);
  assert.equal(revealed.piles.stock[0].faceUp, true);
  assert.equal(flipTop(revealed, 'stock'), revealed);

  assert.equal(mutateFlipTop(state, 'stock'), true);
  assert.equal(state.piles.stock[0].faceUp, true);
  assert.equal(mutateFlipTop(state, 'stock', false), true);
  assert.equal(state.piles.stock[0].faceUp, false);
  assert.equal(mutateFlipTop(state, 'missing'), false);
});

test('stacking predicates express the common descending rules', () => {
  const redSeven = createCard('hearts', 7, true);
  const blackSix = createCard('clubs', 6, true);
  const blackSeven = createCard('spades', 7, true);
  const blackSixSameSuit = createCard('spades', 6, true);

  assert.equal(canStackAlternatingDescending(blackSix, redSeven), true);
  assert.equal(canStackAlternatingDescending(blackSixSameSuit, blackSeven), false);
  assert.equal(canStackSameSuitDescending(blackSixSameSuit, blackSeven), true);
  assert.equal(canStackSameSuitDescending(blackSix, blackSeven), false);
  assert.equal(canStackRankDescending(blackSix, redSeven), true);
  assert.equal(canStackRankDescending(redSeven, blackSix), false);
});

test('isSequence checks suffixes with optional suit, colour and face rules', () => {
  const alternating = [
    createCard('clubs', 9, true),
    createCard('hearts', 8, true),
    createCard('spades', 7, true),
  ];
  assert.equal(isSequence(alternating), true);
  assert.equal(isSequence(alternating, 0, { alternating: true }), true);
  assert.equal(isSequence(alternating, 1, { alternating: true, faceUp: true }), true);
  assert.equal(isSequence(alternating, 0, { sameSuit: true }), false);

  const sameSuit = [createCard('clubs', 5), createCard('clubs', 4)];
  assert.equal(isSequence(sameSuit, 0, { sameSuit: true }), true);
  assert.equal(isSequence(sameSuit, 0, { sameSuit: true, faceUp: true }), false);
  assert.equal(isSequence([], 0), false);
});

test('foundationTargetId maps each suit to its named foundation', () => {
  const card = createCard('spades', 1, true);
  assert.equal(foundationTargetId(card), 'foundation-spades');
  assert.equal(foundationTargetId(card, 'home'), 'home-spades');
  assert.equal(foundationTargetId(card, ''), 'spades');
  assert.equal(foundationTargetId(null), null);
});

