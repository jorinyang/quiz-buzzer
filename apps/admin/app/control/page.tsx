'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Play, Square, SkipForward, Timer, Zap, CheckCircle, XCircle, Clock } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

export default function ControlPage() {
  const [competition, setCompetition] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(-1)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [players, setPlayers] = useState<any[]>([])
  const [timerRunning, setTimerRunning] = useState(false)
  const [remainingSec, setRemainingSec] = useState(10)
  const [buzzerOpen, setBuzzerOpen] = useState(false)
  const [buzzerResult, setBuzzerResult] = useState<any>(null)
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = getSupabase()

  // Load competitions
  useEffect(() => {
    supabase.from('competitions').select('*, rounds(*)').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) {
          setCompetition(data)
          setRounds(data.rounds || [])
        }
      })
  }, [])

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'state.buzzer.result' && msg.payload?.status === 'first') {
          setBuzzerResult(msg.payload)
          setBuzzerOpen(false)
        }
      } catch(e) {}
    }

    return () => ws.close()
  }, [])

  function send(type: string, payload: any = {}) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    }
  }

  // Timer logic
  useEffect(() => {
    if (timerRunning && remainingSec > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSec((prev: number) => {
          if (prev <= 0.1) {
            setTimerRunning(false)
            return 0
          }
          return prev - 0.1
        })
      }, 100)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  // Load players
  useEffect(() => {
    supabase.from('users').select('*, teams(name)').eq('role', 'player').order('created_at')
      .then(({ data }) => setPlayers(data || []))
  }, [])

  const selectRound = useCallback(async (round: any) => {
    setCurrentRound(round)
    setCurrentQIndex(-1)
    setBuzzerResult(null)
    setBuzzerOpen(false)

    const { data } = await supabase.from('questions').select('*').eq('round_id', round.id).order('sort_order')
    setQuestions(data || [])

    send('round.start', { competitionId: competition?.id, roundId: round.id, title: round.title, roundType: round.round_type })
  }, [competition])

  const showQuestion = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentQIndex(index)
    const q = questions[index]

    // For required rounds, determine the current player
    let playerId = null, playerDisplayId = null
    if (currentRound?.round_type === 'required' && players.length > 0) {
      const p = players[currentPlayerIndex % players.length]
      playerId = p.id
      playerDisplayId = `${Math.floor(currentPlayerIndex / 3) + 1}-${(currentPlayerIndex % 3) + 1}`
    }

    send('question.show', {
      competitionId: competition?.id,
      questionId: q.id,
      content: q.content,
      type: q.type,
      options: q.options,
      scoreValue: q.score_value,
      playerId,
      playerDisplayId,
    })

    // Auto-start timer for required questions
    if (currentRound?.round_type === 'required') {
      const limit = currentRound?.config?.timeLimit || 10
      setRemainingSec(limit)
      setTimerRunning(true)
      send('timer.start', { durationSec: limit })
    }
  }, [questions, currentRound, players, currentPlayerIndex, competition])

  const nextQuestion = useCallback(() => {
    const next = currentQIndex + 1
    if (next >= questions.length) {
      alert('当前环节题目已用完')
      return
    }
    setBuzzerResult(null)
    setBuzzerOpen(false)
    setTimerRunning(false)

    // Move to next player for required rounds
    if (currentRound?.round_type === 'required') {
      setCurrentPlayerIndex((prev: number) => (prev + 1) % players.length)
    }

    showQuestion(next)
  }, [currentQIndex, questions, currentRound, players, showQuestion])

  const openBuzzer = useCallback(() => {
    if (!questions[currentQIndex]) return
    setBuzzerOpen(true)
    setBuzzerResult(null)
    setRemainingSec(10)
    setTimerRunning(true)
    send('buzzer.open', {
      competitionId: competition?.id,
      questionId: questions[currentQIndex].id,
    })
  }, [questions, currentQIndex, competition])

  const confirmScore = useCallback((correct: boolean) => {
    const q = questions[currentQIndex]
    if (!q) return
    const config = currentRound?.config || {}
    const scoreChange = correct ? (config.scoreCorrect || q.score_value) : (config.scoreWrong || 0)
    send('score.confirm', { questionId: q.id, correct, scoreValue: config.scoreCorrect || 10, penaltyValue: config.scoreWrong || 0 })
    setTimerRunning(false)
    send('timer.stop', {})
  }, [questions, currentQIndex, currentRound])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">🎮 比赛控制台</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {connected ? '🟢 已连接' : '🔴 未连接'}
          </span>
          <span className="text-sm text-gray-500">WebSocket: {WS_URL}</span>
        </div>
      </div>

      {!competition ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <p className="text-gray-500 text-lg">暂无可用的比赛。请先在比赛管理中创建比赛。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Round & Question Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Round Selection */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📋 选择环节</h3>
              <div className="flex gap-3">
                {rounds.map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => selectRound(r)}
                    className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                      currentRound?.id === r.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold">{r.round_order}. {r.title.split(' - ')[0]}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {r.round_type === 'required' ? '必答' : r.round_type === 'buzzer' ? '抢答' : '模拟调解'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Control */}
            {currentRound && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">
                    📖 题目控制
                    {questions.length > 0 && (
                      <span className="text-gray-500 font-normal ml-2">
                        {currentQIndex + 1} / {questions.length}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span className={`font-mono text-lg font-bold ${
                      remainingSec <= 3 && timerRunning ? 'text-red-600 animate-pulse' : ''
                    }`}>
                      {remainingSec.toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Current Question Preview */}
                {currentQIndex >= 0 && questions[currentQIndex] && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <span className="text-xs font-medium text-blue-600 mb-1 block">
                      {questions[currentQIndex].type === 'choice' ? '选择题' :
                       questions[currentQIndex].type === 'true_false' ? '判断题' :
                       questions[currentQIndex].type === 'fill_blank' ? '填空题' : '简答题'}
                      {' · '}{questions[currentQIndex].score_value}分
                    </span>
                    <p className="text-lg mb-2">{questions[currentQIndex].content}</p>
                    {questions[currentQIndex].options && (
                      <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">
                        {(questions[currentQIndex].options as string[]).map((opt: string, i: number) => (
                          <span key={i}>{opt}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-green-600 mt-2">
                      答案：{questions[currentQIndex].answer}
                    </p>
                  </div>
                )}

                {currentQIndex < 0 ? (
                  <button
                    onClick={() => showQuestion(0)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                  >
                    开始答题 · 显示第1题
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Score buttons for required rounds */}
                    {currentRound.round_type === 'required' && (
                      <div className="flex gap-3">
                        <button onClick={() => confirmScore(true)} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2">
                          <CheckCircle className="w-5 h-5" /> 正确 +{currentRound.config?.scoreCorrect || 10}
                        </button>
                        <button onClick={() => confirmScore(false)} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 flex items-center justify-center gap-2">
                          <XCircle className="w-5 h-5" /> 错误
                        </button>
                        <button onClick={() => confirmScore(false)} className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 flex items-center justify-center gap-2">
                          <Clock className="w-5 h-5" /> 超时
                        </button>
                      </div>
                    )}

                    {/* Buzzer button */}
                    {currentRound.round_type === 'buzzer' && (
                      <div>
                        <button
                          onClick={openBuzzer}
                          disabled={buzzerOpen}
                          className={`w-full py-4 rounded-lg font-bold text-xl transition-all ${
                            buzzerOpen
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200 animate-pulse'
                          }`}
                        >
                          <Zap className="w-6 h-6 inline mr-2" />
                          {buzzerOpen ? '抢答进行中...' : '开始抢答'}
                        </button>
                        {buzzerResult && (
                          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-lg font-bold text-green-700">
                              🎯 {buzzerResult.teamName} · {buzzerResult.playerDisplayId} 抢答成功！
                            </p>
                            <p className="text-sm text-green-600">延迟：{buzzerResult.latencyMs}ms</p>
                            <div className="flex gap-3 mt-3">
                              <button onClick={() => confirmScore(true)} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                                答对 +10
                              </button>
                              <button onClick={() => confirmScore(false)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">
                                答错 -10
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => showQuestion(currentQIndex - 1)}
                        disabled={currentQIndex <= 0}
                        className="flex-1 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
                      >
                        上一题
                      </button>
                      <button
                        onClick={nextQuestion}
                        disabled={currentQIndex >= questions.length - 1}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" /> 下一题
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Status Panel */}
          <div className="space-y-6">
            {/* Competition Status */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📊 状态信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">比赛</span>
                  <span className="font-medium">{competition.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">状态</span>
                  <span className={
                    competition.status === 'active' ? 'text-green-600' :
                    competition.status === 'paused' ? 'text-yellow-600' : 'text-blue-600'
                  }>{competition.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">当前环节</span>
                  <span>{currentRound?.title || '未选择'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">题目进度</span>
                  <span>{currentQIndex + 1} / {questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">计时器</span>
                  <span>{timerRunning ? '运行中' : '停止'}</span>
                </div>
              </div>
            </div>

            {/* Players */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">👥 选手列表 ({players.length})</h3>
              <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
                {players.map((p: any, i: number) => (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded ${
                    currentRound?.round_type === 'required' && i === currentPlayerIndex % players.length
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}>
                    <span>{p.display_name}</span>
                    <span className="text-gray-400">{p.teams?.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">⚡ 快捷操作</h3>
              <div className="space-y-2">
                <button
                  onClick={() => send('competition.start', { competitionId: competition.id })}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> 开始比赛
                </button>
                <button
                  onClick={() => send('competition.pause', {})}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" /> 暂停比赛
                </button>
                <button
                  onClick={() => {
                    if (confirm('确认结束比赛？')) send('competition.finish', { competitionId: competition.id })
                  }}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" /> 结束比赛
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
