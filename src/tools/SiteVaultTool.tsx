import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Copy, Plus, Search, Trash2, ExternalLink, Pencil, Check, X } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'

type SiteItem = {
  id: string
  title: string
  description: string | null
  url: string
  created_by: string
  created_by_email: string | null
  created_at: string
  updated_at: string
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
  return s.slice(0, 120)
}

function clampDescription(s: string) {
  return s.slice(0, 400)
}

function clampUrl(s: string) {
  return s.slice(0, 2048)
}

function normalizeUrl(raw: string) {
  const v = raw.trim()
  if (!v) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v
  return `https://${v}`
}

function isValidUrl(raw: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(raw)
    return true
  } catch {
    return false
  }
}

export const SiteVaultTool: React.FC = () => {
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [items, setItems] = useState<SiteItem[]>([])
  const [query, setQuery] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editUrl, setEditUrl] = useState('')

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
        .from('site_vault_items')
        .select('id,title,description,url,created_by,created_by_email,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setItems((data || []) as SiteItem[])
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
      const hay = `${it.title}\n${it.description || ''}\n${it.url}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const handleSubmit = async () => {
    if (!user) return
    const t = title.trim()
    const u0 = normalizeUrl(url)
    if (!t || !u0) {
      setError('标题和 URL 不能为空')
      return
    }
    if (!isValidUrl(u0)) {
      setError('URL 格式不正确')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const createdByEmail = profile?.email || user.email || null
      const payload = {
        title: t,
        description: description.trim() ? description.trim() : null,
        url: u0,
        created_by: user.id,
        created_by_email: createdByEmail,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('site_vault_items')
        .insert(payload)
        .select('id,title,description,url,created_by,created_by_email,created_at,updated_at')
        .single()

      if (error) throw error
      if (data) setItems((prev) => [data as SiteItem, ...prev])

      setTitle('')
      setDescription('')
      setUrl('')
      setInfo('已提交')
      clearInfoSoon()
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const beginEdit = (it: SiteItem) => {
    setEditingId(it.id)
    setEditTitle(it.title)
    setEditDescription(it.description || '')
    setEditUrl(it.url)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDescription('')
    setEditUrl('')
    setError(null)
  }

  const saveEdit = async () => {
    if (!user || !editingId) return
    const t = editTitle.trim()
    const u0 = normalizeUrl(editUrl)
    if (!t || !u0) {
      setError('标题和 URL 不能为空')
      return
    }
    if (!isValidUrl(u0)) {
      setError('URL 格式不正确')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const patch = {
        title: t,
        description: editDescription.trim() ? editDescription.trim() : null,
        url: u0,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('site_vault_items')
        .update(patch)
        .eq('id', editingId)
        .eq('created_by', user.id)
        .select('id,title,description,url,created_by,created_by_email,created_at,updated_at')
        .single()

      if (error) throw error
      if (data) {
        setItems((prev) => prev.map((x) => (x.id === editingId ? (data as SiteItem) : x)))
      }

      cancelEdit()
      setInfo('已保存')
      clearInfoSoon()
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这个站点吗？')
    if (!ok) return

    setError(null)
    try {
      const { error } = await supabase.from('site_vault_items').delete().eq('id', id).eq('created_by', user.id)
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
        请先登录后使用“精选站点集”。
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">精选站点集</h2>
        </div>

        <div className="w-full sm:w-80">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索（标题/描述/URL）..."
              className="pl-9 bg-muted/10"
            />
          </div>
        </div>
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : null}
      {info ? <div className="text-xs text-primary">{info}</div> : null}

      <div className="glass-card p-4 rounded-xl border border-border space-y-3">
        <div className="text-sm font-semibold text-foreground">新增站点</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">标题（必填）</div>
            <Input
              value={title}
              onChange={(e) => setTitle(clampTitle(e.target.value))}
              placeholder="例如：Supabase Docs"
              className="bg-muted/10"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">URL（必填）</div>
            <Input
              value={url}
              onChange={(e) => setUrl(clampUrl(e.target.value))}
              placeholder="https://... 或 domain.com"
              className="bg-muted/10 font-mono"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">描述（可选）</div>
          <Input
            value={description}
            onChange={(e) => setDescription(clampDescription(e.target.value))}
            placeholder="一句话说明用途"
            className="bg-muted/10"
            disabled={submitting}
          />
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim() || !url.trim()} className="space-x-1">
              <Plus className="w-4 h-4" />
              <span>{submitting ? '提交中…' : '提交'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">最新收录</div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          刷新
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-3">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">暂无内容</div>
        ) : (
          filtered.map((it) => {
            const mine = it.created_by === user.id
            const isEditing = editingId === it.id
            return (
              <div key={it.id} className="glass-card p-4 rounded-xl border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {!isEditing ? (
                      <>
                        <div className="text-base font-bold text-foreground truncate">{it.title}</div>
                        {it.description ? <div className="text-sm text-muted-foreground mt-1">{it.description}</div> : null}
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-[12px] text-primary hover:underline truncate font-mono"
                          title={it.url}
                        >
                          {it.url}
                        </a>
                        <div className="text-[11px] text-muted-foreground mt-2">
                          贡献者：{it.created_by_email || it.created_by} · 更新于 {formatLocal(it.updated_at)}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(clampTitle(e.target.value))}
                          className="bg-muted/10"
                          disabled={submitting}
                        />
                        <Input
                          value={editUrl}
                          onChange={(e) => setEditUrl(clampUrl(e.target.value))}
                          className="bg-muted/10 font-mono"
                          disabled={submitting}
                        />
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(clampDescription(e.target.value))}
                          className="bg-muted/10"
                          disabled={submitting}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="space-x-1"
                          onClick={() => {
                            try {
                              window.open(it.url, '_blank', 'noreferrer')
                            } catch {
                              // ignore
                            }
                          }}
                          title="打开"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>打开</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="space-x-1"
                          onClick={async () => {
                            const ok = await copyText(it.url)
                            setInfo(ok ? '已复制' : '复制失败')
                            clearInfoSoon()
                          }}
                          title="复制 URL"
                        >
                          <Copy className="w-4 h-4" />
                          <span>复制</span>
                        </Button>

                        {mine ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="space-x-1"
                              onClick={() => beginEdit(it)}
                              title="编辑"
                            >
                              <Pencil className="w-4 h-4" />
                              <span>编辑</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="space-x-1 text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20"
                              onClick={() => handleDelete(it.id)}
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>删除</span>
                            </Button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn('space-x-1', submitting && 'opacity-60 pointer-events-none')}
                          onClick={saveEdit}
                          title="保存"
                        >
                          <Check className="w-4 h-4" />
                          <span>保存</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="space-x-1"
                          onClick={cancelEdit}
                          title="取消"
                          disabled={submitting}
                        >
                          <X className="w-4 h-4" />
                          <span>取消</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
