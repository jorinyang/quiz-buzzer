// =====================================================
// quiz-buzzer — 共享类型定义
// =====================================================

// ---------- 枚举 ----------
export type UserRole = 'super_admin' | 'activity_admin' | 'operator' | 'judge' | 'player'
export type CompetitionStatus = 'pending' | 'active' | 'paused' | 'finished'
export type RoundType = 'required' | 'buzzer' | 'simulation'
export type RoundStatus = 'pending' | 'active' | 'finished'
export type QuestionType = 'choice' | 'true_false' | 'fill_blank' | 'short_answer'
export type BuzzerStatus = 'too_early' | 'first' | 'later' | 'timeout'

// ---------- 用户 ----------
export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  teamId?: string | null
  team?: Team | null
  createdAt: string
}

export interface AuthUser extends User {
  token: string
}

// ---------- 队伍 ----------
export interface Team {
  id: string
  name: string
  county?: string | null
  leaderName?: string | null
  createdAt: string
}

// ---------- 比赛 ----------
export interface Competition {
  id: string
  name: string
  status: CompetitionStatus
  createdAt: string
  rounds?: Round[]
  questions?: Question[]
}

// ---------- 环节 ----------
export interface Round {
  id: string
  competitionId: string
  roundType: RoundType
  roundOrder: number
  title: string
  config: RoundConfig | null
  status: RoundStatus
  createdAt: string
}

export interface RoundConfig {
  questionCount: number
  timeLimit: number
  scoreCorrect: number
  scoreWrong: number
  scoreNoAnswer: number
}

// ---------- 题目 ----------
export interface Question {
  id: string
  competitionId: string
  roundId?: string | null
  type: QuestionType
  content: string
  options?: string[] | null
  answer: string
  scoreValue: number
  sortOrder: number
  createdAt: string
}

export interface QuestionInput {
  type: QuestionType
  content: string
  options?: string[]
  answer: string
  scoreValue?: number
  roundId?: string
}

// ---------- 计分记录 ----------
export interface ScoreRecord {
  id: string
  competitionId: string
  playerId: string
  teamId: string
  roundId?: string | null
  questionId?: string | null
  scoreChange: number
  reason?: string | null
  operatorId?: string | null
  createdAt: string
}

export interface ScoreAdjustInput {
  playerId: string
  teamId: string
  scoreChange: number
  reason?: string
}

// ---------- 抢答事件 ----------
export interface BuzzerEvent {
  id: string
  competitionId: string
  questionId: string
  playerId: string
  teamId: string
  buzzedAt: string
  latencyMs: number
  status: BuzzerStatus
}

// ---------- 评委打分 ----------
export interface JudgeScore {
  id: string
  competitionId: string
  playerId: string
  judgeId: string
  criterionScores: CriterionScores
  totalScore: number
  comment?: string | null
  createdAt: string
}

export interface CriterionScores {
  lawApply: number
  process: number
  communication: number
  effect: number
}

export interface JudgeScoreInput {
  playerId: string
  criterionScores: CriterionScores
  totalScore: number
  comment?: string
}

// ---------- 排行榜 ----------
export interface RankingEntry {
  rank: number
  teamId: string
  teamName: string
  totalScore: number
  playerScores: { playerId: string; playerName: string; score: number }[]
}

// ---------- API 响应 ----------
export interface ApiResponse<T> {
  success: boolean
  data?: T
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
  error?: {
    code: string
    message: string
  }
}
