'use client'

import { useState, useRef, useCallback } from 'react'
import { Zap } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'

export default function BuzzPage() {
  const [connected, setConnected] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<any>(null)
  const [buzzerState, setBuzzerState] = useState<'disabled' | 'ready' | 'pending' | 'success' | 'failed'>('disabled')
  const [buzzerResultText, setBuzzerResultText] = useState('')
  const [lastResult, setLastResult] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const stateRef = useRef(buzzerState)
  stateRef.current = buzzerState

  // Connect (in real app, this would use login data)
  const connect = useCallback((username: string, password: string) => {
    // Simple auth - in production, verify against Supabase
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({
        type: 'player.login',
        payload: { username, competitionId: 'current' },
        timestamp: Date.now()
      }))
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'state.buzzer.result':
            if (msg.payload?.status === 'open') {
              setBuzzerState('ready')
              setBuzzerResultText('')
            } else if (msg.payload?.status === 'first') {
              if (stateRef.current === 'pending') {
                setBuzzerState('success')
                setBuzzerResultText('你抢到了！请口头作答')
              } else {
                setBuzzerState('failed')
                setBuzzerResultText(`${msg.payload.teamName} ${msg.payload.playerDisplayId} 已抢到`)
              }
            } else if (msg.payload?.status === 'closed') {
              setBuzzerState('disabled')
            }
            break
          case 'state.score':
            if (msg.payload?.correct !== undefined) {
              setLastResult(msg.payload.correct ? '✅ 回答正确' : '❌ 回答错误')
            }
            setBuzzerState('disabled')
            break
          case 'state.question':
            setBuzzerState('disabled')
            setBuzzerResultText('')
            setLastResult(null)
            break
        }
      } catch(e) {}
    }
  }, [])

  const handleBuzz = useCallback(() => {
    if (stateRef.current !== 'ready') return
    setBuzzerState('pending')
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player.buzz',
        payload: {
          competitionId: 'current',
          questionId: 'current',
          playerId: playerInfo?.id || 'unknown',
          teamId: playerInfo?.teamId || 'unknown',
          teamName: playerInfo?.teamName || '',
          playerDisplayId: playerInfo?.displayId || '',
        },
        timestamp: Date.now()
      }))
    }
  }, [playerInfo])

  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-gray-100">
      {/* Player Info */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">{playerInfo?.displayName || '选手'}</h1>
        <p className="text-gray-500 mt-1">
          个人得分：<span className="font-bold text-xl">{playerInfo?.score || 0}</span>
        </p>
      </div>

      {/* Buzzer Button */}
      <button
        onClick={handleBuzz}
        disabled={buzzerState !== 'ready'}
        className={`w-48 h-48 rounded-full flex items-center justify-center mb-8 shadow-2xl transition-all duration-150 transform active:scale-95 ${
          buzzerState === 'disabled' ? 'bg-gray-300 cursor-not-allowed' :
          buzzerState === 'ready' ? 'bg-green-500 hover:bg-green-600 cursor-pointer animate-pulse shadow-green-300' :
          buzzerState === 'pending' ? 'bg-yellow-400 animate-pulse' :
          buzzerState === 'success' ? 'bg-amber-500 shadow-amber-300 scale-110' :
          'bg-red-500'
        }`}
      >
        <div className="text-center">
          <Zap className={`w-12 h-12 mx-auto mb-1 ${
            buzzerState === 'ready' ? 'text-white' : 'text-white/70'
          }`} />
          <span className="text-2xl font-bold text-white">
            {buzzerState === 'disabled' ? '等待' :
             buzzerState === 'ready' ? '抢答' :
             buzzerState === 'pending' ? '...' :
             buzzerState === 'success' ? '成功!' : '已抢'}
          </span>
        </div>
      </button>

      {/* Status */}
      <p className={`text-lg mb-2 font-medium ${
        buzzerState === 'ready' ? 'text-green-600' :
        buzzerState === 'success' ? 'text-amber-600' :
        buzzerState === 'failed' ? 'text-red-600' :
        'text-gray-500'
      }`}>
        {buzzerState === 'disabled' ? '等待抢答开始...' :
         buzzerState === 'ready' ? '点击抢答！' :
         buzzerState === 'pending' ? '等待结果...' :
         buzzerResultText || ''}
      </p>

      {/* Connection Status */}
      <p className="text-sm mb-4">
        {connected ? '🟢 已连接' : '🔴 未连接'}
      </p>

      {/* Last Result */}
      <div className="w-64 text-center p-4 rounded-xl bg-white shadow-sm">
        <p className="text-sm text-gray-400 mb-1">上一题结果</p>
        <p className="text-lg font-medium">{lastResult || '暂无'}</p>
      </div>

      {/* Login Form (simple) */}
      {!playerInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-80">
            <h2 className="text-xl font-bold mb-4 text-center">选手登录</h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const username = (form.elements.namedItem('username') as HTMLInputElement).value
              const password = (form.elements.namedItem('password') as HTMLInputElement).value
              setPlayerInfo({ username, score: 0 })
              connect(username, password)
            }} className="space-y-4">
              <div>
                <input name="username" type="text" placeholder="选手编号" className="w-full px-4 py-3 border rounded-lg" required />
              </div>
              <div>
                <input name="password" type="password" placeholder="密码" className="w-full px-4 py-3 border rounded-lg" required />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                进入抢答
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
