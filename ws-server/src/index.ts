// =====================================================
// WebSocket 服务入口 — 抢答实时通信引擎
// =====================================================
import { WebSocketServer, WebSocket } from 'ws'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../.env.local' })

const PORT = parseInt(process.env.WS_PORT || '3080', 10)
const HOST = process.env.WS_HOST || '0.0.0.0'

// ---------- Types ----------
interface Client {
  ws: WebSocket
  type: 'display' | 'admin' | 'player' | 'judge'
  userId?: string
  teamId?: string
  competitionId?: string
}

interface WsMessage {
  type: string
  payload: Record<string, unknown>
  timestamp: number
  operator?: string
}

// ---------- State ----------
const clients = new Map<WebSocket, Client>()

// Timer state
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerRemaining = 0
let timerTotal = 0

// Buzzer state
let activeBuzzer: {
  competitionId: string
  questionId: string
  startTime: number
  responses: Array<{ playerId: string; teamId: string; teamName: string; latencyMs: number; ws: WebSocket }>
  isOpen: boolean
} | null = null

// ---------- Timer Engine ----------
function startTimer(durationSec: number) {
  stopTimer()
  timerRemaining = durationSec
  timerTotal = durationSec

  broadcast('state.timer', { remainingSec: timerRemaining, totalSec: timerTotal, status: 'running' })

  timerInterval = setInterval(() => {
    timerRemaining -= 1
    if (timerRemaining <= 0) {
      timerRemaining = 0
      broadcast('state.timer', { remainingSec: 0, totalSec: timerTotal, status: 'expired' })
      stopTimer()
      return
    }
    broadcast('state.timer', { remainingSec: timerRemaining, totalSec: timerTotal, status: 'running' })
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  broadcast('state.timer', { remainingSec: timerRemaining, totalSec: timerTotal, status: 'stopped' })
}

// ---------- Helpers ----------
function broadcast(type: string, payload: Record<string, unknown>, filter?: (c: Client) => boolean) {
  const msg = JSON.stringify({ type, payload, timestamp: Date.now() })
  for (const [ws, client] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue
    if (filter && !filter(client)) continue
    ws.send(msg)
  }
}

function sendTo(ws: WebSocket, type: string, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
  }
}

// ---------- Event Handlers ----------
function handleMessage(ws: WebSocket, client: Client, msg: WsMessage) {
  const { type, payload } = msg

  switch (type) {

    // --- Admin Events ---
    case 'competition.start':
      broadcast('state.competition', { status: 'active', competitionId: payload.competitionId })
      break

    case 'competition.pause':
      broadcast('state.competition', { status: 'paused' })
      break

    case 'competition.resume':
      broadcast('state.competition', { status: 'active' })
      break

    case 'competition.finish':
      stopTimer()
      broadcast('state.competition', { status: 'finished' })
      broadcast('state.competition.finish', payload)
      break

    case 'round.start':
      stopTimer()
      activeBuzzer = null
      broadcast('state.round', { round: payload, status: 'active' })
      break

    case 'round.finish':
      stopTimer()
      if (payload.rankings) {
        broadcast('state.round.results', { roundId: payload.roundId, rankings: payload.rankings })
      }
      break

    case 'question.show':
      broadcast('state.question', {
        questionId: payload.questionId,
        content: payload.content,
        type: payload.type,
        options: payload.options,
        scoreValue: payload.scoreValue,
        playerId: payload.playerId || null,
        playerDisplayId: payload.playerDisplayId || null,
        roundType: payload.roundType || null,
      })
      break

    case 'question.next':
      stopTimer()
      activeBuzzer = null
      broadcast('state.question', { action: 'next', questionIndex: payload.questionIndex, totalQuestions: payload.totalQuestions })
      break

    case 'buzzer.open':
      activeBuzzer = {
        competitionId: payload.competitionId as string,
        questionId: payload.questionId as string,
        startTime: Date.now(),
        responses: [],
        isOpen: true,
      }
      startTimer(payload.durationSec as number || 10)
      broadcast('state.buzzer.result', { status: 'open', startTime: activeBuzzer.startTime })
      break

    case 'buzzer.close':
      if (activeBuzzer) activeBuzzer.isOpen = false
      activeBuzzer = null
      stopTimer()
      broadcast('state.buzzer.result', { status: 'closed' })
      break

    case 'score.adjust':
      broadcast('state.score', {
        playerId: payload.playerId,
        teamId: payload.teamId,
        scoreChange: payload.scoreChange,
        reason: payload.reason,
      })
      if (payload.rankings) {
        broadcast('state.ranking', { rankings: payload.rankings })
      }
      break

    case 'score.confirm':
      stopTimer()
      broadcast('state.score', {
        playerId: payload.playerId,
        teamId: payload.teamId,
        scoreChange: payload.scoreChange,
        questionId: payload.questionId,
        correct: payload.correct,
      })
      if (payload.rankings) {
        broadcast('state.ranking', { rankings: payload.rankings })
      }
      break

    case 'timer.start':
      startTimer(payload.durationSec as number || 10)
      break

    case 'timer.stop':
      stopTimer()
      break

    case 'judge.start':
      broadcast('state.judge.progress', { playerId: payload.playerId, submitted: 0, total: payload.totalJudges || 5 })
      break

    // --- Player Events ---
    case 'player.login':
      client.type = payload.role === 'judge' ? 'judge' : 'player'
      client.userId = payload.userId as string
      client.teamId = payload.teamId as string
      client.competitionId = payload.competitionId as string
      sendTo(ws, 'player.login', { success: true, userId: client.userId })
      break

    case 'player.submit_answer':
      // Player submitted answer for required rounds (choice/tf/fill/short)
      broadcast('state.player_answer', {
        playerId: payload.playerId,
        teamId: payload.teamId,
        teamName: payload.teamName || '',
        playerName: payload.playerName || '',
        answer: payload.answer,
        questionId: payload.questionId,
      })
      break

    case 'player.buzz':
      if (!activeBuzzer || !activeBuzzer.isOpen) {
        sendTo(ws, 'state.buzzer.violation', { reason: '抢答尚未开始' })
        return
      }

      const now = Date.now()
      const latencyMs = now - activeBuzzer.startTime

      if (latencyMs < 0) {
        sendTo(ws, 'state.buzzer.violation', {
          playerId: payload.playerId,
          teamId: payload.teamId,
          reason: '提前抢答！',
        })
        broadcast('state.buzzer.violation', {
          playerId: payload.playerId,
          teamId: payload.teamId,
          teamName: payload.teamName || '',
          reason: '提前抢答！',
          playerDisplayId: payload.playerDisplayId || '',
        })
        return
      }

      if (activeBuzzer.responses.some(r => r.playerId === payload.playerId)) return

      const response = {
        playerId: payload.playerId as string,
        teamId: payload.teamId as string,
        teamName: (payload.teamName as string) || '',
        latencyMs,
        ws,
      }
      activeBuzzer.responses.push(response)

      const rank = activeBuzzer.responses.length

      if (rank === 1) {
        stopTimer()
        broadcast('state.buzzer.result', {
          playerId: response.playerId,
          teamId: response.teamId,
          teamName: response.teamName,
          playerDisplayId: payload.playerDisplayId || '',
          rank: 1,
          latencyMs,
          status: 'first',
        })
      } else {
        sendTo(ws, 'state.buzzer.result', {
          playerId: response.playerId,
          teamId: response.teamId,
          rank,
          latencyMs,
          status: 'later',
        })
      }
      break

    // --- Judge Events ---
    case 'judge.submit':
      broadcast('state.judge.progress', {
        playerId: payload.playerId,
        judgeId: payload.judgeId,
        submitted: payload.submittedCount || 1,
        total: payload.totalJudges || 5,
        totalScore: payload.totalScore,
      })
      break
  }
}

// ---------- Server ----------
const wss = new WebSocketServer({ host: HOST, port: PORT })

wss.on('listening', () => {
  console.log(`🔌 WebSocket server running on ws://${HOST}:${PORT}`)
})

wss.on('connection', (ws: WebSocket) => {
  const client: Client = { ws, type: 'display' }
  clients.set(ws, client)

  console.log(`✅ Client connected. Total: ${clients.size}`)

  ws.on('message', (data: Buffer) => {
    try {
      const msg: WsMessage = JSON.parse(data.toString())
      handleMessage(ws, client, msg)
    } catch (e) {
      console.error('Invalid message:', e)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`❌ Client disconnected. Total: ${clients.size}`)
  })

  ws.on('error', (err) => {
    console.error('WS error:', err)
    clients.delete(ws)
  })

  sendTo(ws, 'state.competition', {
    status: 'connected',
    message: '已连接到抢答服务',
    wsPort: PORT,
  })
})

process.on('SIGINT', () => {
  console.log('\nShutting down...')
  wss.close()
  process.exit(0)
})
