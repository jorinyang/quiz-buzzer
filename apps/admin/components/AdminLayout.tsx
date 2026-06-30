'use client'

import { LayoutDashboard, Trophy, FileQuestion, Gamepad2, Users, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/' },
  { icon: Trophy, label: '比赛管理', href: '/competitions' },
  { icon: FileQuestion, label: '题目管理', href: '/questions' },
  { icon: Gamepad2, label: '比赛控制台', href: '/control' },
  { icon: Users, label: '计分面板', href: '/scoring' },
  { icon: Settings, label: '系统设置', href: '/settings' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-lg font-bold text-amber-400">婚调大比武</h1>
        <p className="text-sm text-gray-400 mt-1">后台管理系统</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
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
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  )
}
