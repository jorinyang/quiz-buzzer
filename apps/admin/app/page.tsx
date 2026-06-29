'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, Trophy, FileQuestion, Gamepad2, Users, Settings } from 'lucide-react'
import Link from 'next/link'
import { getSupabase } from '@quiz-buzzer/shared'

const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/' },
  { icon: Trophy, label: '比赛管理', href: '/competitions' },
  { icon: FileQuestion, label: '题目管理', href: '/questions' },
  { icon: Gamepad2, label: '比赛控制台', href: '/control' },
  { icon: Users, label: '计分面板', href: '/scoring' },
  { icon: Settings, label: '系统设置', href: '/settings' },
]

export default function AdminPage() {
  const [competition, setCompetition] = useState<any>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const supabase = getSupabase()

  useEffect(() => {
    supabase.from('competitions').select('*').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => setCompetition(data))
    supabase.from('questions').select('id', { count: 'exact', head: true })
      .then(({ count }) => setQuestionCount(count || 0))
  }, [])

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-lg font-bold text-amber-400">婚调大比武</h1>
          <p className="text-sm text-gray-400 mt-1">后台管理系统</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-sm text-gray-500">quiz-buzzer v1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">📊 仪表盘</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <p className="text-sm text-gray-500 mb-1">比赛状态</p>
              <p className={`text-2xl font-bold ${
                competition?.status === 'active' ? 'text-green-600' :
                competition?.status === 'finished' ? 'text-gray-600' :
                competition?.status === 'paused' ? 'text-yellow-600' :
                'text-gray-400'
              }`}>
                {competition?.status === 'active' ? '进行中' :
                 competition?.status === 'finished' ? '已结束' :
                 competition?.status === 'paused' ? '已暂停' : '未开始'}
              </p>
              {competition && <p className="text-sm text-gray-400 mt-1">{competition.name}</p>}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <p className="text-sm text-gray-500 mb-1">队伍 / 选手</p>
              <p className="text-2xl font-bold">8 / 24</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <p className="text-sm text-gray-500 mb-1">题目总数</p>
              <p className="text-2xl font-bold">{questionCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-bold mb-4">快速操作</h3>
            <div className="flex gap-3">
              <Link href="/competitions" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                创建比赛
              </Link>
              <Link href="/questions" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                管理题目
              </Link>
              <Link href="/control" className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                进入控制台
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
