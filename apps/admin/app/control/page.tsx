'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Play, Square, SkipForward, Zap, CheckCircle, XCircle, Clock } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

type QuestionType = 'choice' | 'true_false' | 'fill_blank' | 'short_answer'

function getTimeLimit(round: any, question: any): number {
  if (round?.round_type === 'simulation') return 0
  if (round?.config?.timeLimit) return round.config.timeLimit
  const limits: Record<QuestionType, number> = { choice: 10, true_false: 5, fill_blank: 15, short_answer: 30 }
  return limits[question?.type as QuestionType] || 10
}

function autoGrade(question: any, answer: string, qType: QuestionType): boolean {
  if (qType === 'short_answer') return false
  const correct = question.answer?.toString().trim().toUpperCase()
  const given = answer?.toString().trim().toUpperCase()
  return correct === given
}

export default function ControlPage() {
  const [competition, setCompetition] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [currentRound, setCurrentRound] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(-1)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [players, setPlayers] = useState<any[]>([])
  const [remainingSec, setRemainingSec] = useState(0)
  const [timerStatus, setTimerStatus] = useState<string>('stopped')
  const [buzzerOpen, setBuzzerOpen] = useState(false)
  const [buzzerResult, setBuzzerResult] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const [teamRankings, setTeamRankings] = useState<any[]>([])
  const [playerTotals, setPlayerTotals] = useState<Record<string, number>>({})
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, string>>({})
  const [awaitingJudge, setAwaitingJudge] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const supabase = getSupabase()

  useEffect(() => {
    supabase.from('competitions').select('*, rounds(*)').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) { setCompetition(data); setRounds(data.rounds || []) } })
    supabase.from('users').select('*, teams(name)').eq('role', 'player').order('created_at')
      .then(({ data }) => setPlayers(data || []))
  }, [])

  useEffect(() => { connectWs(); return () => { wsRef.current?.close() } }, [])

  const loadRankings = useCallback(async () => {
    const [teamsRes, scoresRes] = await Promise.all([
      supabase.from('teams').select('id, name'),
      supabase.from('score_records').select('team_id, player_id, score_change'),
    ])
    const teamMap = new Map<string, number>()
    const playerMap: Record<string, number> = {}
    for (const s of (scoresRes.data || [])) {
      teamMap.set(s.team_id, (teamMap.get(s.team_id) || 0) + s.score_change)
      playerMap[s.player_id] = (playerMap[s.player_id] || 0) + s.score_change
    }
    const rankings = (teamsRes.data || []).map(t => ({ teamId: t.id, teamName: t.name, score: teamMap.get(t.id) || 0 }))
      .sort((a: any, b: any) => b.score - a.score)
    setTeamRankings(rankings)
    setPlayerTotals(playerMap)
    return rankings
  }, [supabase])

  useEffect(() => { loadRankings() }, [loadRankings])

  function connectWs() {
    const ws = new WebSocket(WS_URL); wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setTimeout(connectWs, 2000) }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'state.timer':
            setRemainingSec(msg.payload.remainingSec as number)
            setTimerStatus(msg.payload.status as string)
            break
          case 'state.buzzer.result':
            if (msg.payload?.status === 'first') onBuzzerResult(msg.payload)
            break
          case 'state.player_answer':
            handlePlayerAnswer(msg.payload)
            break
        }
      } catch(e) {}
    }
  }

  function send(type: string, payload: any = {}) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    }
  }

  async function handlePlayerAnswer(payload: any) {
    const { playerId, teamId, teamName, playerName, answer } = payload
    setPlayerAnswers(prev => ({ ...prev, [playerId]: answer }))
    const q = questions[currentQIndex]
    if (!q) return
    const qType = q.type as QuestionType
    if (qType === 'short_answer') {
      setAwaitingJudge(playerId)
    } else {
      const isCorrect = autoGrade(q, answer, qType)
      await applyScore(playerId, teamId, playerName, teamName, isCorrect, answer)
    }
  }

  async function applyScore(playerId: string, teamId: string, playerName: string, teamName: string, correct: boolean, answer?: string) {
    const q = questions[currentQIndex]
    if (!q) return
    const config = currentRound?.config || {}
    const isBuzzer = currentRound?.round_type === 'buzzer'
    // 必答: 正确=+10, 错误=0.  抢答: 正确=+10, 错误=-10.
    const scoreChange = correct
      ? (config.scoreCorrect || q.score_value)
      : (isBuzzer ? (config.scoreWrong || -10) : 0)

    // Save player score record
    await supabase.from('score_records').insert({
      competition_id: competition?.id,
      player_id: playerId, team_id: teamId,
      round_id: currentRound?.id, question_id: q.id,
      score_change: scoreChange,
      reason: correct ? `正确 (${answer || ''})` : (isBuzzer ? `错误 (${answer || ''}) 扣分` : `错误 (${answer || ''})`),
    })

    // 必答正确且非抢答: 团队也加10分 (队员得分已记录, 团队需要单独的记录)
    // 抢答: 团队分已经通过玩家分体现(抢答score属于team), 不需要额外记录
    if (correct && !isBuzzer) {
      await supabase.from('score_records').insert({
        competition_id: competition?.id,
        player_id: playerId, team_id: teamId,
        round_id: currentRound?.id, question_id: q.id,
        score_change: config.scoreCorrect || q.score_value,
        reason: `团队加分 (${playerName || ''} 正确)`,
      })
    }

    const rankings = await loadRankings()

    send('score.confirm', { playerId, teamId, scoreChange: correct ? (config.scoreCorrect || q.score_value) : (isBuzzer ? (config.scoreWrong || -10) : 0), questionId: q.id, correct,
      playerName, teamName, rankings })

    // Broadcast timer stop
    send('timer.stop', {})

    // Update local timer state
    setTimerStatus('stopped')
  }

  const selectRound = useCallback(async (round: any) => {
    setCurrentRound(round); setCurrentQIndex(-1); setBuzzerResult(null); setBuzzerOpen(false)
    setPlayerAnswers({}); setAwaitingJudge(null); setTimerStatus('stopped')
    send('round.start', { competitionId: competition?.id, roundId: round.id, title: round.title, roundType: round.round_type })
    const { data } = await supabase.from('questions').select('*').eq('round_id', round.id).order('sort_order')
    setQuestions(data || [])
  }, [competition, supabase])

  const showQuestion = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentQIndex(index); setBuzzerResult(null); setBuzzerOpen(false)
    setPlayerAnswers({}); setAwaitingJudge(null)
    const q = questions[index]
    const limit = getTimeLimit(currentRound, q)

    let playerId = null, playerDisplayId = null
    if (currentRound?.round_type === 'required' && players.length > 0) {
      const p = players[currentPlayerIndex % players.length]
      playerId = p.id
      const teamIdx = Math.floor(currentPlayerIndex / 3)
      playerDisplayId = `${teamIdx + 1}-${(currentPlayerIndex % 3) + 1}`
    }

    send('question.show', {
      competitionId: competition?.id, questionId: q.id, content: q.content, type: q.type,
      options: q.options, scoreValue: q.score_value, playerId, playerDisplayId,
      roundType: currentRound?.round_type,
    })

    if (currentRound?.round_type !== 'simulation' && limit > 0) {
      send('timer.start', { durationSec: limit })
    }
  }, [questions, currentRound, players, currentPlayerIndex, competition])

  const nextQuestion = useCallback(() => {
    const next = currentQIndex + 1
    if (next >= questions.length) { alert('当前环节题目已用完'); return }
    send('timer.stop', {})
    setBuzzerResult(null); setBuzzerOpen(false); setPlayerAnswers({}); setAwaitingJudge(null)
    setTimerStatus('stopped')
    if (currentRound?.round_type === 'required') {
      setCurrentPlayerIndex((prev: number) => (prev + 1) % players.length)
    }
    showQuestion(next)
  }, [currentQIndex, questions, currentRound, players, showQuestion])

  const openBuzzer = useCallback(() => {
    const q = questions[currentQIndex]
    if (!q) return
    setBuzzerOpen(true); setBuzzerResult(null); setPlayerAnswers({})
    const limit = getTimeLimit(currentRound, q)
    send('buzzer.open', { competitionId: competition?.id, questionId: q.id, durationSec: limit })
  }, [questions, currentQIndex, competition, currentRound])

  const onBuzzerResult = useCallback((result: any) => {
    setBuzzerResult(result); setBuzzerOpen(false)
    const q = questions[currentQIndex]
    if (!q) return
    send('question.show', {
      competitionId: competition?.id, questionId: q.id, content: q.content, type: q.type,
      options: q.options, scoreValue: q.score_value,
      playerId: result.playerId, playerDisplayId: result.playerDisplayId,
      roundType: 'buzzer',
    })
  }, [questions, currentQIndex, competition])

  // Manual confirm — scoped to current player (required) or buzzer winner
  const manualConfirm = useCallback(async (correct: boolean) => {
    const q = questions[currentQIndex]
    if (!q) return
    let playerId = '', teamId = '', playerName = '', teamName = ''
    if (currentRound?.round_type === 'required' && players.length > 0) {
      const p = players[currentPlayerIndex % players.length]
      playerId = p.id; teamId = p.team_id; playerName = p.display_name; teamName = p.teams?.name || ''
    }
    if (currentRound?.round_type === 'buzzer' && buzzerResult) {
      playerId = buzzerResult.playerId; teamId = buzzerResult.teamId
      playerName = buzzerResult.playerDisplayId || ''; teamName = buzzerResult.teamName || ''
    }
    if (awaitingJudge) playerId = awaitingJudge
    if (!playerId) return
    await applyScore(playerId, teamId, playerName, teamName, correct)
    setBuzzerResult(null); setAwaitingJudge(null)
  }, [questions, currentQIndex, currentRound, players, currentPlayerIndex, competition, buzzerResult, awaitingJudge])

  const [judgeScoreValue, setJudgeScoreValue] = useState(0)
  const submitJudgeScore = useCallback(async () => {
    if (!awaitingJudge || !currentRound) return
    const p = players[currentPlayerIndex % players.length]
    if (!p) return
    const q = questions[currentQIndex]
    if (!q) return
    await supabase.from('score_records').insert({
      competition_id: competition?.id, player_id: p.id, team_id: p.team_id,
      round_id: currentRound?.id, question_id: q.id,
      score_change: judgeScoreValue,
      reason: `评委评分: ${judgeScoreValue}/${q.score_value}`,
    })
    const rankings = await loadRankings()
    send('score.confirm', { playerId: p.id, teamId: p.team_id, scoreChange: judgeScoreValue,
      questionId: q.id, correct: judgeScoreValue > 0, playerName: p.display_name, teamName: p.teams?.name || '', rankings })
    send('timer.stop', {})
    setAwaitingJudge(null); setJudgeScoreValue(0); setTimerStatus('stopped')
  }, [awaitingJudge, currentRound, players, currentPlayerIndex, questions, currentQIndex, competition, judgeScoreValue, supabase, loadRankings])

  const q = currentQIndex >= 0 ? questions[currentQIndex] : null
  const currentPlayer = currentRound?.round_type === 'required' && players.length > 0 ? players[currentPlayerIndex % players.length] : null

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">🎮 比赛控制台</h2>
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {connected ? '🟢 已连接' : '🔴 未连接'} · {WS_URL}</span>
      </div>

      {!competition ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center"><p className="text-gray-500 text-lg">暂无可用的比赛。</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📋 选择环节</h3>
              <div className="flex gap-3 flex-wrap">
                {rounds.map((r: any) => (
                  <button key={r.id} onClick={() => selectRound(r)} className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${currentRound?.id === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-bold">{r.round_order}. {r.title.split(' - ')[0]}</div>
                    <div className="text-xs text-gray-500 mt-1">{r.round_type === 'required' ? '必答' : r.round_type === 'buzzer' ? '抢答' : '模拟调解'}</div>
                  </button>
                ))}
              </div>
            </div>

            {currentRound && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">📖 题目控制 <span className="text-gray-500 font-normal ml-2">{currentQIndex + 1} / {questions.length}</span></h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span className={`font-mono text-lg font-bold ${timerStatus === 'running' && remainingSec <= 3 ? 'text-red-600 animate-pulse' : ''}`}>
                      {Math.ceil(remainingSec)}s</span>
                    <span className="text-xs text-gray-400">({timerStatus})</span>
                  </div>
                </div>

                {currentRound.round_type === 'required' && currentPlayer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-blue-800 font-medium">当前选手：{currentPlayer.display_name} ({currentPlayer.teams?.name}) · 总分：{playerTotals[currentPlayer.id] || 0}</p>
                  </div>
                )}

                {q && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <span className="text-xs font-medium text-blue-600 mb-1 block">
                      {q.type === 'choice' ? '选择题' : q.type === 'true_false' ? '判断题' : q.type === 'fill_blank' ? '填空题' : '简答题'}
                      {' · '}{q.score_value}分 · 时限：{getTimeLimit(currentRound, q)}s
                      {q.type !== 'short_answer' && <span className="ml-2 text-green-600">【系统自动判分】</span>}
                      {q.type === 'short_answer' && <span className="ml-2 text-amber-600">【需评委评分】</span>}
                    </span>
                    <p className="text-lg mb-2">{q.content}</p>
                    {q.options && <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">{(q.options as string[]).map((opt: string, i: number) => <span key={i}>{opt}</span>)}</div>}
                    <p className="text-sm text-green-600 mt-2">答案：{q.answer}</p>
                  </div>
                )}

                {currentQIndex < 0 ? (
                  <button onClick={() => showQuestion(0)} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">开始答题 · 显示第1题</button>
                ) : (
                  <div className="space-y-3">
                    {currentRound.round_type === 'required' && currentPlayer && (
                      <div>
                        {awaitingJudge ? (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-2">
                            <p className="text-amber-800 font-bold mb-2">📝 {currentPlayer.display_name} 简答题需要评委评分</p>
                            <p className="text-sm text-amber-600 mb-2">答案：{playerAnswers[currentPlayer.id] || '无'}</p>
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium">评分 (0-{q?.score_value})：</label>
                              <input type="number" min={0} max={q?.score_value} value={judgeScoreValue} onChange={(e) => setJudgeScoreValue(parseInt(e.target.value) || 0)} className="w-20 px-3 py-1 border rounded-lg" />
                              <button onClick={submitJudgeScore} className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认评分</button>
                            </div>
                          </div>
                        ) : playerAnswers[currentPlayer.id] ? (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                            <p className="text-green-700">✅ {currentPlayer.display_name} 已作答：{playerAnswers[currentPlayer.id]}</p>
                            {q?.type !== 'short_answer' && <p className="text-sm text-green-600 mt-1">系统已自动判分</p>}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm mb-2">等待 {currentPlayer.display_name} 作答...</p>
                        )}

                        <div className="flex gap-3">
                          <button onClick={() => manualConfirm(true)} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5" /> 强制 {currentPlayer.display_name} 正确 +{currentRound.config?.scoreCorrect || q?.score_value || 10}</button>
                          <button onClick={() => manualConfirm(false)} className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 flex items-center justify-center gap-2">
                            <XCircle className="w-5 h-5" /> 强制 {currentPlayer.display_name} 错误</button>
                          <button onClick={() => manualConfirm(false)} className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5" /> 超时</button>
                        </div>
                      </div>
                    )}

                    {currentRound.round_type === 'buzzer' && (
                      <div>
                        <button onClick={openBuzzer} disabled={buzzerOpen} className={`w-full py-4 rounded-lg font-bold text-xl transition-all ${buzzerOpen ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200 animate-pulse'}`}>
                          <Zap className="w-6 h-6 inline mr-2" />{buzzerOpen ? '抢答进行中...' : '开始抢答'}</button>
                        {buzzerResult && (
                          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-lg font-bold text-green-700">🎯 {buzzerResult.teamName} · {buzzerResult.playerDisplayId} 抢答成功！</p>
                            <p className="text-sm text-green-600">延迟：{buzzerResult.latencyMs}ms</p>
                            <div className="flex gap-3 mt-3">
                              <button onClick={() => manualConfirm(true)} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">答对 +{currentRound.config?.scoreCorrect || 10}</button>
                              <button onClick={() => manualConfirm(false)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">答错 {currentRound.config?.scoreWrong || -10}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentRound.round_type === 'simulation' && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-amber-800 font-medium">📝 模拟调解环节 — 选手现场作答，评委打分</p>
                        <p className="text-sm text-amber-600 mt-1">无倒计时限制</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => showQuestion(currentQIndex - 1)} disabled={currentQIndex <= 0} className="flex-1 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30">上一题</button>
                      <button onClick={nextQuestion} disabled={currentQIndex >= questions.length - 1} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2">
                        <SkipForward className="w-4 h-4" /> 下一题</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel */}
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
              <h3 className="font-bold mb-3">🏆 当前排名（团队）</h3>
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

            {/* Player Scores */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">👥 选手得分 ({players.length}人)</h3>
              <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                {players.map((p: any) => (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded ${currentRound?.round_type === 'required' && p.id === currentPlayer?.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                    <span>{p.display_name} <span className="text-gray-400">{p.teams?.name}</span></span>
                    <span className="font-bold text-base">{playerTotals[p.id] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">⚡ 快捷操作</h3>
              <div className="space-y-2">
                <button onClick={() => send('competition.start', { competitionId: competition.id })} className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"><Play className="w-4 h-4" /> 开始比赛</button>
                <button onClick={() => send('competition.pause', {})} className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"><Square className="w-4 h-4" /> 暂停比赛</button>
                <button onClick={() => { if (confirm('确认结束比赛？')) send('competition.finish', { competitionId: competition.id }) }} className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"><Square className="w-4 h-4" /> 结束比赛</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
