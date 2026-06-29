'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Play, Square, SkipForward, Zap, CheckCircle, XCircle, Clock } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

// Dynamic countdown based on question type
function getTimeLimit(round: any, question: any): number {
  if (round?.round_type === 'simulation') return 0 // no timer for simulation
  if (round?.config?.timeLimit) return round.config.timeLimit
  if (!question) return 10
  switch (question.type) {
    case 'choice': return 10
    case 'true_false': return 5
    case 'fill_blank': return 15
    case 'short_answer': return 30
    default: return 10
  }
}

export default function ControlPage() {
  const [competition, setCompetition] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(-1)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [players, setPlayers] = useState<any[]>([])
  const [remainingSec, setRemainingSec] = useState(10)
  const [timerStatus, setTimerStatus] = useState<string>('stopped')
  const [buzzerOpen, setBuzzerOpen] = useState(false)
  const [buzzerResult, setBuzzerResult] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const [teamRankings, setTeamRankings] = useState<any[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const supabase = getSupabase()

  // Load competition
  useEffect(() => {
    supabase.from('competitions').select('*, rounds(*)').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) { setCompetition(data); setRounds(data.rounds || []) }
      })
  }, [])

  // Load players
  useEffect(() => {
    supabase.from('users').select('*, teams(name)').eq('role', 'player').order('created_at')
      .then(({ data }) => setPlayers(data || []))
  }, [])

  // Connect WS + sync timer from server
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'state.timer':
            setRemainingSec(msg.payload.remainingSec as number)
            setTimerStatus(msg.payload.status as string)
            break
          case 'state.buzzer.result':
            if (msg.payload?.status === 'first') {
              setBuzzerResult(msg.payload)
              setBuzzerOpen(false)
            }
            break
        }
      } catch(e) {}
    }
    return () => ws.close()
  }, [])

  // Load rankings
  const loadRankings = useCallback(async () => {
    const { data: teams } = await supabase.from('teams').select('id, name')
    const { data: scores } = await supabase.from('score_records').select('team_id, score_change')
    const map = new Map<string, number>()
    for (const s of (scores || [])) map.set(s.team_id, (map.get(s.team_id) || 0) + s.score_change)
    const rankings = (teams || []).map(t => ({ teamId: t.id, teamName: t.name, score: map.get(t.id) || 0 }))
      .sort((a: any, b: any) => b.score - a.score)
    setTeamRankings(rankings)
    return rankings
  }, [supabase])

  useEffect(() => { loadRankings() }, [loadRankings])

  function send(type: string, payload: any = {}) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    }
  }

  const selectRound = useCallback(async (round: any) => {
    setCurrentRound(round)
    setCurrentQIndex(-1)
    setBuzzerResult(null)
    setBuzzerOpen(false)
    setTimerStatus('stopped')
    send('round.start', { competitionId: competition?.id, roundId: round.id, title: round.title, roundType: round.round_type })
    const { data } = await supabase.from('questions').select('*').eq('round_id', round.id).order('sort_order')
    setQuestions(data || [])
  }, [competition, supabase])

  const showQuestion = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentQIndex(index)
    setBuzzerResult(null)
    setBuzzerOpen(false)
    const q = questions[index]
    const limit = getTimeLimit(currentRound, q)

    let playerId = null, playerDisplayId = null
    if (currentRound?.round_type === 'required' && players.length > 0) {
      const p = players[currentPlayerIndex % players.length]
      playerId = p.id
      const teamIdx = Math.floor(currentPlayerIndex / 3)
      const playerIdx = (currentPlayerIndex % 3)
      playerDisplayId = `${teamIdx + 1}-${playerIdx + 1}`
    }

    send('question.show', {
      competitionId: competition?.id,
      questionId: q.id, content: q.content, type: q.type, options: q.options,
      scoreValue: q.score_value, playerId, playerDisplayId, roundType: currentRound?.round_type,
    })

    if (currentRound?.round_type !== 'simulation' && limit > 0) {
      send('timer.start', { durationSec: limit })
    }
  }, [questions, currentRound, players, currentPlayerIndex, competition])

  const nextQuestion = useCallback(() => {
    const next = currentQIndex + 1
    if (next >= questions.length) { alert('当前环节题目已用完'); return }
    setBuzzerResult(null)
    setBuzzerOpen(false)
    setTimerStatus('stopped')
    send('timer.stop', {})
    if (currentRound?.round_type === 'required') {
      setCurrentPlayerIndex((prev: number) => (prev + 1) % players.length)
    }
    showQuestion(next)
  }, [currentQIndex, questions, currentRound, players, showQuestion])

  const openBuzzer = useCallback(() => {
    const q = questions[currentQIndex]
    if (!q) return
    setBuzzerOpen(true)
    setBuzzerResult(null)
    const limit = getTimeLimit(currentRound, q)
    send('buzzer.open', { competitionId: competition?.id, questionId: q.id, durationSec: limit })
  }, [questions, currentQIndex, competition, currentRound])

  const confirmScore = useCallback(async (correct: boolean) => {
    const q = questions[currentQIndex]
    if (!q) return

    // Determine current player and team
    let playerId = 'unknown', teamId = 'unknown', playerName = 'unknown', teamName = 'unknown'
    if (currentRound?.round_type === 'required' && players.length > 0) {
      const p = players[currentPlayerIndex % players.length]
      playerId = p.id; teamId = p.team_id; playerName = p.display_name; teamName = p.teams?.name || ''
    }
    // For buzzer rounds, use the buzzer result
    if (currentRound?.round_type === 'buzzer' && buzzerResult) {
      playerId = buzzerResult.playerId; teamId = buzzerResult.teamId
      playerName = buzzerResult.playerDisplayId || ''; teamName = buzzerResult.teamName || ''
    }

    const config = currentRound?.config || {}
    const scoreChange = correct ? (config.scoreCorrect || q.score_value) : (config.scoreWrong || 0)

    // Save to Supabase
    await supabase.from('score_records').insert({
      competition_id: competition?.id,
      player_id: playerId, team_id: teamId,
      round_id: currentRound?.id, question_id: q.id,
      score_change: scoreChange,
      reason: correct ? '正确' : (scoreChange < 0 ? '错误扣分' : '错误'),
    })

    // Reload rankings
    const rankings = await loadRankings()

    // Broadcast via WS
    send('score.confirm', {
      playerId, teamId, scoreChange, questionId: q.id, correct,
      playerName, teamName,
      rankings,
    })
    send('timer.stop', {})
    setBuzzerResult(null)
  }, [questions, currentQIndex, currentRound, players, currentPlayerIndex, competition, buzzerResult, supabase, loadRankings])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">🎮 比赛控制台</h2>
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
          connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {connected ? '🟢 已连接' : '🔴 未连接'} · {WS_URL}
        </span>
      </div>

      {!competition ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <p className="text-gray-500 text-lg">暂无可用的比赛。请先在比赛管理中创建比赛。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Round Selection */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📋 选择环节</h3>
              <div className="flex gap-3 flex-wrap">
                {rounds.map((r: any) => (
                  <button key={r.id} onClick={() => selectRound(r)}
                    className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                      currentRound?.id === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
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
                    📖 题目控制 <span className="text-gray-500 font-normal ml-2">{currentQIndex + 1} / {questions.length}</span>
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span className={`font-mono text-lg font-bold ${timerStatus === 'running' && remainingSec <= 3 ? 'text-red-600 animate-pulse' : ''}`}>
                      {remainingSec.toFixed(0)}s
                    </span>
                    <span className="text-xs">({timerStatus})</span>
                  </div>
                </div>

                {currentQIndex >= 0 && questions[currentQIndex] && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <span className="text-xs font-medium text-blue-600 mb-1 block">
                      {questions[currentQIndex].type === 'choice' ? '选择题' :
                       questions[currentQIndex].type === 'true_false' ? '判断题' :
                       questions[currentQIndex].type === 'fill_blank' ? '填空题' : '简答题'}
                      {' · '}{questions[currentQIndex].score_value}分
                      {' · 时限：'}{getTimeLimit(currentRound, questions[currentQIndex])}s
                    </span>
                    <p className="text-lg mb-2">{questions[currentQIndex].content}</p>
                    {questions[currentQIndex].options && (
                      <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">
                        {(questions[currentQIndex].options as string[]).map((opt: string, i: number) => <span key={i}>{opt}</span>)}
                      </div>
                    )}
                    <p className="text-sm text-green-600 mt-2">答案：{questions[currentQIndex].answer}</p>
                  </div>
                )}

                {currentQIndex < 0 ? (
                  <button onClick={() => showQuestion(0)} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
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
                          <XCircle className="w-5 h-5" /> 错误（0分）
                        </button>
                        <button onClick={() => confirmScore(false)} className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 flex items-center justify-center gap-2">
                          <Clock className="w-5 h-5" /> 超时（0分）
                        </button>
                      </div>
                    )}

                    {/* Buzzer button */}
                    {currentRound.round_type === 'buzzer' && (
                      <div>
                        <button onClick={openBuzzer} disabled={buzzerOpen}
                          className={`w-full py-4 rounded-lg font-bold text-xl transition-all ${
                            buzzerOpen ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200 animate-pulse'}`}>
                          <Zap className="w-6 h-6 inline mr-2" />{buzzerOpen ? '抢答进行中...' : '开始抢答'}
                        </button>
                        {buzzerResult && (
                          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-lg font-bold text-green-700">🎯 {buzzerResult.teamName} · {buzzerResult.playerDisplayId} 抢答成功！</p>
                            <p className="text-sm text-green-600">延迟：{buzzerResult.latencyMs}ms</p>
                            <div className="flex gap-3 mt-3">
                              <button onClick={() => confirmScore(true)} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">答对 +{currentRound.config?.scoreCorrect || 10}</button>
                              <button onClick={() => confirmScore(false)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">答错 {currentRound.config?.scoreWrong || -10}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Simulation - no timer, just navigation */}
                    {currentRound.round_type === 'simulation' && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-amber-800 font-medium">📝 模拟调解环节 — 选手现场作答，评委打分</p>
                        <p className="text-sm text-amber-600 mt-1">无倒计时限制，选手完成调解后由评委在手机端评分</p>
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-3">
                      <button onClick={() => showQuestion(currentQIndex - 1)} disabled={currentQIndex <= 0}
                        className="flex-1 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30">上一题</button>
                      <button onClick={nextQuestion} disabled={currentQIndex >= questions.length - 1}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2">
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
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📊 状态信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">比赛</span><span className="font-medium">{competition.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">状态</span><span className={competition.status === 'active' ? 'text-green-600' : 'text-blue-600'}>{competition.status}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">当前环节</span><span>{currentRound?.title || '未选择'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">题目进度</span><span>{currentQIndex + 1} / {questions.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">计时器</span><span>{timerStatus}</span></div>
              </div>
            </div>

            {/* Team Rankings */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">🏆 当前排名</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
                {teamRankings.map((t: any, i: number) => (
                  <div key={t.teamId} className={`flex items-center justify-between p-2 rounded ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                    <span>{i + 1}. {t.teamName}</span>
                    <span className="font-bold">{t.score}</span>
                  </div>
                ))}
                {teamRankings.length === 0 && <p className="text-gray-400 text-center py-4">暂无数据</p>}
              </div>
            </div>

            {/* Players */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">👥 选手列表 ({players.length})</h3>
              <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                {players.map((p: any, i: number) => (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded ${currentRound?.round_type === 'required' && i === currentPlayerIndex % players.length ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
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
                <button onClick={() => send('competition.start', { competitionId: competition.id })}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> 开始比赛</button>
                <button onClick={() => send('competition.pause', {})}
                  className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2">
                  <Square className="w-4 h-4" /> 暂停比赛</button>
                <button onClick={() => { if (confirm('确认结束比赛？')) send('competition.finish', { competitionId: competition.id }) }}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2">
                  <Square className="w-4 h-4" /> 结束比赛</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
