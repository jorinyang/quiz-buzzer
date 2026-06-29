// =====================================================
// API 请求封装
// =====================================================

import type { ApiResponse } from '../types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

export async function api<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })
    return await res.json()
  } catch (e) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: String(e) },
    }
  }
}

// Convenience methods
export const apiGet = <T>(endpoint: string) => api<T>(endpoint)
export const apiPost = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'POST', body: JSON.stringify(body) })
export const apiPut = <T>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) })
export const apiDelete = <T>(endpoint: string) => api<T>(endpoint, { method: 'DELETE' })
