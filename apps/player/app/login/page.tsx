'use client'

import { useRouter } from 'next/navigation'
import { useState, FormEvent } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { createHash } from 'crypto'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = getSupabase()
      const hash = await hashPassword(password)

      const { data: users, error: dbError } = await supabase
        .from('users')
        .select('id, username, display_name, role, team_id, teams(name)')
        .eq('username', username)
        .eq('password_hash', hash)
        .limit(1)

      if (dbError || !users || users.length === 0) {
        setError('账号或密码错误')
        setLoading(false)
        return
      }

      const user = users[0]

      // Store user info in session storage
      sessionStorage.setItem('quiz_user', JSON.stringify({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        teamId: user.team_id,
        teamName: user.teams?.name || '',
      }))

      // Redirect based on role
      if (user.role === 'judge') {
        router.push('/judge')
      } else {
        router.push('/buzz')
      }
    } catch (e) {
      setError('登录失败，请重试')
    }
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">婚调大比武</h1>
        <p className="text-gray-500 text-center mb-8">选手/评委 登录</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">账号</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="输入选手编号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-400 text-center">
          测试账号：player1_1 ~ player8_3 / judge1 ~ judge5 / 密码 123456
        </div>
      </div>
    </main>
  )
}

// Simple SHA256 hash matching the seed data
async function hashPassword(pw: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
