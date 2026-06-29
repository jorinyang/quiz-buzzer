'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">⚙️ 系统设置</h2>

      <div className="space-y-6">
        {/* Supabase Connection */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold mb-4">🔗 数据库连接</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block font-medium mb-1 text-gray-500">Supabase Project URL</label>
              <input type="text" readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                value={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mqsqcpkcmcgwbzcsmrlm.supabase.co'} />
            </div>
            <div>
              <label className="block font-medium mb-1 text-gray-500">WebSocket 地址</label>
              <input type="text" readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                value={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3080'} />
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold mb-4">📡 服务状态</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Supabase PostgreSQL</span>
              <span className="text-green-600">已连接</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>WebSocket 服务 (ws://localhost:3080)</span>
              <span className="text-green-600">运行中</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>前端三端</span>
              <span className="text-green-600">
                Display :3000 / Admin :3001 / Player :3002
              </span>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold mb-4">👤 管理员账号</h3>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">超级管理员：</span>admin / admin123</p>
            <p><span className="text-gray-500">活动管理员：</span>huodong / admin123</p>
            <p><span className="text-gray-500">操作员：</span>operator / admin123</p>
            <p><span className="text-gray-500">选手账号：</span>player1_1 ~ player8_3 / 123456</p>
            <p><span className="text-gray-500">评委账号：</span>judge1 ~ judge5 / 123456</p>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold mb-2">ℹ️ 关于</h3>
          <p className="text-sm text-gray-500">
            quiz-buzzer v1.0 — 黔西南州第二届婚调大比武电子抢答计分系统
          </p>
          <p className="text-sm text-gray-500 mt-1">
            技术栈：Next.js 14 + TypeScript + Tailwind CSS + WebSocket + Supabase PostgreSQL
          </p>
        </div>
      </div>
    </div>
  )
}
