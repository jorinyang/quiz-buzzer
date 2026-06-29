import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '婚调大比武 - 大屏展示',
  description: '黔西南州第二届"和润黔家"婚调大比武',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-white min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
