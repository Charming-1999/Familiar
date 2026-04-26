import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Copy, Plus, Search, Trash2, ExternalLink, Pencil, Check, X } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
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
        请先登录后使用"精选网站"。
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">精选网站</h2>
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

      <div className="glass-card p-5 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">新增站点</div>
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
                placeholder="例如：Supabase Docs"
                className="bg-background/80 border-border/50 focus:border-primary transition-colors"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                URL <span className="text-red-400">*</span>
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(clampUrl(e.target.value))}
                placeholder="https://... 或 domain.com"
                className="bg-background/80 border-border/50 focus:border-primary transition-colors font-mono text-sm"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">描述（可选）</label>
            <Input
              value={description}
              onChange={(e) => setDescription(clampDescription(e.target.value))}
              placeholder="一句话说明用途"
              className="bg-background/80 border-border/50 focus:border-primary transition-colors"
              disabled={submitting}
            />
            <div className="flex items-center justify-end pt-1">
              <Button 
                size="sm" 
                onClick={handleSubmit} 
                disabled={submitting || !title.trim() || !url.trim()}
                className="h-8 px-4 bg-primary hover:bg-primary/90"
              >
                {submitting ? '提交中...' : '提交站点'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          最新收录 ({filtered.length})
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto pb-2">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <div className="text-sm text-muted-foreground">暂无站点，快来添加第一个吧！</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {filtered.map((it) => {
              const mine = it.created_by === user.id
              const isEditing = editingId === it.id
              return (
                <div 
                  key={it.id} 
                  className="glass-card p-4 rounded-xl border border-border hover:border-primary/30 transition-all group"
                >
                  {!isEditing ? (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors mb-1.5">
                            {it.title}
                          </div>
                          {it.description && (
                            <div className="text-sm text-muted-foreground leading-relaxed mb-2">
                              {it.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-primary/80 hover:text-primary hover:underline truncate font-mono mb-3 px-2 py-1.5 bg-primary/5 rounded border border-primary/10"
                        title={it.url}
                      >
                        🔗 {it.url}
                      </a>

                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="text-[10px] text-muted-foreground/70">
                          {it.created_by_email || it.created_by}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-primary/10"
                            onClick={() => {
                              try {
                                window.open(it.url, '_blank', 'noreferrer')
                              } catch {
                                // Ignore popup blocker / window open errors.
                              }
                            }}
                            title="打开"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-primary/10"
                            onClick={async () => {
                              const ok = await copyText(it.url)
                              setInfo(ok ? '✓ 已复制' : '复制失败')
                              clearInfoSoon()
                            }}
                            title="复制"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>

                          {mine && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-primary/10"
                                onClick={() => beginEdit(it)}
                                title="编辑"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-400/10"
                                onClick={() => handleDelete(it.id)}
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(clampTitle(e.target.value))}
                        className="bg-muted/10"
                        disabled={submitting}
                        placeholder="标题"
                      />
                      <Input
                        value={editUrl}
                        onChange={(e) => setEditUrl(clampUrl(e.target.value))}
                        className="bg-muted/10 font-mono text-sm"
                        disabled={submitting}
                        placeholder="URL"
                      />
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(clampDescription(e.target.value))}
                        className="bg-muted/10"
                        disabled={submitting}
                        placeholder="描述（可选）"
                      />
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3"
                          onClick={cancelEdit}
                          disabled={submitting}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3"
                          onClick={saveEdit}
                          disabled={submitting}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          保存
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
