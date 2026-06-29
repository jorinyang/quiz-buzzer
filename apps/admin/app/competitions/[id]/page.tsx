'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'

export default function CompetitionDetailPage({ params }: { params: { id: string } }) {
  const [competition, setCompetition] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = getSupabase()

  useEffect(() => {
    loadCompetition()
  }, [])

  async function loadCompetition() {
    setLoading(true)
    const { data: comp } = await supabase.from('competitions').select('*, rounds(*)').eq('id', params.id).single()
    if (comp) {
      setCompetition(comp)
      setRounds(comp.rounds || [])
    }
    setLoading(false)
  }

  async function addRound() {
    const roundTypes = [
      { type: 'required', title: '法律知识竞答 - 必答环节', config: { questionCount: 48, timeLimit: 10, scoreCorrect: 10, scoreWrong: 0 } },
      { type: 'buzzer', title: '法律知识竞答 - 抢答环节', config: { questionCount: 20, timeLimit: 10, scoreCorrect: 10, scoreWrong: -10 } },
      { type: 'simulation', title: '模拟调解环节', config: { questionCount: 15, timeLimit: 600, scoreMax: 100 } },
    ]
    const type = prompt('环节类型（required/buzzer/simulation）：', 'required')
    const rt = roundTypes.find(r => r.type === type)
    if (!rt) return alert('无效的环节类型')
    await supabase.from('rounds').insert({
      competition_id: params.id,
      round_type: rt.type,
      round_order: rounds.length + 1,
      title: rt.title,
      config: rt.config,
      status: 'pending',
    })
    loadCompetition()
  }

  async function updateRoundConfig(id: string, key: string, value: number) {
    const round = rounds.find(r => r.id === id)
    if (!round) return
    const config = { ...(round.config || {}) }
    config[key] = value
    await supabase.from('rounds').update({ config }).eq('id', id)
    loadCompetition()
  }

  async function removeRound(id: string) {
    if (!confirm('删除此环节？')) return
    await supabase.from('rounds').delete().eq('id', id)
    loadCompetition()
  }

  if (loading) return <div className="max-w-4xl mx-auto p-8 text-gray-500">加载中...</div>
  if (!competition) return <div className="max-w-4xl mx-auto p-8 text-red-500">比赛不存在</div>

  const typeLabels: Record<string, string> = { required: '必答环节', buzzer: '抢答环节', simulation: '模拟调解' }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => router.push('/competitions')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> 返回比赛列表
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">{competition.name}</h2>
          <p className="text-gray-500 mt-1">
            状态：{competition.status} · 环节数：{rounds.length}
          </p>
        </div>
        <button onClick={addRound} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-5 h-5" /> 添加环节
        </button>
      </div>

      {rounds.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <p className="text-gray-500">暂无环节配置</p>
          <button onClick={addRound} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">添加第一个环节</button>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round: any, i: number) => (
            <div key={round.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {i + 1}. {round.title}（{typeLabels[round.round_type] || round.round_type}）
                </h3>
                <button onClick={() => removeRound(round.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {round.round_type === 'required' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">题目数量</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.questionCount || 48}
                        onChange={(e) => updateRoundConfig(round.id, 'questionCount', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">答题时限（秒）</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.timeLimit || 10}
                        onChange={(e) => updateRoundConfig(round.id, 'timeLimit', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">答对加分</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.scoreCorrect || 10}
                        onChange={(e) => updateRoundConfig(round.id, 'scoreCorrect', parseInt(e.target.value) || 0)} />
                    </div>
                  </>
                )}

                {round.round_type === 'buzzer' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">题目数量</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.questionCount || 20}
                        onChange={(e) => updateRoundConfig(round.id, 'questionCount', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">抢答时限（秒）</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.timeLimit || 10}
                        onChange={(e) => updateRoundConfig(round.id, 'timeLimit', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">答错扣分</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.scoreWrong || -10}
                        onChange={(e) => updateRoundConfig(round.id, 'scoreWrong', parseInt(e.target.value) || 0)} />
                    </div>
                  </>
                )}

                {round.round_type === 'simulation' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">案例数量</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.questionCount || 15}
                        onChange={(e) => updateRoundConfig(round.id, 'questionCount', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">模拟时限（秒）</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.timeLimit || 600}
                        onChange={(e) => updateRoundConfig(round.id, 'timeLimit', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-500">满分</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg" value={round.config?.scoreMax || 100}
                        onChange={(e) => updateRoundConfig(round.id, 'scoreMax', parseInt(e.target.value) || 0)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
