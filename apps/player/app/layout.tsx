import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '选手端 - 婚调大比武',
  description: '抢答、评委打分',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-100 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
