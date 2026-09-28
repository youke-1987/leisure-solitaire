/**
 * Shared, dependency-free primitives for every solitaire variant.
 *
 * A pile may either be a card array or an object containing a `cards` array.
 * Supporting both shapes keeps the small games concise while still allowing a
 * richer pile object to carry presentation metadata.
 */

export const SUITS = Object.freeze([
  'spades',
  'hearts',
  'diamonds',
  'clubs',
]);

export const RANKS = Object.freeze(Array.from({ length: 13 }, (_, index) => index + 1));

const RED_SUITS = new Set(['hearts', 'diamonds']);
const SUIT_SYMBOLS = Object.freeze({
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
});
const FACE_LABELS = Object.freeze({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' });

function assertSuit(suit) {
  if (!SUITS.includes(suit)) {
    throw new RangeError(`Unknown card suit: ${String(suit)}`);
  }
}

function assertRank(rank) {
  if (!Number.isInteger(rank) || rank < 1 || rank > 13) {
    throw new RangeError(`Card rank must be an integer from 1 to 13: ${String(rank)}`);
  }
}

/** Create a deterministic single-card value. */
export function createCard(suit, rank, faceUp = false) {
  assertSuit(suit);
  assertRank(rank);

  return {
    id: `${suit}-${rank}`,
    suit,
    rank,
    faceUp: Boolean(faceUp),
  };
}

/**
 * Create one or more standard 52-card decks.
 * IDs include a one-based deck number, so every card is unique even when two
 * decks are used by Spider or Forty Thieves.
 */
export function createDeck(count = 1) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Deck count must be a non-negative integer: ${String(count)}`);
  }

  const cards = [];
  for (let deckNumber = 1; deckNumber <= count; deckNumber += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          ...createCard(suit, rank),
          id: `deck-${deckNumber}-${suit}-${rank}`,
        });
      }
    }
  }
  return cards;
}

function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0;
  }

  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Return a repeatable Mulberry32 pseudo-random number generator. */
export function seededRandom(seed = 0) {
  let value = hashSeed(seed);
  return function random() {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle that never changes the input array. */
export function shuffle(cards, rng = Math.random) {
  if (!Array.isArray(cards)) {
    throw new TypeError('shuffle expects an array of cards');
  }
  if (typeof rng !== 'function') {
    throw new TypeError('shuffle expects rng to be a function');
  }

  const result = cards.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const sample = rng();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError('rng must return a finite number in the range [0, 1)');
    }
    const swapIndex = Math.floor(sample * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());

  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const item of value) copy.push(deepClone(item, seen));
    return copy;
  }

  const copy = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    copy[key] = deepClone(item, seen);
  }
  return copy;
}

/** Deep-copy a plain game state, including every card and pile. */
export function cloneState(state) {
  return deepClone(state);
}

export function serialize(value) {
  return JSON.stringify(value);
}

export function deserialize(serialized) {
  if (typeof serialized !== 'string') {
    throw new TypeError('deserialize expects a JSON string');
  }
  return JSON.parse(serialized);
}

export function isRed(card) {
  return Boolean(card && RED_SUITS.has(card.suit));
}

export function cardColor(card) {
  return isRed(card) ? 'red' : 'black';
}

export function rankLabel(rank) {
  assertRank(rank);
  return FACE_LABELS[rank] ?? String(rank);
}

export function suitSymbol(suit) {
  assertSuit(suit);
  return SUIT_SYMBOLS[suit];
}

export function cardLabel(card) {
  if (!card) return '';
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

/** Return the mutable cards array represented by a pile, or null. */
export function pileCards(pile) {
  if (Array.isArray(pile)) return pile;
  if (pile && Array.isArray(pile.cards)) return pile.cards;
  return null;
}

export function topCard(pile) {
  const cards = pileCards(pile);
  return cards?.[cards.length - 1] ?? null;
}

function statePileCards(state, pileId) {
  if (!state || !state.piles || typeof state.piles !== 'object') return null;
  return pileCards(state.piles[pileId]);
}

function validMove(state, fromId, index, toId) {
  const from = statePileCards(state, fromId);
  const to = statePileCards(state, toId);
  return Boolean(
    from
      && to
      && from !== to
      && Number.isInteger(index)
      && index >= 0
      && index < from.length,
  );
}

/**
 * Move a suffix of one pile to another in place.
 * This primitive intentionally does not apply game-specific placement rules.
 */
export function mutateMoveCards(state, fromId, index, toId) {
  if (!validMove(state, fromId, index, toId)) return false;

  const from = statePileCards(state, fromId);
  const to = statePileCards(state, toId);
  to.push(...from.splice(index));
  return true;
}

/** Immutable counterpart of mutateMoveCards; invalid moves return `state`. */
export function moveCards(state, fromId, index, toId) {
  if (!validMove(state, fromId, index, toId)) return state;
  const nextState = cloneState(state);
  mutateMoveCards(nextState, fromId, index, toId);
  return nextState;
}

/** Set the top card's orientation in place. */
export function mutateFlipTop(state, pileId, faceUp = true) {
  const card = topCard(statePileCards(state, pileId));
  const desiredFace = Boolean(faceUp);
  if (!card || card.faceUp === desiredFace) return false;
  card.faceUp = desiredFace;
  return true;
}

/** Immutable counterpart of mutateFlipTop; it defaults to revealing the card. */
export function flipTop(state, pileId, faceUp = true) {
  const card = topCard(statePileCards(state, pileId));
  if (!card || card.faceUp === Boolean(faceUp)) return state;
  const nextState = cloneState(state);
  mutateFlipTop(nextState, pileId, faceUp);
  return nextState;
}

export function canStackAlternatingDescending(moving, target) {
  return Boolean(
    moving
      && target
      && moving.rank === target.rank - 1
      && isRed(moving) !== isRed(target),
  );
}

export function canStackSameSuitDescending(moving, target) {
  return Boolean(
    moving
      && target
      && moving.rank === target.rank - 1
      && moving.suit === target.suit,
  );
}

export function canStackRankDescending(moving, target) {
  return Boolean(moving && target && moving.rank === target.rank - 1);
}

/**
 * Check a descending run from `start` toward the top (end) of a pile.
 * Colour/suit constraints are opt-in so variants can share the same helper.
 */
export function isSequence(
  cards,
  start = 0,
  { sameSuit = false, alternating = false, faceUp = false } = {},
) {
  if (!Array.isArray(cards) || !Number.isInteger(start) || start < 0 || start >= cards.length) {
    return false;
  }

  for (let index = start; index < cards.length; index += 1) {
    const card = cards[index];
    if (!card || (faceUp && !card.faceUp)) return false;
    if (index === start) continue;

    const target = cards[index - 1];
    if (!canStackRankDescending(card, target)) return false;
    if (sameSuit && card.suit !== target.suit) return false;
    if (alternating && isRed(card) === isRed(target)) return false;
  }
  return true;
}

export function foundationTargetId(card, prefix = 'foundation') {
  if (!card) return null;
  assertSuit(card.suit);
  return prefix ? `${prefix}-${card.suit}` : card.suit;
}

