// =====================================================
// WebSocket 事件类型定义
// =====================================================

// -------- WS 事件名 --------
export const WS_EVENTS = {
  // Admin → Server
  COMPETITION_START: 'competition.start',
  COMPETITION_PAUSE: 'competition.pause',
  COMPETITION_RESUME: 'competition.resume',
  COMPETITION_FINISH: 'competition.finish',
  ROUND_START: 'round.start',
  ROUND_FINISH: 'round.finish',
  QUESTION_SHOW: 'question.show',
  QUESTION_NEXT: 'question.next',
  BUZZER_OPEN: 'buzzer.open',
  BUZZER_CLOSE: 'buzzer.close',
  SCORE_ADJUST: 'score.adjust',
  SCORE_CONFIRM: 'score.confirm',
  JUDGE_START: 'judge.start',
  TIMER_START: 'timer.start',
  TIMER_STOP: 'timer.stop',

  // Player → Server
  PLAYER_BUZZ: 'player.buzz',
  PLAYER_LOGIN: 'player.login',

  // Judge → Server
  JUDGE_SUBMIT: 'judge.submit',

  // Server → All
  STATE_COMPETITION: 'state.competition',
  STATE_ROUND: 'state.round',
  STATE_ROUND_RESULTS: 'state.round.results',
  STATE_QUESTION: 'state.question',
  STATE_TIMER: 'state.timer',
  STATE_BUZZER_RESULT: 'state.buzzer.result',
  STATE_BUZZER_VIOLATION: 'state.buzzer.violation',
  STATE_SCORE: 'state.score',
  STATE_RANKING: 'state.ranking',
  STATE_JUDGE_PROGRESS: 'state.judge.progress',
  STATE_COMPETITION_FINISH: 'state.competition.finish',
} as const

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS]

// -------- WS 消息格式 --------
export interface WsMessage {
  type: WsEventType
  payload: Record<string, unknown>
  timestamp: number
  operator?: string
}

// -------- 具体 Payload 类型 --------
export interface BuzzerOpenPayload {
  competitionId: string
  questionId: string
  startTime: number // T0 毫秒时间戳
}

export interface BuzzerResultPayload {
  playerId: string
  teamId: string
  teamName: string
  playerDisplayId: string // e.g. "3-2"
  rank: number
  latencyMs: number
  status: 'first' | 'later' | 'too_early' | 'timeout'
}

export interface ScoreUpdatePayload {
  playerId: string
  teamId: string
  scoreChange: number
  newPlayerTotal: number
  newTeamTotal: number
}

export interface RankingPayload {
  rankings: {
    teamId: string
    teamName: string
    score: number
  }[]
}

export interface TimerSyncPayload {
  remainingSec: number
  totalSec: number
  status: 'running' | 'paused' | 'stopped'
}

export interface QuestionShowPayload {
  questionId: string
  content: string
  type: string
  options?: string[]
  scoreValue: number
  playerId?: string
  playerDisplayId?: string
}
