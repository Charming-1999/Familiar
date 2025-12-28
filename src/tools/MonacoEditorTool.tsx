import React, { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { FileCode2, Plus, Trash2, Save } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'
import { useThemeStore } from '../stores/useThemeStore'

type Lang = 'typescript' | 'javascript' | 'json' | 'html' | 'css' | 'markdown' | 'sql' | 'yaml' | 'plaintext'

type FileItem = {
  id: string
  name: string
  language: Lang
  content: string
  createdAt: string
  updatedAt: string
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function makeId() {
  const id = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return `file:${id}`
}

function filesKey(userId: string) {
  return `monaco:files:${userId}`
}

function activeKey(userId: string) {
  return `monaco:active:${userId}`
}

function clampNameInput(s: string) {
  return s.slice(0, 80)
}

function normalizeNameForSave(s: string) {
  const t = s.trim().slice(0, 80)
  return t.length ? t : 'untitled.ts'
}

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'plaintext', label: 'Text' },
]

export const MonacoEditorTool: React.FC = () => {
  const { user } = useAuthStore()
  const { theme } = useThemeStore()

  const [files, setFiles] = useState<FileItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const saveTimerRef = useRef<number | null>(null)
  const latestContentRef = useRef<string>('')

  const themeForEditor = theme === 'light' ? 'vs' : 'vs-dark'

  const orderedFiles = useMemo(() => {
    return [...files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [files])

  const activeFile = useMemo(() => {
    if (!activeId) return null
    return files.find((f) => f.id === activeId) || null
  }, [activeId, files])

  const persistFiles = (userId: string, list: FileItem[]) => {
    try {
      window.localStorage.setItem(filesKey(userId), JSON.stringify(list))
    } catch {
      // ignore
    }
  }

  const persistActive = (userId: string, id: string | null) => {
    try {
      if (id) window.localStorage.setItem(activeKey(userId), id)
      else window.localStorage.removeItem(activeKey(userId))
    } catch {
      // ignore
    }
  }

  const load = () => {
    if (!user) return
    const userId = user.id

    const localFiles = safeParseJson<FileItem[]>(window.localStorage.getItem(filesKey(userId))) || []
    const localActive = window.localStorage.getItem(activeKey(userId))

    setFiles(localFiles)
    setActiveId((prev) => {
      if (prev && localFiles.some((f) => f.id === prev)) return prev
      if (localActive && localFiles.some((f) => f.id === localActive)) return localActive
      if (localFiles.length > 0) return [...localFiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].id
      return null
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    persistActive(user.id, activeId)
  }, [activeId, user])

  useEffect(() => {
    if (!activeFile) {
      setNameInput('')
      latestContentRef.current = ''
      return
    }
    setNameInput(activeFile.name)
    latestContentRef.current = activeFile.content
  }, [activeFile?.id])

  const createFile = () => {
    if (!user) return
    const now = new Date().toISOString()
    const file: FileItem = {
      id: makeId(),
      name: 'untitled.ts',
      language: 'typescript',
      content: '',
      createdAt: now,
      updatedAt: now,
    }

    setFiles((prev) => {
      const next = [file, ...prev]
      persistFiles(user.id, next)
      return next
    })
    setActiveId(file.id)
  }

  const deleteFile = (id: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这个文件吗？删除后不可恢复。')
    if (!ok) return

    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id)
      persistFiles(user.id, next)
      return next
    })

    setActiveId((prev) => {
      if (prev !== id) return prev
      const next = orderedFiles.find((f) => f.id !== id)?.id || null
      return next
    })
  }

  const scheduleSave = (patch: Partial<Pick<FileItem, 'content' | 'language' | 'name'>>) => {
    if (!user || !activeId) return

    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    setSaving(true)

    const now = new Date().toISOString()
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      setSaving(false)
      setSavedAt(now)

      setFiles((prev) => {
        const next = prev.map((f) => (f.id === activeId ? { ...f, ...patch, updatedAt: now } : f))
        persistFiles(user.id, next)
        return next
      })
    }, 500)
  }

  const manualSaveNow = () => {
    if (!user || !activeId) return
    const now = new Date().toISOString()
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    setSaving(false)
    setSavedAt(now)

    setFiles((prev) => {
      const next = prev.map((f) => {
        if (f.id !== activeId) return f
        return {
          ...f,
          name: normalizeNameForSave(nameInput),
          content: latestContentRef.current,
          updatedAt: now,
        }
      })
      persistFiles(user.id, next)
      return next
    })
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="glass-card p-6 rounded-xl text-center space-y-2">
          <div className="text-sm text-muted-foreground">请先登录后使用编辑器</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">代码编辑器（Monaco）</h2>
        </div>
        <div className="flex items-center gap-2">
          {saving ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Save className="w-3.5 h-3.5" />
              保存中…
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {savedAt ? `已保存 ${new Date(savedAt).toLocaleTimeString()}` : '本地自动保存'}
            </div>
          )}
          <Button onClick={createFile} className="h-9">
            <Plus className="w-4 h-4 mr-1" />
            新建
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-3">
        <div className="glass-card rounded-xl p-3 flex flex-col min-h-0">
          <div className="text-xs text-muted-foreground mb-2">我的文件（{orderedFiles.length}）</div>
          {orderedFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">暂无文件，点击右上角新建</div>
          ) : (
            <div className="space-y-1 overflow-auto pr-1">
              {orderedFiles.map((f) => {
                const active = f.id === activeId
                return (
                  <button
                    key={f.id}
                    className={cn(
                      'w-full text-left px-2 py-2 rounded-lg border transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    )}
                    onClick={() => setActiveId(f.id)}
                  >
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{new Date(f.updatedAt).toLocaleString()}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-3 flex flex-col min-h-0">
          {!activeFile ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">请选择或新建一个文件</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={nameInput}
                  onChange={(e) => {
                    const v = clampNameInput(e.target.value)
                    setNameInput(v)
                    scheduleSave({ name: v })
                  }}
                  onBlur={() => scheduleSave({ name: normalizeNameForSave(nameInput) })}
                  className="h-9 bg-muted/10"
                />

                <select
                  value={activeFile.language}
                  onChange={(e) => scheduleSave({ language: e.target.value as Lang })}
                  className="h-9 rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <Button variant="outline" size="sm" className="h-9" onClick={manualSaveNow} title="Ctrl+S">
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                  onClick={() => deleteFile(activeFile.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-background">
                <Editor
                  key={activeFile.id}
                  theme={themeForEditor}
                  language={activeFile.language}
                  value={activeFile.content}
                  onMount={(editor, monaco) => {
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      manualSaveNow()
                    })
                  }}
                  onChange={(v) => {
                    const next = v ?? ''
                    latestContentRef.current = next
                    scheduleSave({ content: next })
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
