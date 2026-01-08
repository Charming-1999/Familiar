import React, { useMemo, useState, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useShortcutStore } from '../stores/useShortcutStore'
import {
  Braces,
  AlignLeft,
  Minimize2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Pencil,
  Plus,
  Minus,
} from 'lucide-react'

type PathSeg = string | number

type TreeNode = {
  keyLabel: string
  path: PathSeg[]
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  preview: string
  depth: number
  hasChildren: boolean
}

function typeOfJson(v: any): TreeNode['type'] {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'object'
}

function previewOfJson(v: any): string {
  const t = typeOfJson(v)
  if (t === 'object') return `{${Object.keys(v || {}).length}}`
  if (t === 'array') return `[${(v || []).length}]`
  if (t === 'string') return v.length > 24 ? JSON.stringify(v.slice(0, 24) + '…') : JSON.stringify(v)
  if (t === 'number') return String(v)
  if (t === 'boolean') return v ? 'true' : 'false'
  return 'null'
}

function getAtPath(root: any, path: PathSeg[]) {
  let cur = root
  for (const seg of path) {
    if (cur == null) return undefined
    cur = cur[seg as any]
  }
  return cur
}

function cloneShallow(v: any) {
  if (Array.isArray(v)) return [...v]
  if (v && typeof v === 'object') return { ...v }
  return v
}

function setAtPath(root: any, path: PathSeg[], nextVal: any) {
  if (path.length === 0) return nextVal
  const nextRoot = cloneShallow(root)
  let cur = nextRoot
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]
    const child = cur[seg as any]
    const nextChild = cloneShallow(child)
    cur[seg as any] = nextChild
    cur = nextChild
  }
  const last = path[path.length - 1]
  cur[last as any] = nextVal
  return nextRoot
}

function deleteAtPath(root: any, path: PathSeg[]) {
  if (path.length === 0) return root
  const parentPath = path.slice(0, -1)
  const key = path[path.length - 1]
  const parent = getAtPath(root, parentPath)
  if (parent == null) return root

  const nextRoot = cloneShallow(root)
  let cur = nextRoot
  for (let i = 0; i < parentPath.length; i++) {
    const seg = parentPath[i]
    const child = cur[seg as any]
    const nextChild = cloneShallow(child)
    cur[seg as any] = nextChild
    cur = nextChild
  }

  if (Array.isArray(cur)) {
    if (typeof key === 'number') cur.splice(key, 1)
  } else if (cur && typeof cur === 'object') {
    delete cur[key as any]
  }
  return nextRoot
}

function renameKey(root: any, path: PathSeg[], nextKey: string) {
  if (path.length === 0) return root
  const last = path[path.length - 1]
  if (typeof last !== 'string') return root

  const parentPath = path.slice(0, -1)
  const parent = getAtPath(root, parentPath)
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return root

  const next = cloneShallow(root)
  let cur = next
  for (let i = 0; i < parentPath.length; i++) {
    const seg = parentPath[i]
    const child = cur[seg as any]
    const nextChild = cloneShallow(child)
    cur[seg as any] = nextChild
    cur = nextChild
  }

  if (Object.prototype.hasOwnProperty.call(cur, nextKey) && nextKey !== last) {
    throw new Error('目标 key 已存在')
  }

  cur[nextKey] = cur[last]
  delete cur[last]
  return next
}

function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'JSON 解析失败' }
  }
}

function buildTree(root: any): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (v: any, path: PathSeg[], depth: number, keyLabel: string) => {
    const type = typeOfJson(v)
    const hasChildren = (type === 'object' && Object.keys(v || {}).length > 0) || (type === 'array' && (v || []).length > 0)
    out.push({
      keyLabel,
      path,
      type,
      preview: previewOfJson(v),
      depth,
      hasChildren,
    })

    if (type === 'object') {
      const keys = Object.keys(v || {})
      keys.sort((a, b) => a.localeCompare(b))
      for (const k of keys) walk(v[k], [...path, k], depth + 1, k)
    } else if (type === 'array') {
      for (let i = 0; i < (v || []).length; i++) walk(v[i], [...path, i], depth + 1, String(i))
    }
  }

  walk(root, [], 0, '(root)')
  return out
}

function pathToString(path: PathSeg[]) {
  if (path.length === 0) return '(root)'
  return path
    .map((seg) => (typeof seg === 'number' ? `[${seg}]` : `.${String(seg).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}`))

    .join('')
    .replace(/^\./, '')
}

