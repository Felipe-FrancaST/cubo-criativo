import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GAME_ICONS,
  MAX_GAME_ERRORS,
  buildMemoryDeck,
  createMemoryState,
  memoryGameReducer,
  memoryResult,
  nextGameReset,
  formatGameCountdown,
} from '../src/lib/memoryGame.js'

const orderedDeck = () => buildMemoryDeck(() => 0.999)
const start = () =>
  memoryGameReducer(createMemoryState(), { type: 'start', deck: orderedDeck() })
const flip = (state, index, now = 1000) =>
  memoryGameReducer(state, { type: 'flip', index, now })
const resolve = (state, now = 2000) =>
  memoryGameReducer(state, { type: 'resolve', now })

test('embaralhamento mantém seis pares e identificadores únicos', () => {
  for (const random of [() => 0, () => 0.5, Math.random]) {
    const deck = buildMemoryDeck(random)
    assert.equal(new Set(deck.map((card) => card.id)).size, 12)
    for (const icon of GAME_ICONS)
      assert.equal(deck.filter((card) => card.icon === icon).length, 2)
  }
})

test('ignora carta repetida, terceiro toque e toque antes do início', () => {
  const idle = createMemoryState()
  assert.equal(flip(idle, 0), idle)
  const first = flip(start(), 0)
  assert.equal(flip(first, 0), first)
  const second = flip(first, 1)
  assert.equal(flip(second, 2), second)
  assert.equal(second.attempts, 1)
  assert.equal(second.startedAt, 1000)
})

test('acerto permanece aberto e erro devolve as cartas ao tabuleiro', () => {
  const match = resolve(flip(flip(start(), 0), 6))
  assert.equal(match.deck.filter((card) => card.matched).length, 2)
  assert.equal(flip(match, 0), match)
  const mismatch = resolve(flip(flip(match, 1), 2))
  assert.equal(mismatch.errors, 1)
  assert.equal(mismatch.attempts, 2)
  assert.deepEqual(mismatch.flipped, [])
  assert.equal(mismatch.phase, 'playing')
})

test('encerra a partida no sétimo erro e ignora novos toques', () => {
  let state = start()
  for (let i = 0; i < MAX_GAME_ERRORS; i += 1)
    state = resolve(flip(flip(state, 0), 1))
  assert.equal(state.phase, 'lost')
  assert.equal(state.errors, 7)
  assert.equal(flip(state, 3), state)
  assert.equal(memoryResult(state).score, 0)
})

test('partida perfeita registra seis tentativas, duração e pontuação de 1000', () => {
  let state = start()
  for (let i = 0; i < 6; i += 1)
    state = resolve(flip(flip(state, i, 1000), i + 6), 8000)
  assert.equal(state.phase, 'won')
  assert.deepEqual(memoryResult(state), {
    won: true,
    score: 1000,
    attempts: 6,
    errors: 0,
    duration_ms: 7000,
  })
})

test('reiniciar remove resultados e não resolve cartas da rodada anterior', () => {
  const previous = flip(flip(start(), 0), 1)
  const state = memoryGameReducer(previous, {
    type: 'reset',
    deck: orderedDeck(),
  })
  assert.equal(state.roundId, previous.roundId + 1)
  assert.equal(resolve(state), state)
  assert.equal(state.attempts, 0)
  assert.equal(state.startedAt, null)
})

test('contador acompanha os períodos diário VIP e semanal da API em UTC', () => {
  assert.equal(
    nextGameReset(true, new Date('2026-10-02T23:59:59Z')).toISOString(),
    '2026-10-03T00:00:00.000Z'
  )
  assert.equal(
    nextGameReset(false, new Date('2026-10-04T12:00:00Z')).toISOString(),
    '2026-10-05T00:00:00.000Z'
  )
  assert.equal(
    nextGameReset(false, new Date('2026-10-05T00:00:00Z')).toISOString(),
    '2026-10-12T00:00:00.000Z'
  )
  assert.equal(formatGameCountdown(-100), '00:00:00')
  assert.equal(formatGameCountdown(90061000), '1d 01:01:01')
})
