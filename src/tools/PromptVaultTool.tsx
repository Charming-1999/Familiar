import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Copy, Plus, Search, Trash2 } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'

type PromptItem = {
  id: string
  title: string
  description: string | null
  prompt: string
  created_by: string
  created_by_email: string | null
  created_at: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatLocal(ts: string) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function clampTitle(s: string) {
  return s.slice(0, 80)
}

function clampDescription(s: string) {
  return s.slice(0, 280)
}

function clampPrompt(s: string) {
  return s.slice(0, 50000)
}

export const PromptVaultTool: React.FC = () => {
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [items, setItems] = useState<PromptItem[]>([])
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')

  const infoTimerRef = useRef<number | null>(null)

  const clearInfoSoon = () => {
    if (infoTimerRef.current != null) window.clearTimeout(infoTimerRef.current)
    infoTimerRef.current = window.setTimeout(() => {
      infoTimerRef.current = null
      setInfo(null)
    }, 2500)
  }

  const load = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('prompt_vault_items')
        .select('id,title,description,prompt,created_by,created_by_email,created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setItems((data || []) as PromptItem[])
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = `${it.title}\n${it.description || ''}\n${it.prompt}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const handleSubmit = async () => {
    if (!user) return
    const t = title.trim()
    const p = prompt.trim()
    if (!t || !p) {
      setError('标题和 Prompt 不能为空')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const createdByEmail = profile?.email || user.email || null
      const payload = {
        title: t,
        description: description.trim() ? description.trim() : null,
        prompt: p,
        created_by: user.id,
        created_by_email: createdByEmail,
      }

      const { data, error } = await supabase
        .from('prompt_vault_items')
        .insert(payload)
        .select('id,title,description,prompt,created_by,created_by_email,created_at')
        .single()

      if (error) throw error
      if (data) setItems((prev) => [data as PromptItem, ...prev])

      setTitle('')
      setDescription('')
      setPrompt('')
      setInfo('已提交')
      clearInfoSoon()
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这条 Prompt 吗？')
    if (!ok) return

    setError(null)
    try {
      const { error } = await supabase.from('prompt_vault_items').delete().eq('id', id).eq('created_by', user.id)
      if (error) throw error
      setItems((prev) => prev.filter((x) => x.id !== id))
      setInfo('已删除')
      clearInfoSoon()
    } catch (e: any) {
      setError(e?.message || '删除失败')
    }
  }

  if (!user) {
    return (
      <div className="glass-card p-6 rounded-lg text-sm text-muted-foreground">
        请先登录后使用"Prompt 市场"。
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">Prompt 市场</h2>
        </div>

        <div className="w-full sm:w-80">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索（标题/描述/Prompt）..."
              className="pl-9 bg-muted/10"
            />
          </div>
        </div>
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : null}
      {info ? <div className="text-xs text-primary">{info}</div> : null}

      <div className="glass-card p-5 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">提交优质 Prompt</div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                标题 <span className="text-red-400">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(clampTitle(e.target.value))}
                placeholder="例如：小红书爆款标题生成器"
                className="bg-background/80 border-border/50 focus:border-primary transition-colors"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">描述（可选）</label>
              <Input
                value={description}
                onChange={(e) => setDescription(clampDescription(e.target.value))}
                placeholder="一句话说明适用场景/输入输出"
                className="bg-background/80 border-border/50 focus:border-primary transition-colors"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              Prompt <span className="text-red-400">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(clampPrompt(e.target.value))}
              placeholder="粘贴你的完整 Prompt 内容..."
              className={cn(
                'w-full min-h-[120px] resize-y rounded-lg border border-border/50 bg-background/80',
                'px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
              )}
              disabled={submitting}
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{prompt.length} / 50,000 字符</span>
              <Button 
                size="sm" 
                onClick={handleSubmit} 
                disabled={submitting || !title.trim() || !prompt.trim()}
                className="h-8 px-4 bg-primary hover:bg-primary/90"
              >
                {submitting ? '提交中...' : '提交 Prompt'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          最新收录 ({filtered.length})
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-3 pb-2">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">暂无 Prompt，快来提交第一个吧！</div>
          </div>
        ) : (
          filtered.map((it) => {
            const mine = it.created_by === user.id
            const isExpanded = !!expandedIds[it.id]
            const lineCount = it.prompt.split(/\r\n|\r|\n/).length
            const shouldCollapse = lineCount > 5 || it.prompt.length > 500

            return (
              <div 
                key={it.id} 
                className="glass-card p-4 rounded-xl border border-border hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {it.title}
                    </div>
                    {it.description && (
                      <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {it.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 mt-2">
                      <span>贡献者：{it.created_by_email || it.created_by}</span>
                      <span>·</span>
                      <span>{formatLocal(it.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 hover:bg-primary/10"
                      onClick={async () => {
                        const ok = await copyText(it.prompt)
                        setInfo(ok ? '✓ 已复制到剪贴板' : '复制失败')
                        clearInfoSoon()
                      }}
                      title="复制 Prompt"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>

                    {mine && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-red-400 hover:text-red-500 hover:bg-red-400/10"
                        onClick={() => handleDelete(it.id)}
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="bg-muted/20 border border-border/50 rounded-lg p-3 relative">
                  <div
                    className={cn(
                      'whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90',
                      !isExpanded && shouldCollapse && 'line-clamp-5'
                    )}
                  >
                    {it.prompt}
                  </div>
                  {shouldCollapse && (
                    <button
                      className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-background/90 border border-border text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => setExpandedIds((m) => ({ ...m, [it.id]: !m[it.id] }))}
                    >
                      {isExpanded ? '收起 ↑' : '展开 ↓'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
