import React from 'react'
import { trackEvent } from '../lib/analytics.js'
import { copyText } from '../lib/clipboard.js'
import { navigateClient } from '../lib/navigation.js'
import {
  buildMemoryDeck,
  createMemoryState,
  memoryGameReducer,
  memoryResult,
  MAX_GAME_ERRORS,
  nextGameReset,
  formatGameCountdown,
} from '../lib/memoryGame.js'

const EMPTY_STATUS = {
  loading: true,
  can_play: false,
  weekly_reward: null,
  coupon: null,
  played: false,
}

export default function CupomGamePage({
  onGoHome,
  user,
  accessToken,
  onRequireLogin,
}) {
  const accountKey = user?.id || accessToken || 'guest'
  const [status, setStatus] = React.useState(EMPTY_STATUS)
  const [game, dispatch] = React.useReducer(memoryGameReducer, undefined, () =>
    createMemoryState()
  )
  const [now, setNow] = React.useState(Date.now())
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [saveState, setSaveState] = React.useState('idle')
  const [saveError, setSaveError] = React.useState('')
  const [copyMessage, setCopyMessage] = React.useState('')
  const loadRequest = React.useRef(null)
  const saveLock = React.useRef('')
  const completedRound = React.useRef('')
  const copyTimer = React.useRef(null)
  const mounted = React.useRef(false)
  const context = React.useRef({ accountKey, roundId: game.roundId })
  context.current = { accountKey, roundId: game.roundId }

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      loadRequest.current?.abort()
      window.clearTimeout(copyTimer.current)
    }
  }, [])

  const loadStatus = React.useCallback(async () => {
    loadRequest.current?.abort()
    if (!accessToken) {
      setStatus({ ...EMPTY_STATUS, loading: false })
      return
    }
    const controller = new AbortController()
    loadRequest.current = controller
    setStatus((previous) => ({ ...previous, loading: true, error: '' }))
    try {
      const response = await fetch('/api/coupons?action=game-status', {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await response.json().catch(() => ({}))
      if (controller.signal.aborted || !mounted.current) return
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível carregar sua partida.')
      setStatus({ ...EMPTY_STATUS, ...data, loading: false })
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        setStatus((previous) => ({
          ...previous,
          loading: false,
          can_play: false,
          error: error.message || 'Não foi possível carregar sua partida.',
        }))
    }
  }, [accessToken])

  React.useEffect(() => {
    loadStatus()
    return () => loadRequest.current?.abort()
  }, [loadStatus])
  React.useEffect(() => {
    dispatch({ type: 'reset' })
    completedRound.current = ''
    setSaveState('idle')
    setSaveError('')
    setCopyMessage('')
  }, [accountKey])
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now())
    }, 1000)
    const onVisible = () => {
      if (!document.hidden) {
        setNow(Date.now())
        loadStatus()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadStatus])

  React.useEffect(() => {
    if (game.phase !== 'playing' || game.flipped.length !== 2) return
    const [first, second] = game.flipped
    const timer = window.setTimeout(
      () => dispatch({ type: 'resolve', now: Date.now() }),
      game.deck[first].icon === game.deck[second].icon ? 180 : 650
    )
    return () => window.clearTimeout(timer)
  }, [game.phase, game.flipped, game.deck])

  const saveResult = React.useCallback(
    async (payload, roundId) => {
      const key = `${accountKey}:${roundId}`
      if (!accessToken || saveLock.current === key) return
      saveLock.current = key
      const stillCurrent = () =>
        mounted.current &&
        context.current.accountKey === accountKey &&
        context.current.roundId === roundId
      setSaveState('sending')
      setSaveError('')
      try {
        const response = await fetch('/api/coupons?action=game-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (!stillCurrent()) return
        if (!response.ok)
          throw new Error(data.error || 'Não foi possível registrar a partida.')
        setSaveState('saved')
        if (data.coupon?.code) {
          setStatus((previous) => ({
            ...previous,
            coupon: data.coupon,
            can_play: false,
            played: true,
          }))
          trackEvent('memory_game_win', {
            coupon_code: data.coupon.code,
            attempts: payload.attempts,
            errors: payload.errors,
          })
        }
        await loadStatus()
      } catch (error) {
        if (stillCurrent()) {
          setSaveState('error')
          setSaveError(error.message || 'Não foi possível registrar a partida.')
        }
      } finally {
        if (saveLock.current === key) saveLock.current = ''
      }
    },
    [accessToken, accountKey, loadStatus]
  )

  React.useEffect(() => {
    if (!['won', 'lost'].includes(game.phase)) return
    const key = `${accountKey}:${game.roundId}`
    if (completedRound.current === key) return
    completedRound.current = key
    saveResult(memoryResult(game), game.roundId)
  }, [game, accountKey, saveResult])

  const isVip = Boolean(status.vip?.isVip)
  const reset = nextGameReset(isVip, new Date(now))
  const resetKey = `${isVip}:${reset.getTime()}`
  const previousReset = React.useRef(resetKey)
  React.useEffect(() => {
    if (status.loading) return
    if (previousReset.current !== resetKey) {
      previousReset.current = resetKey
      if (game.phase !== 'playing' && saveState !== 'sending') {
        dispatch({ type: 'reset' })
        setSaveState('idle')
        loadStatus()
      }
    }
  }, [resetKey, status.loading, game.phase, saveState, loadStatus])

  const matchedPairs = game.deck.filter((card) => card.matched).length / 2
  const finished = ['won', 'lost'].includes(game.phase)
  const won =
    game.phase === 'won' || (game.phase === 'idle' && status.session?.won)
  const elapsed = game.startedAt
    ? Math.max(
        0,
        Math.floor(((game.finishedAt ?? now) - game.startedAt) / 1000)
      )
    : 0
  const canStart = Boolean(
    accessToken && status.can_play && !status.loading && saveState !== 'sending'
  )
  const countdown = formatGameCountdown(reset.getTime() - now)

  function startGame() {
    if (!accessToken) {
      onRequireLogin?.('Faça login para jogar e receber seu cupom.')
      return
    }
    if (!canStart || finished) return
    setSaveState('idle')
    setSaveError('')
    dispatch({ type: 'start', deck: buildMemoryDeck() })
  }

  async function copyCoupon() {
    const copied = await copyText(status.coupon?.code)
    if (!mounted.current) return
    setCopyMessage(
      copied ? 'Cupom copiado!' : 'Selecione o código e copie manualmente.'
    )
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyMessage(''), 3200)
  }

  return (
    <main className="customer-page cubo-game">
      <section className="container-cc customer-page-inner">
        <header className="customer-page-heading">
          <div>
            <p className="customer-eyebrow">Jogue. Combine. Ganhe.</p>
            <h1>Cubo Game</h1>
            <p className="customer-subtitle">
              Encontre os seis pares e desbloqueie seu cupom.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoHome}
            className="customer-secondary"
            aria-label="Voltar para a loja"
          >
            <span className="material-icons" aria-hidden="true">
              arrow_back
            </span>
            <span>Loja</span>
          </button>
        </header>

        <div className="game-layout">
          <section
            className="customer-surface game-board-section"
            aria-labelledby="game-board-title"
          >
            <div className="game-board-heading">
              <div>
                <h2 id="game-board-title">Jogo da memória</h2>
                <p>
                  {game.phase === 'playing'
                    ? 'Toque em duas cartas para encontrar um par.'
                    : 'Uma pequena pausa, uma nova recompensa.'}
                </p>
              </div>
              <button
                type="button"
                className="customer-icon-button"
                onClick={() => setHelpOpen((value) => !value)}
                aria-label="Como jogar"
                aria-expanded={helpOpen}
                aria-controls="game-instructions"
              >
                <span className="material-icons" aria-hidden="true">
                  help_outline
                </span>
              </button>
            </div>
            {helpOpen && (
              <div id="game-instructions" className="game-instructions">
                <h3>Como jogar</h3>
                <ol>
                  <li>Inicie a partida e vire duas cartas por vez.</li>
                  <li>
                    Encontre os seis pares antes de atingir {MAX_GAME_ERRORS}{' '}
                    erros.
                  </li>
                  <li>
                    {isVip
                      ? 'Como VIP, você tem uma partida por dia.'
                      : 'Cada conta tem uma partida por semana.'}
                  </li>
                  <li>Vença sem erros para liberar o cupom especial de 20%.</li>
                </ol>
                <p>
                  A rodada é registrada ao terminar. Seu cupom aparece aqui e em
                  “Meus cupons” no carrinho.
                </p>
              </div>
            )}
            <div className="game-stats" aria-label="Progresso da partida">
              <div>
                <span>Pares</span>
                <strong>
                  {matchedPairs}
                  <small>/6</small>
                </strong>
              </div>
              <div>
                <span>Erros</span>
                <strong className={game.errors >= 5 ? 'text-rose-300' : ''}>
                  {game.errors}
                  <small>/{MAX_GAME_ERRORS}</small>
                </strong>
              </div>
              <div>
                <span>Tentativas</span>
                <strong>{game.attempts}</strong>
              </div>
              <div>
                <span>Tempo</span>
                <strong>
                  {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                  {String(elapsed % 60).padStart(2, '0')}
                </strong>
              </div>
            </div>
            <div
              className="game-progress"
              role="progressbar"
              aria-label="Pares encontrados"
              aria-valuemin={0}
              aria-valuemax={6}
              aria-valuenow={matchedPairs}
            >
              <span style={{ width: `${(matchedPairs / 6) * 100}%` }} />
            </div>

            <div
              className="game-cards"
              role="group"
              aria-label="Cartas do jogo da memória"
            >
              {game.deck.map((card, index) => {
                const revealed = card.matched || game.flipped.includes(index)
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`game-card ${revealed ? 'is-revealed' : ''} ${card.matched ? 'is-matched' : ''}`}
                    disabled={
                      game.phase !== 'playing' ||
                      card.matched ||
                      game.flipped.length === 2 ||
                      !status.can_play
                    }
                    aria-label={`Carta ${index + 1}, ${card.matched ? `par encontrado: ${card.icon}` : revealed ? card.icon : 'fechada'}`}
                    aria-pressed={revealed}
                    onClick={() =>
                      dispatch({ type: 'flip', index, now: Date.now() })
                    }
                  >
                    <span className="game-card-symbol" aria-hidden="true">
                      {revealed ? card.icon : '✦'}
                    </span>
                    {card.matched && (
                      <span
                        className="material-icons game-card-check"
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="game-board-footer" aria-live="polite">
              {status.error ? (
                <div className="customer-alert" role="alert">
                  <p>{status.error}</p>
                  <button
                    type="button"
                    className="customer-secondary"
                    onClick={loadStatus}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : finished || status.played ? (
                <div className={`game-result ${won ? 'is-win' : ''}`}>
                  <span className="material-icons" aria-hidden="true">
                    {won ? 'emoji_events' : 'sports_esports'}
                  </span>
                  <div>
                    <h3>
                      {won
                        ? game.errors === 0 && finished
                          ? 'Partida perfeita!'
                          : 'Você encontrou todos os pares!'
                        : 'Rodada encerrada'}
                    </h3>
                    <p>
                      {saveState === 'sending'
                        ? 'Registrando sua partida…'
                        : saveState === 'error'
                          ? 'Sua partida terminou. Reenvie o resultado para confirmar o registro.'
                          : status.coupon?.code
                            ? 'Seu cupom está disponível logo abaixo.'
                            : `Uma nova chance em ${countdown}.`}
                    </p>
                  </div>
                </div>
              ) : game.phase === 'playing' ? (
                <p className="game-hint">
                  {game.errors >= 5
                    ? `Atenção: restam ${MAX_GAME_ERRORS - game.errors} erros.`
                    : 'Memorize as posições e encontre os pares.'}
                </p>
              ) : (
                <div className="game-start">
                  <p>
                    {!accessToken
                      ? 'Entre na sua conta para jogar e guardar sua recompensa.'
                      : status.loading
                        ? 'Preparando sua rodada…'
                        : 'Seu tempo começa quando você vira a primeira carta.'}
                  </p>
                  <button
                    type="button"
                    className="customer-primary"
                    disabled={Boolean(accessToken && !canStart)}
                    onClick={startGame}
                  >
                    <span className="material-icons" aria-hidden="true">
                      {accessToken ? 'play_arrow' : 'login'}
                    </span>
                    {!accessToken
                      ? 'Entrar para jogar'
                      : status.loading
                        ? 'Carregando…'
                        : 'Iniciar partida'}
                  </button>
                </div>
              )}
              {saveError && (
                <div className="customer-alert" role="alert">
                  <p>{saveError}</p>
                  <button
                    type="button"
                    className="customer-primary"
                    onClick={() => saveResult(memoryResult(game), game.roundId)}
                  >
                    Reenviar resultado
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside
            className="game-rewards"
            aria-label="Recompensas e próxima rodada"
          >
            <section className="customer-surface game-reward-card">
              <div className="game-reward-label">
                <span className="material-icons" aria-hidden="true">
                  redeem
                </span>
                <p className="customer-eyebrow">Recompensa da semana</p>
              </div>
              <h2>
                {status.weekly_reward?.label ||
                  (status.loading
                    ? 'Carregando…'
                    : 'Vença para liberar seu cupom')}
              </h2>
              <p>
                Complete o tabuleiro para conquistar a recompensa. Sem erros?
                Seu cupom será de 20%.
              </p>
              {status.coupon?.code && (
                <div className="game-coupon">
                  <span>Seu cupom</span>
                  <code>{status.coupon.code}</code>
                  <button
                    type="button"
                    className="customer-primary"
                    onClick={copyCoupon}
                  >
                    <span className="material-icons" aria-hidden="true">
                      content_copy
                    </span>
                    Copiar cupom
                  </button>
                  {copyMessage && <p role="status">{copyMessage}</p>}
                  <button
                    type="button"
                    className="customer-secondary"
                    onClick={() => navigateClient('/catalogo')}
                  >
                    Escolher meus produtos
                    <span className="material-icons" aria-hidden="true">
                      arrow_forward
                    </span>
                  </button>
                  {status.coupon.expires_at && (
                    <p className="game-coupon-validity">
                      Validade:{' '}
                      {new Date(status.coupon.expires_at).toLocaleDateString(
                        'pt-BR'
                      )}
                    </p>
                  )}
                </div>
              )}
            </section>
            <section className="customer-surface game-next-round">
              <span className="material-icons" aria-hidden="true">
                {isVip ? 'workspace_premium' : 'schedule'}
              </span>
              <div>
                <h2>
                  {isVip
                    ? 'Você joga todos os dias'
                    : 'Uma nova rodada por semana'}
                </h2>
                <p>Próxima liberação em</p>
                <strong>{countdown}</strong>
                {!isVip && (
                  <button
                    type="button"
                    onClick={() => navigateClient('/planos-vip')}
                    className="customer-text-button"
                  >
                    Conhecer os benefícios VIP
                    <span className="material-icons" aria-hidden="true">
                      arrow_forward
                    </span>
                  </button>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
