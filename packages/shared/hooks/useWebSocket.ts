// =====================================================
// useWebSocket Hook — 管理 WebSocket 连接和事件订阅
// =====================================================
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type WsHandler = (payload: Record<string, unknown>) => void

interface UseWebSocketOptions {
  url: string
  token?: string
  autoReconnect?: boolean
  maxRetries?: number
}

export function useWebSocket({ url, token, autoReconnect = true, maxRetries = 10 }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<string, Set<WsHandler>>>(new Map())
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      retryCountRef.current = 0
      // 发送认证
      if (token) {
        ws.send(JSON.stringify({ type: 'player.login', payload: { token }, timestamp: Date.now() }))
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        const handlers = handlersRef.current.get(msg.type)
        if (handlers) {
          handlers.forEach((handler: WsHandler) => handler(msg.payload))
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      if (autoReconnect && retryCountRef.current < maxRetries) {
        retryCountRef.current++
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000)
        setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url, token, autoReconnect, maxRetries])

  const subscribe = useCallback((eventType: string, handler: WsHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set())
    }
    handlersRef.current.get(eventType)!.add(handler)
    return () => {
      handlersRef.current.get(eventType)?.delete(handler)
    }
  }, [])

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, subscribe, send, ws: wsRef }
}
