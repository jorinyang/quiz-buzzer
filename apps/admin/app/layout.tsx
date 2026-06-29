import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '后台管理 - 婚调大比武',
  description: '比赛控制台、题目管理、计分系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
