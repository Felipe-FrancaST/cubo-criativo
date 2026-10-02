export const GAME_ICONS = ['🐉', '🧙', '⚔️', '🛡️', '🧪', '💎']
export const MAX_GAME_ERRORS = 7

export function buildMemoryDeck(random = Math.random) {
  const icons = [...GAME_ICONS, ...GAME_ICONS]
  for (let index = icons.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[icons[index], icons[target]] = [icons[target], icons[index]]
  }
  return icons.map((icon, index) => ({
    id: `card-${index}`,
    icon,
    matched: false,
  }))
}

export function createMemoryState(deck = buildMemoryDeck(), roundId = 0) {
  return {
    deck,
    roundId,
    phase: 'idle',
    flipped: [],
    attempts: 0,
    errors: 0,
    startedAt: null,
    finishedAt: null,
  }
}

export function memoryGameReducer(state, action) {
  if (action.type === 'reset')
    return createMemoryState(action.deck, state.roundId + 1)
  if (action.type === 'start') {
    if (state.phase === 'playing') return state
    return {
      ...createMemoryState(action.deck, state.roundId + 1),
      phase: 'playing',
    }
  }
  if (action.type === 'flip') {
    const card = state.deck[action.index]
    if (
      state.phase !== 'playing' ||
      !card ||
      card.matched ||
      state.flipped.length === 2 ||
      state.flipped.includes(action.index)
    )
      return state
    return {
      ...state,
      startedAt: state.startedAt ?? action.now,
      flipped: [...state.flipped, action.index],
      attempts: state.attempts + (state.flipped.length === 1 ? 1 : 0),
    }
  }
  if (
    action.type === 'resolve' &&
    state.phase === 'playing' &&
    state.flipped.length === 2
  ) {
    const [first, second] = state.flipped
    const matched = state.deck[first].icon === state.deck[second].icon
    const deck = matched
      ? state.deck.map((card, index) =>
          index === first || index === second
            ? { ...card, matched: true }
            : card
        )
      : state.deck
    const errors = state.errors + (matched ? 0 : 1)
    const phase = deck.every((card) => card.matched)
      ? 'won'
      : errors >= MAX_GAME_ERRORS
        ? 'lost'
        : 'playing'
    return {
      ...state,
      deck,
      errors,
      flipped: [],
      phase,
      finishedAt: phase === 'playing' ? null : action.now,
    }
  }
  return state
}

export function memoryResult(state) {
  const won = state.phase === 'won'
  return {
    won,
    score: won
      ? state.errors === 0
        ? 1000
        : Math.max(100, 1000 - state.errors * 200)
      : Math.max(0, 1000 - state.errors * 250),
    attempts: state.attempts,
    errors: state.errors,
    duration_ms: Math.max(
      0,
      (state.finishedAt ?? 0) - (state.startedAt ?? state.finishedAt ?? 0)
    ),
  }
}

// The API grants plays by UTC day/week; the countdown follows that same boundary.
export function nextGameReset(isVip, now = new Date()) {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  next.setUTCDate(
    next.getUTCDate() + (isVip ? 1 : (8 - now.getUTCDay()) % 7 || 7)
  )
  return next
}

export function formatGameCountdown(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(seconds / 86400)
  const pad = (value) => String(value).padStart(2, '0')
  const time = `${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
  return days ? `${days}d ${time}` : time
}
