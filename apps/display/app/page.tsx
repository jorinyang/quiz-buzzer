'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

interface RankingEntry {
  teamId: string
  teamName: string
  score: number
}

export default function DisplayPage() {
  const [connected, setConnected] = useState(false)
  const [roundTitle, setRoundTitle] = useState('等待开始')
  const [competitionStatus, setCompetitionStatus] = useState('pending')
  const [question, setQuestion] = useState<any>(null)
  const [remainingSec, setRemainingSec] = useState(0)
  const [timerStatus, setTimerStatus] = useState('stopped')
  const [buzzerResult, setBuzzerResult] = useState<any>(null)
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [])

  function connect() {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setTimeout(connect, 2000) }
    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const { type, payload } = msg

        switch (type) {
          case 'state.competition':
            setCompetitionStatus(payload.status as string)
            break
          case 'state.round':
            if (payload.round) setRoundTitle(payload.round.title || payload.round.roundType)
            break
          case 'state.question':
            if (payload.action !== 'next') {
              setQuestion(payload)
            }
            break
          case 'state.timer':
            setRemainingSec(payload.remainingSec as number)
            setTimerStatus(payload.status as string)
            break
          case 'state.buzzer.result':
            setBuzzerResult(payload)
            break
          case 'state.score':
            // Update specific team score
            setRankings((prev: RankingEntry[]) => {
              return prev.map(r =>
                r.teamId === payload.teamId ? { ...r, score: (r.score || 0) + (payload.scoreChange as number) } : r
              ).sort((a: RankingEntry, b: RankingEntry) => b.score - a.score)
            })
            break
          case 'state.ranking':
            if (payload.rankings) setRankings(payload.rankings as RankingEntry[])
            break
        }
      } catch(e) {}
    }
  }

  const displaySec = remainingSec > 0 ? Math.ceil(remainingSec) : 0

  return (
    <main className="flex flex-col h-screen p-6 bg-gray-950 text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-amber-400">
            黔西南州第二届&ldquo;和润黔家&rdquo;
          </h1>
          <p className="text-xl text-gray-300">婚姻家庭纠纷人民调解工作大比武</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-6 py-2 rounded-full text-xl font-bold ${
            competitionStatus === 'active' ? 'bg-blue-600' :
            competitionStatus === 'paused' ? 'bg-yellow-600' :
            competitionStatus === 'finished' ? 'bg-gray-600' :
            'bg-gray-700 text-gray-400'
          }`}>
            当前环节：{roundTitle}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-6 min-h-0">
        {/* Question Area - 65% */}
        <div className="flex-[65] flex flex-col">
          <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-700 flex flex-col items-center justify-center p-8 relative">
            {question ? (
              <>
                <div className="text-center mb-6">
                  <span className="inline-block px-4 py-1 bg-blue-600/30 text-blue-300 rounded-full text-lg mb-4">
                    {question.type === 'choice' ? '选择题' :
                     question.type === 'true_false' ? '判断题' :
                     question.type === 'fill_blank' ? '填空题' : '简答题'}
                    {' · '}{question.scoreValue}分
                  </span>
                  {question.playerDisplayId && (
                    <span className="ml-3 px-4 py-1 bg-amber-600/30 text-amber-300 rounded-full text-lg">
                      选手：{question.playerDisplayId}号
                    </span>
                  )}
                </div>

                <p className="text-5xl font-bold text-center leading-tight mb-8">{question.content}</p>

                {question.options && (
                  <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
                    {(question.options as string[]).map((opt: string, i: number) => (
                      <div key={i} className="p-6 rounded-xl border-2 border-gray-700 text-3xl font-bold text-center
                        hover:border-blue-500 transition-colors">
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                {/* Timer overlay */}
                {timerStatus === 'running' && (
                  <div className="absolute top-4 right-8">
                    <div className={`text-6xl font-mono font-bold transition-colors ${
                      displaySec <= 3 ? 'text-red-500 animate-pulse scale-125' : 'text-white'
                    }`}>
                      0:{String(displaySec).padStart(2, '0')}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-7xl font-bold text-gray-500 mb-4">准备就绪</p>
                <p className="text-3xl text-gray-600">等待主持人开始比赛...</p>
              </div>
            )}
          </div>

          {/* Buzzer Result Area */}
          <div className={`h-28 mt-4 rounded-2xl border flex items-center justify-center transition-all duration-300 ${
            buzzerResult
              ? 'bg-gray-900 border-amber-500 shadow-lg shadow-amber-500/20'
              : 'bg-gray-900 border-gray-700'
          }`}>
            {buzzerResult ? (
              buzzerResult.status === 'first' ? (
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400 animate-bounce">
                    🎯 {buzzerResult.teamName} · {buzzerResult.playerDisplayId} 抢答成功！
                  </p>
                  <p className="text-lg text-amber-300 mt-1">响应时间：{buzzerResult.latencyMs}ms</p>
                </div>
              ) : (
                <p className="text-xl text-gray-400">等待下一轮抢答...</p>
              )
            ) : (
              <p className="text-2xl text-gray-600">抢答结果区</p>
            )}
          </div>
        </div>

        {/* Rankings - 35% */}
        <div className="flex-[35] bg-gray-900 rounded-2xl border border-gray-700 p-6 flex flex-col">
          <h2 className="text-2xl font-bold text-amber-400 mb-4 text-center shrink-0">🏆 团队排行榜</h2>
          <div className="flex-1 space-y-2 overflow-auto">
            {rankings.length > 0 ? (
              rankings.map((team: RankingEntry, i: number) => (
                <div
                  key={team.teamId}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                    i === 0 ? 'bg-yellow-900/20 border border-yellow-600/50' :
                    i === 1 ? 'bg-gray-800 border border-gray-600/50' :
                    i === 2 ? 'bg-amber-900/10 border border-amber-700/30' :
                    'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold w-8 text-center ${
                      i === 0 ? 'text-yellow-400 text-3xl' :
                      i === 1 ? 'text-gray-300' :
                      i === 2 ? 'text-amber-600' :
                      'text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-xl">{team.teamName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Score bar */}
                    <div className="w-32 h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${rankings.length > 0 ? (team.score / Math.max(...rankings.map((r: RankingEntry) => r.score), 1)) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-2xl font-bold text-white w-20 text-right">{team.score}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-xl">等待比赛开始...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="mt-4 flex items-center justify-between text-sm text-gray-500 shrink-0">
        <span>
          连接状态：
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            {connected ? '🟢 已连接' : '🔴 断线重连中...'}
          </span>
        </span>
        <span>WebSocket: {WS_URL}</span>
      </footer>
    </main>
  )
}
