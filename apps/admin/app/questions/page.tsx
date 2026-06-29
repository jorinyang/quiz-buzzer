'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@quiz-buzzer/shared'
import { Plus, Upload, Search, Edit, Trash2, Filter } from 'lucide-react'

const QUESTION_TYPES = {
  choice: '选择题',
  true_false: '判断题',
  fill_blank: '填空题',
  short_answer: '简答题',
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const [form, setForm] = useState({
    type: 'choice',
    content: '',
    options: ['', '', '', ''],
    answer: '',
    score_value: 10,
    sort_order: 0,
  })

  const supabase = getSupabase()

  useEffect(() => { loadQuestions() }, [typeFilter])

  async function loadQuestions() {
    setLoading(true)
    let q = supabase.from('questions').select('*, competitions(name), rounds(title)').order('sort_order')
    if (typeFilter) q = q.eq('type', typeFilter)
    const { data } = await q.range(0, 99)
    setQuestions(data || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ type: 'choice', content: '', options: ['', '', '', ''], answer: '', score_value: 10, sort_order: 0 })
    setEditing(null)
    setShowForm(false)
  }

  function editQuestion(q: any) {
    setEditing(q)
    setForm({
      type: q.type,
      content: q.content,
      options: q.options || ['', '', '', ''],
      answer: q.answer,
      score_value: q.score_value,
      sort_order: q.sort_order,
    })
    setShowForm(true)
  }

  async function saveQuestion() {
    const payload = {
      competition_id: null,
      type: form.type,
      content: form.content,
      options: ['choice', 'true_false'].includes(form.type) ? form.options.filter(Boolean) : null,
      answer: form.answer,
      score_value: form.score_value,
      sort_order: form.sort_order,
    }

    if (editing) {
      await supabase.from('questions').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('questions').insert(payload)
    }
    resetForm()
    loadQuestions()
  }

  async function deleteQuestion(id: string) {
    if (!confirm('确认删除此题？')) return
    await supabase.from('questions').delete().eq('id', id)
    loadQuestions()
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      try {
        const items = JSON.parse(text)
        if (Array.isArray(items)) {
          for (const item of items) {
            await supabase.from('questions').insert({
              competition_id: null,
              type: item.type || 'choice',
              content: item.content,
              options: item.options || null,
              answer: item.answer,
              score_value: item.score_value || 10,
              sort_order: item.sort_order || 0,
            })
          }
          loadQuestions()
          alert(`成功导入 ${items.length} 道题目`)
        }
      } catch (e) {
        alert('JSON 格式错误')
      }
    }
    input.click()
  }

  const filtered = questions.filter((q) =>
    !search || q.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">📝 题目管理</h2>
        <div className="flex items-center gap-3">
          <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Upload className="w-5 h-5" /> 批量导入
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-5 h-5" /> 新增题目
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center flex-1 bg-white rounded-lg border shadow-sm px-4 py-2">
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="搜索题目内容..."
            className="flex-1 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            className="px-3 py-2 border rounded-lg bg-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">全部类型</option>
            {Object.entries(QUESTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Question Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">{editing ? '编辑题目' : '新增题目'}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">题型</label>
                <select className="w-full px-3 py-2 border rounded-lg" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">题目内容</label>
                <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>

              {['choice', 'true_false'].includes(form.type) && (
                <div>
                  <label className="block text-sm font-medium mb-1">选项</label>
                  <div className="space-y-2">
                    {form.options.map((opt: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-sm text-gray-500">{String.fromCharCode(65 + i)}.</span>
                        <input className="flex-1 px-3 py-1.5 border rounded-lg" value={opt}
                          onChange={(e) => {
                            const newOpts = [...form.options]
                            newOpts[i] = e.target.value
                            setForm({ ...form, options: newOpts })
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">正确答案</label>
                <input className="w-full px-3 py-2 border rounded-lg" value={form.answer}
                  placeholder={form.type === 'choice' ? 'A/B/C/D' : form.type === 'true_false' ? 'T/F' : '输入答案'}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })} />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">分值</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" value={form.score_value}
                    onChange={(e) => setForm({ ...form, score_value: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={saveQuestion} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editing ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 w-16">#</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">题目内容</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 w-24">题型</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 w-16">分值</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <tr key={q.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-500">{q.sort_order || i + 1}</td>
                  <td className="px-6 py-3">{q.content}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {QUESTION_TYPES[q.type as keyof typeof QUESTION_TYPES]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">{q.score_value}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => editQuestion(q)} className="p-1.5 text-gray-400 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteQuestion(q.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">暂无题目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
