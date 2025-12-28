import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { NotebookPen, Plus, Save, X, Search, GripVertical, Trash2, FileText, FileCode2 } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'

type NoteFormat = 'plain' | 'markdown'

type Note = {
  id: string
  user_id: string
  title: string
  content: string
  format: NoteFormat
  order_index: number
  created_at: string
  updated_at: string
}

function clampTitleInput(s: string) {
  return s.slice(0, 80)
}

function normalizeTitleForSave(s: string) {
  const t = s.trim().slice(0, 80)
  return t.length ? t : '未命名'
}


export const NotesTool: React.FC = () => {
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notes, setNotes] = useState<Note[]>([])
  const [openIds, setOpenIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')

  const dragSourceIdRef = useRef<string | null>(null)
  const saveTimersRef = useRef<Record<string, number>>({})

  const notesById = useMemo(() => {
    const m = new Map<string, Note>()
    notes.forEach((n) => m.set(n.id, n))
    return m
  }, [notes])

  const orderedNotes = useMemo(() => {
    return [...notes].sort((a, b) => a.order_index - b.order_index || a.updated_at.localeCompare(b.updated_at))
  }, [notes])

  const openTabs = useMemo(() => {
    const set = new Set(openIds)
    return orderedNotes.filter((n) => set.has(n.id))
  }, [openIds, orderedNotes])

  const activeNote = activeId ? notesById.get(activeId) || null : null

  const filteredPaletteNotes = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase()
    if (!q) return orderedNotes
    return orderedNotes.filter((n) => {
      const hay = `${n.title}\n${n.content}`.toLowerCase()
      return hay.includes(q)
    })
  }, [paletteQuery, orderedNotes])

  const loadNotes = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id,user_id,title,content,format,order_index,created_at,updated_at')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
        .order('updated_at', { ascending: false })

      if (error) throw error
      const list = (data || []) as Note[]
      setNotes(list)
      if (list.length > 0) {
        const firstId = list[0].id
        setOpenIds((prev) => (prev.length ? prev : [firstId]))
        setActiveId((prev) => prev || firstId)
      }
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const scheduleSave = (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'format' | 'order_index'>>) => {
    if (!user) return
    const existing = saveTimersRef.current[id]
    if (existing) window.clearTimeout(existing)

    setSavingIds((m) => ({ ...m, [id]: true }))
    const timer = window.setTimeout(async () => {
      try {
        const payload = { ...patch, updated_at: new Date().toISOString() }
        const { error } = await supabase.from('notes').update(payload).eq('id', id).eq('user_id', user.id)
        if (error) throw error
      } catch (e: any) {
        setError(e.message || '保存失败')
      } finally {
        setSavingIds((m) => ({ ...m, [id]: false }))
      }
    }, 500)

    saveTimersRef.current[id] = timer
  }

  const handleCreate = async () => {
    if (!user) return
    setError(null)
    try {
      const nextIndex = orderedNotes.length
      const payload = {
        user_id: user.id,
        title: '未命名',
        content: '',
        format: 'plain' as NoteFormat,
        order_index: nextIndex,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('notes')
        .insert(payload)
        .select('id,user_id,title,content,format,order_index,created_at,updated_at')
        .single()
      if (error) throw error

      const note = data as Note
      setNotes((prev) => [...prev, note])
      setOpenIds((prev) => (prev.includes(note.id) ? prev : [...prev, note.id]))
      setActiveId(note.id)
    } catch (e: any) {
      setError(e.message || '新建失败')
    }
  }

  const openNote = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
  }

  const closeTab = (id: string) => {
    setOpenIds((prev) => {
      const next = prev.filter((x) => x !== id)
      return next
    })
    if (activeId === id) {
      const idx = openTabs.findIndex((t) => t.id === id)
      const fallback = openTabs[idx - 1]?.id || openTabs[idx + 1]?.id || null
      setActiveId(fallback)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这条笔记吗？删除后不可恢复。')
    if (!ok) return

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error

      setNotes((prev) => prev.filter((n) => n.id !== id))
      setOpenIds((prev) => prev.filter((x) => x !== id))
      if (activeId === id) setActiveId(null)
    } catch (e: any) {
      setError(e.message || '删除失败')
    }
  }

  const reorderByMove = async (sourceId: string, targetId: string) => {
    if (!user) return
    if (sourceId === targetId) return

    const current = [...orderedNotes]
    const from = current.findIndex((n) => n.id === sourceId)
    const to = current.findIndex((n) => n.id === targetId)
    if (from < 0 || to < 0) return

    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)

    const next = current.map((n, idx) => ({ ...n, order_index: idx }))
    setNotes(next)

    const changed = next.filter((n, idx) => orderedNotes.find((o) => o.id === n.id)?.order_index !== idx)
    try {
      await Promise.all(
        changed.map((n) =>
          supabase
            .from('notes')
            .update({ order_index: n.order_index, updated_at: new Date().toISOString() })
            .eq('id', n.id)
            .eq('user_id', user.id)
        )
      )
    } catch (e: any) {
      setError(e.message || '排序保存失败')
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey

      if (mod && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        handleCreate()
        return
      }
      if (mod && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (mod && (e.key === 'w' || e.key === 'W')) {
        if (activeId) {
          e.preventDefault()
          closeTab(activeId)
        }
        return
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, orderedNotes.length, user?.id])

  useEffect(() => {
    if (!paletteOpen) {
      setPaletteQuery('')
    }
  }, [paletteOpen])

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">随心记</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)} className="space-x-1">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">搜索/切换</span>
            <span className="text-[10px] text-muted-foreground hidden md:inline">Ctrl/Cmd+P</span>
          </Button>
          <Button size="sm" onClick={handleCreate} className="space-x-1">
            <Plus className="w-4 h-4" />
            <span>新建</span>
            <span className="text-[10px] text-muted-foreground hidden md:inline">Ctrl/Cmd+T</span>
          </Button>
        </div>
      </div>

      {!user ? (
        <div className="glass-card p-6 rounded-lg text-sm text-muted-foreground">
          请先登录后使用“随心记”。笔记数据会绑定当前账户并同步到云端。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-4 flex-1 min-h-0">
          {/* Left list */}
          <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">我的笔记</div>
              <button className="text-xs text-muted-foreground hover:text-primary" onClick={loadNotes} disabled={loading}>
                刷新
              </button>
            </div>
            {error && <div className="px-3 py-2 text-xs text-red-400 border-b border-border">{error}</div>}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">加载中...</div>
              ) : orderedNotes.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">暂无笔记，按 Ctrl/Cmd+T 新建一个。</div>
              ) : (
                <div className="divide-y divide-border/60">
                  {orderedNotes.map((n) => (
                    <button
                      key={n.id}
                      className={cn(
                        'w-full text-left px-3 py-3 hover:bg-muted/30 transition-colors',
                        activeId === n.id && 'bg-primary/10'
                      )}
                      onClick={() => openNote(n.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{n.title?.trim() ? n.title : '未命名'}</div>

                          <div className="text-[11px] text-muted-foreground mt-1 truncate">
                            {n.content ? n.content.replace(/\s+/g, ' ').slice(0, 80) : '（空）'}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 shrink-0">{n.format === 'markdown' ? 'MD' : 'TXT'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right editor */}
          <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
            {/* Tabs */}
            <div className="border-b border-border bg-background/30">
              <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
                {openTabs.map((t) => {
                  const isActive = t.id === activeId
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => {
                        dragSourceIdRef.current = t.id
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const src = dragSourceIdRef.current
                        dragSourceIdRef.current = null
                        if (src) reorderByMove(src, t.id)
                      }}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer select-none',
                        isActive
                          ? 'bg-primary/10 border-primary/30 text-foreground'
                          : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      )}
                      onClick={() => setActiveId(t.id)}
                      title="拖动排序"
                    >
                      <GripVertical className="w-3 h-3 opacity-60" />
                      <span className="text-xs font-medium max-w-[160px] truncate">{t.title?.trim() ? t.title : '未命名'}</span>

                      {savingIds[t.id] ? <Save className="w-3 h-3 text-primary" /> : null}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(t.id)
                        }}
                        title="关闭 (Ctrl/Cmd+W)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
                {openTabs.length === 0 && (
                  <div className="text-xs text-muted-foreground px-2">没有打开的标签页</div>
                )}
              </div>
            </div>

            {/* Editor header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              {activeNote ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Input
                    value={activeNote.title}
                    onChange={(e) => {
                      const raw = e.target.value
                      const title = clampTitleInput(raw)
                      setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, title } : n)))
                      if (raw.trim()) scheduleSave(activeNote.id, { title: normalizeTitleForSave(title) })
                    }}
                    onBlur={() => {
                      const normalized = normalizeTitleForSave(activeNote.title)
                      if (normalized !== activeNote.title) {
                        setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, title: normalized } : n)))
                        scheduleSave(activeNote.id, { title: normalized })
                      }
                    }}
                    className="bg-muted/20 h-9"
                  />

                </div>
              ) : (
                <div className="text-sm text-muted-foreground">请选择或新建一条笔记</div>
              )}

              <div className="flex items-center gap-2">
                {activeNote && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next: NoteFormat = activeNote.format === 'plain' ? 'markdown' : 'plain'
                        setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, format: next } : n)))
                        scheduleSave(activeNote.id, { format: next })
                      }}
                      className="space-x-1"
                      title="切换文本类型"
                    >
                      {activeNote.format === 'markdown' ? <FileCode2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      <span>{activeNote.format === 'markdown' ? 'Markdown' : '纯文本'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20"
                      onClick={() => handleDelete(activeNote.id)}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Editor body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
              <div className="p-4 border-r border-border/60 min-h-0">
                <textarea
                  className="w-full h-full bg-muted/10 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="开始记录...（自动保存到云端）"
                  value={activeNote?.content || ''}
                  onChange={(e) => {
                    if (!activeNote) return
                    const content = e.target.value
                    setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, content } : n)))
                    scheduleSave(activeNote.id, { content })
                  }}
                  disabled={!activeNote}
                />
              </div>

              <div className="p-4 min-h-0 overflow-auto">
                {activeNote?.format === 'markdown' ? (
                  <div className="markdown max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNote.content || ''}</ReactMarkdown>
                  </div>
                ) : (

                  <div className="text-sm text-muted-foreground">
                    纯文本模式不提供渲染预览。切换为 Markdown 可在此处预览效果。
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <div>
                快捷键：<span className="font-mono">Ctrl/Cmd+T</span> 新建，<span className="font-mono">Ctrl/Cmd+P</span> 搜索切换，<span className="font-mono">Ctrl/Cmd+W</span> 关闭标签
              </div>
              <div className="flex items-center gap-2">
                {activeNote && savingIds[activeNote.id] ? <span className="text-primary">Saving...</span> : <span>Saved</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {paletteOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
          <div className="w-full max-w-2xl border border-border rounded-xl bg-background/90 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="搜索标题或内容，回车打开"
                className="bg-muted/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const first = filteredPaletteNotes[0]
                    if (first) {
                      openNote(first.id)
                      setPaletteOpen(false)
                    }
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => setPaletteOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {filteredPaletteNotes.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">没有匹配结果</div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredPaletteNotes.map((n) => (
                    <button
                      key={n.id}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        openNote(n.id)
                        setPaletteOpen(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{n.title?.trim() ? n.title : '未命名'}</div>

                          <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {n.content ? n.content.replace(/\s+/g, ' ').slice(0, 140) : '（空）'}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 shrink-0">{n.format === 'markdown' ? 'MD' : 'TXT'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
