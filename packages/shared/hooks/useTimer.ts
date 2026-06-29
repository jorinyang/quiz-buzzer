// =====================================================
// useTimer Hook — 计时器 Hook（支持服务端同步）
// =====================================================
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseTimerOptions {
  totalSec: number
  onExpire?: () => void
}

export function useTimer({ totalSec, onExpire }: UseTimerOptions) {
  const [remainingSec, setRemainingSec] = useState(totalSec)
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'expired'>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const start = useCallback(() => {
    setStatus('running')
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setRemainingSec((prev: number) => {
        const next = prev - 0.1
        if (next <= 0) {
          setStatus('expired')
          if (intervalRef.current) clearInterval(intervalRef.current)
          onExpireRef.current?.()
          return 0
        }
        return next
      })
    }, 100)
  }, [])

  const pause = useCallback(() => {
    setStatus('paused')
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const reset = useCallback((sec?: number) => {
    setStatus('idle')
    setRemainingSec(sec ?? totalSec)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [totalSec])

  const sync = useCallback((sec: number, serverStatus: 'running' | 'paused' | 'stopped') => {
    setRemainingSec(sec)
    if (serverStatus === 'running' && status !== 'running') {
      start()
    } else if (serverStatus === 'paused') {
      pause()
    } else if (serverStatus === 'stopped') {
      reset(sec)
    }
  }, [status, start, pause, reset])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { remainingSec, status, start, pause, reset, sync }
}
