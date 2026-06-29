'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Send } from 'lucide-react'

export default function JudgePage() {
  const [playerName, setPlayerName] = useState('等待选手...')
  const [scores, setScores] = useState({ lawApply: 0, process: 0, communication: 0, effect: 0 })
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const supabase = getSupabase()

  const total = scores.lawApply + scores.process + scores.communication + scores.effect

  function updateScore(key: string, value: number) {
    setScores(prev => ({ ...prev, [key]: Math.min(25, Math.max(0, value)) }))
  }

  async function submitScore() {
    if (total === 0) return
    setSubmitted(true)

    await supabase.from('judge_scores').insert({
      competition_id: null,
      player_id: 'current',
      judge_id: 'current-judge',
      criterion_scores: scores,
      total_score: total,
      comment: comment || null,
    })

    setTimeout(() => {
      setSubmitted(false)
      setScores({ lawApply: 0, process: 0, communication: 0, effect: 0 })
      setComment('')
    }, 2000)
  }

  return (
    <main className="flex flex-col min-h-screen p-4 max-w-md mx-auto bg-gray-50">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">评委打分</h1>
        <p className="text-gray-500 mt-1">当前选手：<span className="font-bold">{playerName}</span></p>
      </div>

      {/* Criteria Scores */}
      <div className="space-y-4 flex-1">
        {[
          { key: 'lawApply', label: '法律政策运用', desc: '法律知识基础、条文引用、灵活运用' },
          { key: 'process', label: '调解流程规范性', desc: '四阶段流程、操作规范' },
          { key: 'communication', label: '沟通与情绪疏导', desc: '表达清晰、情感引导、心理调控' },
          { key: 'effect', label: '调解成效与协议', desc: '达成调解、协议合理、公平公正' },
        ].map(c => (
          <div key={c.key} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold">{c.label}</label>
              <span className="text-2xl font-bold text-blue-600">
                {scores[c.key as keyof typeof scores]}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">{c.desc}</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="25"
                value={scores[c.key as keyof typeof scores]}
                onChange={(e) => updateScore(c.key, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex gap-1">
                {[0, 5, 10, 15, 20, 25].map(v => (
                  <button
                    key={v}
                    onClick={() => updateScore(c.key, v)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      scores[c.key as keyof typeof scores] === v
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total & Submit */}
      <div className="mt-4 bg-white rounded-xl shadow-sm p-5 sticky bottom-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold">总分</span>
          <span className={`text-4xl font-bold transition-colors ${
            total >= 90 ? 'text-green-600' :
            total >= 75 ? 'text-blue-600' :
            total >= 60 ? 'text-yellow-600' :
            'text-red-600'
          }`}>{total}</span>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-500">备注（可选）</label>
          <textarea
            className="w-full px-4 py-2 border rounded-lg resize-none text-sm"
            rows={2}
            placeholder="评分备注..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <button
          onClick={submitScore}
          disabled={submitted}
          className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
            submitted
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Send className="w-5 h-5" />
          {submitted ? '已提交 ✅' : '提交评分'}
        </button>
      </div>
    </main>
  )
}
