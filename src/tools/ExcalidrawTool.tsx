import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloudUpload, Loader2, Maximize2, Minimize2, PanelsLeftRight, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'

type SceneData = {
  elements: readonly unknown[]
  appState: Record<string, unknown>
}

type ExcalidrawDoc = {
  id: string
  user_id: string
  title: string
  data: unknown
  created_at: string
  updated_at: string
}

type LocalDoc = {
  id: string // local:xxx
  title: string
  scene: SceneData
  createdAt: string
  updatedAt: string
}

type Draft = {
  title: string
  scene: SceneData
  updatedAt: string
}

type ExcalidrawComponent = React.ComponentType<{
  key?: React.Key
  initialData: {
    elements: readonly unknown[]
    appState: unknown
    files: Record<string, never>
  }
  onChange: (elements: readonly unknown[], appState: unknown) => void
}>

function clampTitleInput(s: string) {
  return s.slice(0, 80)
}

function normalizeTitleForSave(s: string) {
  const t = s.trim().slice(0, 80)
  return t.length ? t : '未命名白板'
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function uidKey(userId: string, suffix: string) {
  return `excalidraw:${suffix}:${userId}`
}

function localDocsKey(userId: string) {
  return uidKey(userId, 'local_docs')
}

function draftKey(userId: string, cloudId: string) {
  return `excalidraw:draft:${userId}:${cloudId}`
}

function draftMetaKey(userId: string) {
  return uidKey(userId, 'drafts_meta')
}

function lastActiveKey(userId: string) {
  return uidKey(userId, 'last_active')
}

function makeLocalId() {
  const id = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return `local:${id}`
}

function sceneFromAny(data: unknown): SceneData {
  const source = typeof data === 'object' && data ? (data as { elements?: unknown; appState?: unknown }) : {}
  return {
    elements: Array.isArray(source.elements) ? source.elements : [],
    appState: typeof source.appState === 'object' && source.appState ? (source.appState as Record<string, unknown>) : {},
  }
}

function stripNonSerializableAppState(appState: unknown) {
  const safe: Record<string, unknown> =
    typeof appState === 'object' && appState ? { ...(appState as Record<string, unknown>) } : {}
  delete safe['collaborators']
  return safe
}

export const ExcalidrawTool: React.FC = () => {
  const { user } = useAuthStore()

  const [ExcalidrawComponent, setExcalidrawComponent] = useState<ExcalidrawComponent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cloudDocs, setCloudDocs] = useState<ExcalidrawDoc[]>([])
  const [localDocs, setLocalDocs] = useState<LocalDoc[]>([])
  const [draftMeta, setDraftMeta] = useState<Record<string, string>>({})

  const [activeId, setActiveId] = useState<string | null>(null)
  const [titleInput, setTitleInput] = useState('')
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null)

  const [localSaving, setLocalSaving] = useState(false)
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null)
  const localSaveTimerRef = useRef<number | null>(null)

  const [cloudSaving, setCloudSaving] = useState(false)

  const [isImmersive, setIsImmersive] = useState(false)

  const latestSceneRef = useRef<SceneData | null>(null)


  const orderedLocalDocs = useMemo(() => {
    return [...localDocs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [localDocs])

  const orderedCloudDocs = useMemo(() => {
    return [...cloudDocs].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cloudDocs])

  const activeLocalDoc = useMemo(() => {
    if (!activeId?.startsWith('local:')) return null
    return localDocs.find((d) => d.id === activeId) || null
  }, [activeId, localDocs])

  const activeCloudDoc = useMemo(() => {
    if (!activeId || activeId.startsWith('local:')) return null
    return cloudDocs.find((d) => d.id === activeId) || null
  }, [activeId, cloudDocs])

  const activeScene: SceneData | null = useMemo(() => {
    if (activeLocalDoc) return activeLocalDoc.scene
    if (activeDraft) return activeDraft.scene
    if (activeCloudDoc) return sceneFromAny(activeCloudDoc.data)
    return null
  }, [activeCloudDoc, activeDraft, activeLocalDoc])

  const activeHasUnsavedCloudChanges = useMemo(() => {
    if (activeLocalDoc) return true
    if (activeCloudDoc) return !!activeDraft && !!draftMeta[activeCloudDoc.id]
    return false
  }, [activeCloudDoc, activeDraft, activeLocalDoc, draftMeta])

  const persistLocalDocs = (userId: string, list: LocalDoc[]) => {
    try {
      window.localStorage.setItem(localDocsKey(userId), JSON.stringify(list))
    } catch {
      // ignore
    }
  }

  const persistDraftMeta = (userId: string, next: Record<string, string>) => {
    setDraftMeta(next)
    try {
      window.localStorage.setItem(draftMetaKey(userId), JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const readDraft = (userId: string, cloudId: string): Draft | null => {
    return safeParseJson<Draft>(window.localStorage.getItem(draftKey(userId, cloudId)))
  }

  const writeDraft = (userId: string, cloudId: string, draft: Draft) => {
    try {
      window.localStorage.setItem(draftKey(userId, cloudId), JSON.stringify(draft))
    } catch {
      // ignore
    }
    persistDraftMeta(userId, { ...draftMeta, [cloudId]: draft.updatedAt })
  }

  const clearDraft = (userId: string, cloudId: string) => {
    try {
      window.localStorage.removeItem(draftKey(userId, cloudId))
    } catch {
      // ignore
    }
    const next = { ...draftMeta }
    delete next[cloudId]
    persistDraftMeta(userId, next)
  }

  const loadAll = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    const userId = user.id

    const local = safeParseJson<LocalDoc[]>(window.localStorage.getItem(localDocsKey(userId))) || []
    const meta = safeParseJson<Record<string, string>>(window.localStorage.getItem(draftMetaKey(userId))) || {}
    const lastActive = window.localStorage.getItem(lastActiveKey(userId))

    setLocalDocs(local)
    setDraftMeta(meta)

    try {
      const { data, error } = await supabase
        .from('excalidraw_documents')
        .select('id,user_id,title,data,created_at,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      const list = (data || []) as ExcalidrawDoc[]
      setCloudDocs(list)

      setActiveId((prev) => {
        if (prev && (prev.startsWith('local:') ? local.some((d) => d.id === prev) : list.some((d) => d.id === prev))) return prev
        if (lastActive && (lastActive.startsWith('local:') ? local.some((d) => d.id === lastActive) : list.some((d) => d.id === lastActive))) {
          return lastActive
        }
        if (local.length > 0) return [...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].id
        if (list.length > 0) return list[0].id
        return null
      })
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      import('@excalidraw/excalidraw'),
      import('@excalidraw/excalidraw/index.css'),
    ])
      .then(([mod]) => {
        if (active) setExcalidrawComponent(() => mod.Excalidraw as ExcalidrawComponent)
      })
      .catch((loadError) => {
        console.error('[ExcalidrawTool] load excalidraw failed:', loadError)
        if (active) {
          setError('白板编辑器加载失败')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    if (!activeId) return
    try {
      window.localStorage.setItem(lastActiveKey(user.id), activeId)
    } catch {
      // ignore
    }
  }, [activeId, user])

  useEffect(() => {
    if (!user) return

    if (activeId?.startsWith('local:')) {
      const doc = localDocs.find((d) => d.id === activeId)
      setActiveDraft(null)
      setTitleInput(doc?.title || '')
      latestSceneRef.current = doc ? doc.scene : null
      return
    }

    if (activeId) {
      const cloud = cloudDocs.find((d) => d.id === activeId)
      const draft = readDraft(user.id, activeId)
      setActiveDraft(draft)
      setTitleInput(draft?.title ?? cloud?.title ?? '')
      latestSceneRef.current = draft?.scene ?? (cloud ? sceneFromAny(cloud.data) : null)
      return
    }

    setActiveDraft(null)
    setTitleInput('')
    latestSceneRef.current = null
  }, [activeId, cloudDocs, localDocs, user])

  useEffect(() => {
    if (!isImmersive) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isImmersive])


  useEffect(() => {
    return () => {
      if (localSaveTimerRef.current != null) window.clearTimeout(localSaveTimerRef.current)
    }
  }, [])

  const handleCreate = () => {
    if (!user) return
    setError(null)

    const now = new Date().toISOString()
    const doc: LocalDoc = {
      id: makeLocalId(),
      title: '未命名白板',
      scene: { elements: [], appState: {} },
      createdAt: now,
      updatedAt: now,
    }

    setLocalDocs((prev) => {
      const next = [doc, ...prev]
      persistLocalDocs(user.id, next)
      return next
    })

    setActiveId(doc.id)
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这个白板吗？删除后不可恢复。')
    if (!ok) return

    setError(null)

    if (id.startsWith('local:')) {
      setLocalDocs((prev) => {
        const next = prev.filter((d) => d.id !== id)
        persistLocalDocs(user.id, next)
        return next
      })
      setActiveId((prev) => {
        if (prev !== id) return prev
        const next = orderedLocalDocs.find((d) => d.id !== id)?.id || orderedCloudDocs[0]?.id || null
        return next
      })
      return
    }

    try {
      const { error } = await supabase.from('excalidraw_documents').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      clearDraft(user.id, id)

      setCloudDocs((prev) => prev.filter((d) => d.id !== id))
      setActiveId((prev) => {
        if (prev !== id) return prev
        const next = orderedLocalDocs[0]?.id || orderedCloudDocs.find((d) => d.id !== id)?.id || null
        return next
      })
    } catch (e: any) {
      setError(e.message || '删除失败')
    }
  }

  const scheduleLocalPersist = (nextScene: SceneData) => {
    if (!user || !activeId) return

    if (localSaveTimerRef.current != null) window.clearTimeout(localSaveTimerRef.current)
    setLocalSaving(true)

    const now = new Date().toISOString()
    localSaveTimerRef.current = window.setTimeout(() => {
      localSaveTimerRef.current = null
      setLocalSaving(false)
      setLocalSavedAt(now)

      if (!user) return

      if (activeId.startsWith('local:')) {
        setLocalDocs((prev) => {
          const next = prev.map((d) => (d.id === activeId ? { ...d, title: titleInput || d.title, scene: nextScene, updatedAt: now } : d))
          persistLocalDocs(user.id, next)
          return next
        })
      } else {
        const draft: Draft = {
          title: titleInput,
          scene: nextScene,
          updatedAt: now,
        }
        setActiveDraft(draft)
        writeDraft(user.id, activeId, draft)
      }
    }, 350)
  }

  const updateTitleLocalOnly = (nextTitle: string) => {
    if (!user || !activeId) return

    const v = clampTitleInput(nextTitle)
    setTitleInput(v)

    const now = new Date().toISOString()

    if (activeId.startsWith('local:')) {
      setLocalDocs((prev) => {
        const next = prev.map((d) => (d.id === activeId ? { ...d, title: v, updatedAt: now } : d))
        persistLocalDocs(user.id, next)
        return next
      })
      return
    }

    const baseScene = latestSceneRef.current || (activeCloudDoc ? sceneFromAny(activeCloudDoc.data) : { elements: [], appState: {} })
    const draft: Draft = {
      title: v,
      scene: baseScene,
      updatedAt: now,
    }
    setActiveDraft(draft)
    writeDraft(user.id, activeId, draft)
  }

  const saveToCloud = async () => {
    if (!user || !activeId) return

    setError(null)
    setCloudSaving(true)

    try {
      const now = new Date().toISOString()

      const scene = latestSceneRef.current || activeScene || { elements: [], appState: {} }
      const payloadScene = { elements: scene.elements, appState: scene.appState }
      const title = normalizeTitleForSave(titleInput)

      if (activeId.startsWith('local:')) {
        const { data, error } = await supabase
          .from('excalidraw_documents')
          .insert({ user_id: user.id, title, data: payloadScene, updated_at: now })
          .select('id,user_id,title,data,created_at,updated_at')
          .single()

        if (error) throw error
        const doc = data as ExcalidrawDoc

        setCloudDocs((prev) => [doc, ...prev])
        setLocalDocs((prev) => {
          const next = prev.filter((d) => d.id !== activeId)
          persistLocalDocs(user.id, next)
          return next
        })
        setActiveDraft(null)
        setTitleInput(doc.title)
        setActiveId(doc.id)
        return
      }

      const { error } = await supabase
        .from('excalidraw_documents')
        .update({ title, data: payloadScene, updated_at: now })
        .eq('id', activeId)
        .eq('user_id', user.id)

      if (error) throw error

      setCloudDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, title, data: payloadScene, updated_at: now } : d)))
      clearDraft(user.id, activeId)
      setActiveDraft(null)
    } catch (e: any) {
      setError(e.message || '保存到云端失败')
    } finally {
      setCloudSaving(false)
    }
  }

  const toggleImmersive = () => {
    setIsImmersive((prev) => !prev)
  }

  const switchCanvas = (id: string) => {
    if (!user) return
    latestSceneRef.current = null
    if (id.startsWith('local:')) {
      const doc = localDocs.find((d) => d.id === id)
      setActiveDraft(null)
      setTitleInput(doc?.title || '')
    } else {
      const cloud = cloudDocs.find((d) => d.id === id)
      const draft = readDraft(user.id, id)
      setActiveDraft(draft)
      setTitleInput(draft?.title ?? cloud?.title ?? '')
    }
    setActiveId(id)
  }

  const renderCanvas = (immersive: boolean) => {
    if (!activeId || !activeScene) return null
    const scene = latestSceneRef.current || activeScene

    return (
      <div className={cn('flex h-full flex-col min-h-0')}>
        <div className={cn('flex items-center gap-2', immersive ? 'px-3 py-2 border-b border-border shrink-0' : 'mb-2')}>
          <Input
            value={titleInput}
            onChange={(e) => updateTitleLocalOnly(e.target.value)}
            className="h-9 bg-muted/10"
          />

          <Button
            onClick={saveToCloud}
            className="h-9"
            disabled={cloudSaving || !activeHasUnsavedCloudChanges}
            title="保存到云端"
          >
            {cloudSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4 mr-2" />
                保存到云端
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/30"
            onClick={toggleImmersive}
            title={immersive ? '退出沉浸模式' : '进入沉浸模式'}
          >
            {immersive ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
            onClick={() => handleDelete(activeId)}
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className={cn('flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-background', immersive && 'rounded-none border-0')}>
          {ExcalidrawComponent ? (
            <ExcalidrawComponent
              key={`${activeId}:${immersive ? 'immersive' : 'inline'}`}
              initialData={{
                elements: scene.elements,
                appState: scene.appState,
                files: {},
              }}
              onChange={(elements, appState) => {
                const nextScene: SceneData = {
                  elements,
                  appState: stripNonSerializableAppState(appState),
                }
                latestSceneRef.current = nextScene
                scheduleLocalPersist(nextScene)
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载白板编辑器...
            </div>
          )}
        </div>
      </div>
    )
  }


  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="glass-card p-6 rounded-xl text-center space-y-2">
          <div className="text-sm text-muted-foreground">请先登录后使用云端白板</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <PanelsLeftRight className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">Excalidraw 白板</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {localSaving ? '本地保存中…' : localSavedAt ? `本地已保存 ${new Date(localSavedAt).toLocaleTimeString()}` : '本地自动保存'}
          </div>

          <Button onClick={handleCreate} className="h-9">
            <Plus className="w-4 h-4 mr-1" />
            新建
          </Button>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-3">
        <div className="glass-card rounded-xl p-3 flex flex-col min-h-0">
          <div className="text-xs text-muted-foreground mb-2">本地草稿（{orderedLocalDocs.length}）</div>

          {orderedLocalDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">暂无本地草稿</div>
          ) : (
            <div className="space-y-1 overflow-auto pr-1 mb-3">
              {orderedLocalDocs.map((d) => {
                const active = d.id === activeId
                return (
                  <button
                    key={d.id}
                    className={cn(
                      'w-full text-left px-2 py-2 rounded-lg border transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    )}
                    onClick={() => switchCanvas(d.id)}
                  >
                    <div className="text-sm font-medium truncate">{d.title?.trim() ? d.title : '未命名白板'}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{new Date(d.updatedAt).toLocaleString()}</div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="text-xs text-muted-foreground mb-2">云端白板（{orderedCloudDocs.length}）</div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">加载中…</div>
          ) : orderedCloudDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">暂无云端白板</div>
          ) : (
            <div className="space-y-1 overflow-auto pr-1">
              {orderedCloudDocs.map((d) => {
                const active = d.id === activeId
                const hasDraft = !!draftMeta[d.id]
                return (
                  <button
                    key={d.id}
                    className={cn(
                      'w-full text-left px-2 py-2 rounded-lg border transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    )}
                    onClick={() => switchCanvas(d.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{d.title?.trim() ? d.title : '未命名白板'}</div>
                      {hasDraft && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 shrink-0">
                          本地修改
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">{new Date(d.updated_at).toLocaleString()}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-3 flex flex-col min-h-0">
          {!activeId || !activeScene ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">请选择或新建一个白板</div>
          ) : (
            <>
              {renderCanvas(false)}
            </>
          )}
        </div>
      </div>
      {isImmersive
        ? createPortal(
            <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
              <div className="min-h-0 flex-1">{renderCanvas(true)}</div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
