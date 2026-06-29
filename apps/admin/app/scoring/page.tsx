'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Plus, Minus, RotateCcw } from 'lucide-react'

export default function ScoringPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [scoreRecords, setScoreRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabase()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [pRes, tRes, sRes] = await Promise.all([
      supabase.from('users').select('*, teams(name)').eq('role', 'player').order('created_at'),
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('score_records').select('*, users(display_name), teams(name)').order('created_at', { ascending: false }).limit(50),
    ])
    setPlayers(pRes.data || [])
    setTeams(tRes.data || [])
    setScoreRecords(sRes.data || [])
    setLoading(false)
  }

  async function adjustScore(playerId: string, teamId: string, change: number, reason: string) {
    await supabase.from('score_records').insert({
      competition_id: null,
      player_id: playerId,
      team_id: teamId,
      score_change: change,
      reason: reason,
    })
    loadData()
  }

  async function undoLastRecord(recordId: string) {
    if (!confirm('撤销此计分操作？')) return
    const record = scoreRecords.find(r => r.id === recordId)
    if (record) {
      await supabase.from('score_records').insert({
        competition_id: record.competition_id,
        player_id: record.player_id,
        team_id: record.team_id,
        score_change: -record.score_change,
        reason: '撤销: ' + (record.reason || ''),
      })
    }
    loadData()
  }

  // Calculate totals
  const playerTotals = new Map<string, number>()
  const teamTotals = new Map<string, number>()
  for (const r of scoreRecords) {
    playerTotals.set(r.player_id, (playerTotals.get(r.player_id) || 0) + r.score_change)
    teamTotals.set(r.team_id, (teamTotals.get(r.team_id) || 0) + r.score_change)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">📊 计分面板</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Scores */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">选手</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">队伍</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">总分</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">快捷操作</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.display_name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.teams?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-lg">
                        {playerTotals.get(p.id) || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustScore(p.id, p.team_id, 10, '手动加分')}
                            className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => adjustScore(p.id, p.team_id, -10, '手动扣分')}
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Rankings */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-4">🏆 团队排名</h3>
              <div className="space-y-2">
                {teams
                  .map((t: any) => ({ ...t, total: teamTotals.get(t.id) || 0 }))
                  .sort((a: any, b: any) => b.total - a.total)
                  .map((t: any, i: number) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-lg w-6 ${
                          i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-400'
                        }`}>{i + 1}</span>
                        <span>{t.name}</span>
                      </div>
                      <span className="font-bold text-lg">{t.total}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Recent Records */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold mb-3">📜 最近计分记录</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scoreRecords.slice(0, 20).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50">
                    <div>
                      <span className="font-medium">{r.users?.display_name}</span>
                      <span className="text-gray-400 ml-2">{r.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${r.score_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {r.score_change >= 0 ? '+' : ''}{r.score_change}
                      </span>
                      <button
                        onClick={() => undoLastRecord(r.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="撤销"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
