'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Plus, Play, Pause, Settings, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabase()

  useEffect(() => {
    loadCompetitions()
  }, [])

  async function loadCompetitions() {
    setLoading(true)
    const { data } = await supabase.from('competitions').select('*, rounds(*)').order('created_at', { ascending: false })
    setCompetitions(data || [])
    setLoading(false)
  }

  async function createCompetition() {
    const name = prompt('比赛名称：')
    if (!name) return
    await supabase.from('competitions').insert({ name, status: 'pending' })
    loadCompetitions()
  }

  async function deleteCompetition(id: string) {
    if (!confirm('确认删除此比赛？')) return
    await supabase.from('competitions').delete().eq('id', id)
    loadCompetitions()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('competitions').update({ status }).eq('id', id)
    loadCompetitions()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">🏆 比赛管理</h2>
        <button
          onClick={createCompetition}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" /> 创建比赛
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : competitions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <p className="text-gray-500 text-lg mb-4">暂无比赛</p>
          <button onClick={createCompetition} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            创建第一个比赛
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {competitions.map((comp) => (
            <div key={comp.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{comp.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.status === 'active' ? 'bg-green-100 text-green-700' :
                      comp.status === 'finished' ? 'bg-gray-100 text-gray-600' :
                      comp.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {comp.status === 'active' ? '🟢 进行中' :
                       comp.status === 'finished' ? '⚫ 已结束' :
                       comp.status === 'paused' ? '🟡 已暂停' :
                       '🔵 未开始'}
                    </span>
                    <span>环节数：{comp.rounds?.length || 0}</span>
                    <span>题目数：--</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {comp.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(comp.id, 'active')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      <Play className="w-4 h-4" /> 开始
                    </button>
                  )}
                  {comp.status === 'active' && (
                    <button
                      onClick={() => updateStatus(comp.id, 'paused')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
                    >
                      <Pause className="w-4 h-4" /> 暂停
                    </button>
                  )}
                  {comp.status === 'paused' && (
                    <button
                      onClick={() => updateStatus(comp.id, 'active')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      <Play className="w-4 h-4" /> 恢复
                    </button>
                  )}
                  <Link
                    href={`/competitions/${comp.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Settings className="w-4 h-4" /> 配置
                  </Link>
                  <button
                    onClick={() => deleteCompetition(comp.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rounds preview */}
              {comp.rounds?.length > 0 && (
                <div className="flex gap-2">
                  {comp.rounds.map((r: any) => (
                    <span key={r.id} className="px-3 py-1 bg-gray-50 rounded-lg text-sm text-gray-600 border">
                      {r.round_order}. {r.title.split(' - ')[0]} ({r.round_type === 'required' ? '必答' : r.round_type === 'buzzer' ? '抢答' : '模拟调解'})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
