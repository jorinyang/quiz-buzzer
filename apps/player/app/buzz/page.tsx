'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

export default function BuzzPage() {
  const [connected, setConnected] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<any>(null)
  const [buzzerState, setBuzzerState] = useState<'disabled' | 'ready' | 'pending' | 'success' | 'failed' | 'buzzed_answering'>('disabled')
  const [buzzerResultText, setBuzzerResultText] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [playerScore, setPlayerScore] = useState(0)

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [roundType, setRoundType] = useState<string | null>(null)
  const [answerConfirmed, setAnswerConfirmed] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState('')
  const [fillAnswer, setFillAnswer] = useState('')
  // Buzzer question: won the buzz, now answer
  const [isBuzzerWinner, setIsBuzzerWinner] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const stateRef = useRef(buzzerState); stateRef.current = buzzerState
  const playerRef = useRef<any>(null); playerRef.current = playerInfo

  useEffect(() => {
    const stored = sessionStorage.getItem('quiz_user')
    if (stored) { try { const info = JSON.parse(stored); setPlayerInfo(info); playerRef.current = info } catch(e) {} }
  }, [])

  useEffect(() => {
    if (!playerInfo) return
    connect()
    return () => { wsRef.current?.close() }
  }, [playerInfo])

  function connect() {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL); wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Re-read from sessionStorage to ensure playerRef is populated
      const stored = sessionStorage.getItem('quiz_user')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          playerRef.current = parsed
        } catch(e) {}
      }
      const info = playerRef.current
      ws.send(JSON.stringify({ type: 'player.login', payload: { userId: info?.id, username: info?.username, teamId: info?.teamId, competitionId: 'current', role: info?.role }, timestamp: Date.now() }))
    }
    ws.onclose = () => setConnected(false)
    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data); const info = playerRef.current
        switch (msg.type) {
          case 'state.question':
            if (msg.payload.action !== 'next') {
              setCurrentQuestion(msg.payload); setRoundType(msg.payload.roundType || null)
              setAnswerConfirmed(false); setPendingAnswer(''); setFillAnswer('')
              if (msg.payload.roundType === 'buzzer') {
                if (isBuzzerWinner) setBuzzerState('buzzed_answering')
              }
            } else {
              setCurrentQuestion(null); setAnswerConfirmed(false); setPendingAnswer(''); setFillAnswer('')
              setIsBuzzerWinner(false)
            }
            break
          case 'state.timer':
            if (msg.payload.status === 'stopped' || msg.payload.status === 'expired') setBuzzerState('disabled')
            break
          case 'state.buzzer.result':
            if (msg.payload?.status === 'open') {
              setBuzzerState('ready'); setBuzzerResultText(''); setCurrentQuestion(null); setIsBuzzerWinner(false)
            } else if (msg.payload?.status === 'first') {
              if (info && msg.payload.playerId === info.id) {
                setBuzzerState('success'); setBuzzerResultText('你抢到了！请作答')
                setIsBuzzerWinner(true)
              } else {
                setBuzzerState('failed'); setBuzzerResultText(`${msg.payload.teamName} ${msg.payload.playerDisplayId} 已抢到`)
              }
            } else if (msg.payload?.status === 'closed') { setBuzzerState('disabled') }
            break
          case 'state.score':
            {
              const pid = msg.payload.playerId as string
              if (info && pid && pid === info.id) {
                if (msg.payload.correct !== undefined) setLastResult(msg.payload.correct ? '✅ 回答正确' : '❌ 回答错误')
                if (msg.payload.scoreChange) setPlayerScore((prev: number) => prev + (msg.payload.scoreChange as number))
              }
            }
            setBuzzerState('disabled'); setIsBuzzerWinner(false)
            break
          case 'state.round':
            if (msg.payload.round?.roundType && msg.payload.round.roundType !== 'buzzer') setBuzzerState('disabled')
            break
        }
      } catch(e) {}
    }
  }

  const handleBuzz = useCallback(() => {
    if (stateRef.current !== 'ready') return
    setBuzzerState('pending')
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const info = playerRef.current
      wsRef.current.send(JSON.stringify({
        type: 'player.buzz',
        payload: { competitionId: 'current', questionId: 'current', playerId: info?.id || 'unknown', teamId: info?.teamId || 'unknown', teamName: info?.teamName || '', playerDisplayId: info?.displayId || '' },
        timestamp: Date.now()
      }))
    }
  }, [])

  // Step 1: Player selects an answer (not yet confirmed)
  const selectAnswer = useCallback((answer: string) => {
    if (answerConfirmed) return
    setPendingAnswer(answer)
    setFillAnswer(answer)
  }, [answerConfirmed])

  // Step 2: Player clicks CONFIRM to submit
  const confirmAnswer = useCallback(() => {
    if (answerConfirmed || !pendingAnswer.trim()) return
    setAnswerConfirmed(true)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const info = playerRef.current
      wsRef.current.send(JSON.stringify({
        type: 'player.submit_answer',
        payload: { competitionId: 'current', questionId: currentQuestion?.questionId || 'current', playerId: info?.id, teamId: info?.teamId, teamName: info?.teamName || '', playerName: info?.displayName || '', answer: pendingAnswer },
        timestamp: Date.now()
      }))
    }
  }, [answerConfirmed, pendingAnswer, currentQuestion])

  // Step 3: Player can cancel selection before confirming
  const cancelSelection = useCallback(() => {
    if (answerConfirmed) return
    setPendingAnswer('')
    setFillAnswer('')
  }, [answerConfirmed])

  if (!playerInfo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center"><p className="text-xl text-gray-500 mb-4">请先登录</p>
          <a href="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">返回登录</a></div>
      </main>
    )
  }

  const showQuestionUI = currentQuestion && (roundType === 'required' || (roundType === 'buzzer' && isBuzzerWinner))
  const showBuzzerButton = !currentQuestion || (roundType === 'buzzer' && !isBuzzerWinner)

  return (
    <main className="flex flex-col min-h-screen p-4 bg-gray-100">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">{playerInfo.teamName} · {playerInfo.displayName}</h1>
        <p className="text-gray-500">个人得分：<span className="font-bold text-2xl">{playerScore}</span></p>
        <p className="text-xs mt-1">{connected ? '🟢 已连接' : '🔴 未连接'}</p>
      </div>

      {/* Question UI for required rounds or buzzer-winning player */}
      {showQuestionUI && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center mb-6">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm mb-3">
              {currentQuestion.type === 'choice' ? '选择题' : currentQuestion.type === 'true_false' ? '判断题' :
               currentQuestion.type === 'fill_blank' ? '填空题' : '简答题'}
              {' · '}{currentQuestion.scoreValue}分
            </span>
            <p className="text-lg font-bold mb-6">{currentQuestion.content}</p>

            {/* Choice options */}
            {(currentQuestion.type === 'choice') && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-3">
                {(currentQuestion.options as string[]).map((opt: string, i: number) => {
                  const letter = opt.charAt(0)
                  const isSelected = pendingAnswer === letter
                  return (
                    <button key={i} onClick={() => selectAnswer(letter)} disabled={answerConfirmed}
                      className={`p-4 rounded-xl border-2 text-lg font-bold transition-all ${
                        answerConfirmed
                          ? isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400'
                          : isSelected ? 'border-blue-500 bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
                      }`}>{opt}</button>
                  )
                })}
              </div>
            )}

            {/* True/False options */}
            {currentQuestion.type === 'true_false' && (
              <div className="grid grid-cols-2 gap-3">
                {[{val:'T',label:'✅ 正确'},{val:'F',label:'❌ 错误'}].map(({val,label}) => {
                  const isSelected = pendingAnswer === val
                  return (
                    <button key={val} onClick={() => selectAnswer(val)} disabled={answerConfirmed}
                      className={`p-4 rounded-xl border-2 text-lg font-bold transition-all ${
                        answerConfirmed
                          ? isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400'
                          : isSelected ? 'border-blue-500 bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
                      }`}>{label}</button>
                  )
                })}
              </div>
            )}

            {/* Fill blank / Short answer */}
            {(currentQuestion.type === 'fill_blank' || currentQuestion.type === 'short_answer') && (
              <div>
                <input type="text" value={fillAnswer}
                  onChange={(e) => { setFillAnswer(e.target.value); setPendingAnswer(e.target.value) }}
                  disabled={answerConfirmed}
                  placeholder={currentQuestion.type === 'fill_blank' ? '输入答案...' : '输入简答内容...'}
                  className="w-full px-4 py-3 border rounded-lg text-lg disabled:bg-gray-100" />
              </div>
            )}

            {/* Action buttons */}
            {!answerConfirmed ? (
              <div className="mt-4 space-y-2">
                {pendingAnswer && (
                  <button onClick={confirmAnswer}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                    ✅ 确定提交
                  </button>
                )}
                {pendingAnswer && (
                  <button onClick={cancelSelection}
                    className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm">
                    取消选择
                  </button>
                )}
                {!pendingAnswer && (
                  <p className="text-sm text-gray-400 mt-2">请先选择一个答案，然后点击确定提交</p>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                <p className="text-green-600 font-medium">✅ 答案已提交，等待判定</p>
                <p className="text-sm text-gray-500">你的答案：{pendingAnswer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buzzer Button */}
      {showBuzzerButton && (
        <div className="flex flex-col items-center justify-center flex-1">
          <button onClick={handleBuzz} disabled={buzzerState !== 'ready'}
            className={`w-40 h-40 rounded-full flex items-center justify-center mb-6 shadow-2xl transition-all duration-150 transform active:scale-95 ${
              buzzerState === 'disabled' ? 'bg-gray-300 cursor-not-allowed' : buzzerState === 'ready' ? 'bg-green-500 hover:bg-green-600 cursor-pointer animate-pulse shadow-green-300' :
              buzzerState === 'pending' ? 'bg-yellow-400 animate-pulse' : buzzerState === 'success' ? 'bg-amber-500 shadow-amber-300 scale-110' : 'bg-red-500'}`}>
            <div className="text-center">
              <Zap className={`w-10 h-10 mx-auto mb-1 ${buzzerState === 'ready' ? 'text-white' : 'text-white/70'}`} />
              <span className="text-xl font-bold text-white">
                {buzzerState === 'disabled' ? '等待' : buzzerState === 'ready' ? '抢答' : buzzerState === 'pending' ? '...' : buzzerState === 'success' ? '成功!' : '已抢'}
              </span>
            </div>
          </button>
          <p className={`text-lg mb-2 font-medium ${
            buzzerState === 'ready' ? 'text-green-600' : buzzerState === 'success' ? 'text-amber-600' : buzzerState === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
            {buzzerState === 'disabled' ? '等待抢答开始...' : buzzerState === 'ready' ? '点击抢答！' : buzzerState === 'pending' ? '等待结果...' : buzzerResultText || ''}
          </p>
          <div className="w-64 text-center p-4 rounded-xl bg-white shadow-sm mt-4">
            <p className="text-sm text-gray-400 mb-1">结果</p><p className="text-lg font-medium">{lastResult || '暂无'}</p>
          </div>
        </div>
      )}
    </main>
  )
}