function remapExpandedKeysForRename(
  expanded: Record<string, boolean>,
  oldPath: PathSeg[],
  nextKey: string
) {
  const oldId = pathToString(oldPath)
  const newId = pathToString([...oldPath.slice(0, -1), nextKey])
  if (oldId === newId) return expanded

  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(expanded)) {
    if (k === oldId || k.startsWith(oldId + '.') || k.startsWith(oldId + '[')) {
      out[newId + k.slice(oldId.length)] = v
    } else {
      out[k] = v
    }
  }
  return out
}

export const JsonEditor: React.FC = () => {
  const { getShortcutChecker } = useShortcutStore()
  const editorRef = useRef<any>(null)
  
  const [value, setValue] = useState(`{
  "message": "Hello Geek Toolbox",
  "status": "active",
  "features": ["JSON", "Base64", "Timestamp"]
}`)

  const [error, setError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '(root)': true })
  const [selectedPath, setSelectedPath] = useState<PathSeg[]>([])

  const [editKey, setEditKey] = useState('')
  const [editLiteral, setEditLiteral] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addLiteral, setAddLiteral] = useState('""')
  const [panelError, setPanelError] = useState<string | null>(null)
  
  const editorRef = useRef<any>(null)

  const parsed = useMemo(() => safeParseJson(value), [value])

  const tree = useMemo(() => {
    if (!parsed.ok) return [] as TreeNode[]
    return buildTree(parsed.value)
  }, [parsed])

  const selectedValue = useMemo(() => {
    if (!parsed.ok) return undefined
    return getAtPath(parsed.value, selectedPath)
  }, [parsed, selectedPath])

  const selectedType = useMemo(() => {
    if (!parsed.ok) return undefined
    return typeOfJson(selectedValue)
  }, [parsed, selectedValue])



  const selectedParentType = useMemo(() => {
    if (!parsed.ok) return undefined
    if (selectedPath.length === 0) return undefined
    const parent = getAtPath(parsed.value, selectedPath.slice(0, -1))
    return typeOfJson(parent)
  }, [parsed, selectedPath])

  const handleFormat = () => {
    const res = safeParseJson(value)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setValue(JSON.stringify(res.value, null, 2))
    setError(null)
    
    // 格式化后滚动到顶部
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.setPosition({ lineNumber: 1, column: 1 })
        editorRef.current.revealLine(1)
      }
    }, 0)
  }

  const handleMinify = () => {
    const res = safeParseJson(value)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setValue(JSON.stringify(res.value))
    setError(null)
  }

  const handleEscape = () => {
    try {
      setValue(JSON.stringify(value))
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUnescape = () => {
    const input = value.trim()
    try {
      const parsed = JSON.parse(input)
      if (typeof parsed !== 'string') throw new Error('当前内容不是 JSON 字符串，无法去除转义')
      setValue(parsed)
      setError(null)
      return
    } catch (_) {
      try {
        const parsed = JSON.parse(`"${input.replace(/"/g, '\\"')}"`)
        setValue(parsed)
        setError(null)
      } catch (err: any) {
        setError(err.message)
      }
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded((m) => ({ ...m, [id]: !m[id] }))
  }

  const syncEditPanel = (path: PathSeg[]) => {
    if (!parsed.ok) return
    const v = getAtPath(parsed.value, path)
    setEditLiteral(JSON.stringify(v, null, 2) ?? 'null')
    setEditKey(typeof path[path.length - 1] === 'string' ? String(path[path.length - 1]) : '')

    const t = typeOfJson(v)
    setAddKey('')
    setAddLiteral(t === 'array' ? 'null' : '""')

    setPanelError(null)
  }

  const applyEditValue = () => {
    if (!parsed.ok) return
    const r = safeParseJson(editLiteral)
    if (!r.ok) {
      setPanelError(r.error)
      return
    }
    const next = setAtPath(parsed.value, selectedPath, r.value)
    setValue(JSON.stringify(next, null, 2))
    setError(null)
    setPanelError(null)
  }

  const applyRenameKey = () => {
    if (!parsed.ok) return
    const nextKey = editKey.trim()
    if (!nextKey) {
      setPanelError('key 不能为空')
      return
    }

    const oldPath = selectedPath
    try {
      const next = renameKey(parsed.value, selectedPath, nextKey)
      setValue(JSON.stringify(next, null, 2))

      setExpanded((m) => remapExpandedKeysForRename(m, oldPath, nextKey))
      setSelectedPath((prev) => {
        if (prev.length === 0) return prev
        const p = [...prev]
        p[p.length - 1] = nextKey
        return p
      })
      setError(null)
      setPanelError(null)
    } catch (e: any) {
      setPanelError(e?.message || '重命名失败')
    }
  }

  const applyAddChild = () => {
    if (!parsed.ok) return
    setPanelError(null)

    const target = getAtPath(parsed.value, selectedPath)
    const t = typeOfJson(target)
    if (t !== 'object' && t !== 'array') {
      setPanelError('请选择一个对象或数组节点再添加子节点')
      return
    }

    const valRes = safeParseJson(addLiteral)
    if (!valRes.ok) {
      setPanelError(valRes.error)
      return
    }

    if (t === 'object') {
      const k = addKey.trim()
      if (!k) {
        setPanelError('对象节点添加子项需要 key')
        return
      }
      if (Object.prototype.hasOwnProperty.call(target, k)) {
        setPanelError('key 已存在')
        return
      }
      const nextTarget = { ...(target || {}), [k]: valRes.value }
      const next = setAtPath(parsed.value, selectedPath, nextTarget)
      setValue(JSON.stringify(next, null, 2))
      setExpanded((m) => ({ ...m, [pathToString(selectedPath)]: true }))
      setAddKey('')
      setAddLiteral('""')
      setError(null)
      return
    }

    const nextTarget = [...(target || [])]
    nextTarget.push(valRes.value)
    const next = setAtPath(parsed.value, selectedPath, nextTarget)
    setValue(JSON.stringify(next, null, 2))
    setExpanded((m) => ({ ...m, [pathToString(selectedPath)]: true }))
    setAddLiteral('null')
    setError(null)
  }

  const applyDelete = () => {
    if (!parsed.ok) return
    if (selectedPath.length === 0) {
      setPanelError('根节点不支持删除')
      return
    }
    const next = deleteAtPath(parsed.value, selectedPath)
    setValue(JSON.stringify(next, null, 2))
    setSelectedPath([])
    setError(null)
    setPanelError(null)
  }

  const visibleTree = useMemo(() => {
    if (!parsed.ok) return [] as TreeNode[]
    const isVisible = (node: TreeNode) => {
      if (node.path.length === 0) return true

      // root collapsed -> hide all children
      if (!expanded['(root)']) return false

      // visible only if all ancestors expanded
      for (let i = 1; i < node.path.length; i++) {
        const ancestorPath = node.path.slice(0, i)
        const id = pathToString(ancestorPath)
        if (!expanded[id]) return false
      }
      return true
    }
    return tree.filter(isVisible)
  }, [tree, expanded, parsed])

  // 快捷键支持
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const checkSave = getShortcutChecker('save')
      const checkUndo = getShortcutChecker('undo')
      const checkRedo = getShortcutChecker('redo')

      if (checkSave && checkSave(e)) {
        e.preventDefault()
        // JSON 编辑器主要是手动操作，保存功能可以理解为复制到剪贴板
        navigator.clipboard.writeText(value).then(() => {
          console.log('JSON 已复制到剪贴板')
        })
        return
      }

      if (checkUndo && checkUndo(e)) {
        e.preventDefault()
        // 触发 Monaco Editor 的撤销
        if (editorRef.current) {
          editorRef.current.trigger('keyboard', 'undo', null)
        }
        return
      }

      if (checkRedo && checkRedo(e)) {
        e.preventDefault()
        // 触发 Monaco Editor 的重做
        if (editorRef.current) {
          editorRef.current.trigger('keyboard', 'redo', null)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getShortcutChecker, value])

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Braces className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">JSON 编辑器</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleFormat} className="space-x-1">
            <AlignLeft className="w-4 h-4" />
            <span>格式化</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleMinify} className="space-x-1">
            <Minimize2 className="w-4 h-4" />
            <span>压缩</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleEscape} className="space-x-1">
            <ChevronRight className="w-4 h-4" />
            <span>转义</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleUnescape} className="space-x-1">
            <ChevronDown className="w-4 h-4" />
            <span>去转义</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setValue('')
              setError(null)
              setPanelError(null)
              setSelectedPath([])
            }}
            className="text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20"
            title="清空"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-4">
        <div className="border border-border rounded-lg overflow-hidden relative min-h-0">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={value}
            onChange={(v) => setValue(v || '')}
            onMount={(editor) => { editorRef.current = editor }}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
            }}
          />
          {error && (
            <div className="absolute bottom-4 right-4 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg text-xs backdrop-blur-md">
              解析错误: {error}
            </div>
          )}
        </div>

        <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">结构预览（可编辑）</div>
            <div className="text-[10px] text-muted-foreground">点击节点 → 右侧面板操作</div>
          </div>

          {!parsed.ok ? (
            <div className="p-4 text-sm text-red-400">{parsed.error}</div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-rows-[1fr,auto]">
              <div className="overflow-auto p-3 space-y-1">
                {visibleTree.map((n) => {
                  const id = pathToString(n.path)
                  const isSelected = pathToString(selectedPath) === id
                  const canExpand = n.type === 'object' || n.type === 'array'
                  const isExpanded = expanded[id]

                  return (
                    <button
                      key={id}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs border',
                        isSelected
                          ? 'bg-primary/10 border-primary/30 text-foreground'
                          : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/20'
                      )}
                      onClick={() => {
                        setSelectedPath(n.path)
                        syncEditPanel(n.path)
                      }}
                    >
                      <span className="shrink-0" style={{ width: 12 * n.depth }} />

                      {canExpand ? (
                        <span
                          className={cn('shrink-0 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-muted/30',
                            n.hasChildren ? 'opacity-100' : 'opacity-30'
                          )}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (n.hasChildren) toggleExpand(id)
                          }}
                          title={n.hasChildren ? (isExpanded ? '收起' : '展开') : '无子节点'}
                        >
                          {n.hasChildren ? (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
                        </span>
                      ) : (
                        <span className="shrink-0 w-4" />
                      )}

                      <span className={cn('font-mono truncate', n.keyLabel === '(root)' ? 'text-foreground' : '')}>
                        {n.keyLabel}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/80">{n.preview}</span>
                    </button>
                  )
                })}
              </div>

              <div className="border-t border-border p-3 space-y-3">
                <div className="text-xs text-muted-foreground">
                  当前选择：<span className="font-mono text-foreground">{pathToString(selectedPath)}</span>
                </div>

                {panelError && <div className="text-xs text-red-400">{panelError}</div>}

                <div className="grid grid-cols-1 gap-2">
                  {/* rename key */}
                  {selectedParentType === 'object' && selectedPath.length > 0 && typeof selectedPath[selectedPath.length - 1] === 'string' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground w-14">key</div>
                        <Input
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              applyRenameKey()
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              syncEditPanel(selectedPath)
                            }
                          }}
                          className="h-8 bg-muted/10"
                        />
                        <Button variant="outline" size="sm" className="h-8 px-2" onClick={applyRenameKey} title="重命名 key">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* edit value */}
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>值（JSON 字面量）</span>
                      <span className="font-mono">{selectedType}</span>
                    </div>
                    <textarea
                      className="w-full h-24 bg-muted/10 border border-border rounded-lg p-2 font-mono text-xs resize-none focus:outline-none focus:border-primary/50"
                      value={editLiteral}
                      onChange={(e) => setEditLiteral(e.target.value)}
                      placeholder='例如："abc" / 123 / true / null / {"a":1} / [1,2]'
                    />
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="space-x-1" onClick={applyEditValue}>
                        <Pencil className="w-4 h-4" />
                        <span>更新值</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn('space-x-1', selectedPath.length === 0 ? 'opacity-50' : 'text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20')}
                        disabled={selectedPath.length === 0}
                        onClick={applyDelete}
                      >
                        <Minus className="w-4 h-4" />
                        <span>删除节点</span>
                      </Button>
                    </div>
                  </div>

                  {/* add child */}
                  <div className="space-y-2 pt-1">
                    <div className="text-xs text-muted-foreground">添加子节点</div>

                    {selectedType === 'object' || selectedType === 'array' ? (
                      <div className="flex items-center gap-2">
                        {selectedType === 'object' ? (
                          <Input
                            value={addKey}
                            onChange={(e) => setAddKey(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                applyAddChild()
                              }
                            }}
                            placeholder="key（对象必填）"
                            className="h-8 bg-muted/10"
                          />
                        ) : (
                          <div className="text-[10px] text-muted-foreground px-2">数组：追加到末尾</div>
                        )}

                        <Input
                          value={addLiteral}
                          onChange={(e) => setAddLiteral(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              applyAddChild()
                            }
                          }}
                          placeholder='值（JSON 字面量）：例如 "x" / 1 / {} / []'
                          className="h-8 bg-muted/10 font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={applyAddChild}
                          title="添加子节点"
                          disabled={selectedType === 'object' ? !addKey.trim() : false}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        选择一个 <span className="font-mono text-foreground">object</span> 或 <span className="font-mono text-foreground">array</span> 节点后再添加。
                      </div>
                    )}

                    <div className="text-[10px] text-muted-foreground">
                      提示：按 <span className="font-mono">Enter</span> 可直接添加。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-4 rounded-lg">
        <h4 className="text-sm font-bold mb-2 flex items-center text-primary">快捷提示</h4>
        <ul className="text-[10px] text-muted-foreground space-y-1">
          <li>• 支持 Monaco 语法高亮与错误提示</li>
          <li>• 使用“格式化/压缩”快速整理 JSON</li>
          <li>• 结构预览支持点击节点并编辑/增删</li>
          <li>• “转义/去转义”适合将 JSON 作为字符串嵌入/还原</li>
        </ul>
      </div>
    </div>
  )
}
