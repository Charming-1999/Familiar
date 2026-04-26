import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlignLeft, Braces, ChevronDown, ChevronRight, Copy, Loader2, Minimize2, Minus, Pencil, Plus, ShieldCheck, Trash2, Wand2 } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import {
  buildTree,
  deleteAtPath,
  getAtPath,
  pathToString,
  remapExpandedKeysForRename,
  renameKey,
  safeParseJson,
  setAtPath,
  type PathSeg,
  type TreeNode,
  typeOfJson,
} from '../lib/jsonTools'
import { cn } from '../lib/utils'
import { useShortcutStore } from '../stores/useShortcutStore'

const DEFAULT_JSON = `{
  "message": "Hello Familiar",
  "status": "active",
  "features": ["JSON", "Tree", "Fast Parse"]
}`

export const JsonEditor: React.FC = () => {
  const { getShortcutChecker } = useShortcutStore()
  const editorRef = useRef<any>(null)
  const [MonacoEditor, setMonacoEditor] = useState<React.ComponentType<any> | null>(null)
  const [rawValue, setRawValue] = useState(DEFAULT_JSON)
  const [copied, setCopied] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '(root)': true })
  const [selectedPath, setSelectedPath] = useState<PathSeg[]>([])
  const [editKey, setEditKey] = useState('')
  const [editLiteral, setEditLiteral] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addLiteral, setAddLiteral] = useState('""')
  const [panelError, setPanelError] = useState<string | null>(null)
  const initialParsed = safeParseJson(DEFAULT_JSON)
  const [analysis, setAnalysis] = useState({
    snapshotText: DEFAULT_JSON,
    parsed: initialParsed.ok ? initialParsed.value : null,
    error: initialParsed.ok ? null : initialParsed.error,
    updatedAt: Date.now(),
  })

  useEffect(() => {
    let active = true
    import('@monaco-editor/react')
      .then((mod) => {
        if (active) setMonacoEditor(() => mod.default)
      })
      .catch((error) => console.error('[JsonEditor] load monaco failed:', error))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (rawValue === analysis.snapshotText) return
    setIsAnalyzing(true)
    const timer = window.setTimeout(() => {
      const result = safeParseJson(rawValue)
      setAnalysis((prev) =>
        result.ok
          ? { snapshotText: rawValue, parsed: result.value, error: null, updatedAt: Date.now() }
          : { ...prev, snapshotText: rawValue, error: result.error, updatedAt: Date.now() }
      )
      setIsAnalyzing(false)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [analysis.snapshotText, rawValue])

  const syncEditPanel = (path: PathSeg[], root: any) => {
    const value = path.length === 0 ? root : getAtPath(root, path)
    setEditLiteral(JSON.stringify(value, null, 2) ?? 'null')
    setEditKey(typeof path[path.length - 1] === 'string' ? String(path[path.length - 1]) : '')
    setAddKey('')
    setAddLiteral(typeOfJson(value) === 'array' ? 'null' : '""')
    setPanelError(null)
  }

  useEffect(() => {
    if (analysis.parsed == null) return
    const selectedValue = selectedPath.length === 0 ? analysis.parsed : getAtPath(analysis.parsed, selectedPath)
    if (selectedPath.length > 0 && selectedValue === undefined) {
      setSelectedPath([])
      syncEditPanel([], analysis.parsed)
      return
    }
    syncEditPanel(selectedPath, analysis.parsed)
  }, [analysis.parsed, selectedPath])

  const tree = useMemo(() => (analysis.parsed == null ? [] : buildTree(analysis.parsed)), [analysis.parsed])
  const selectedValue = useMemo(() => (analysis.parsed == null ? undefined : getAtPath(analysis.parsed, selectedPath)), [analysis.parsed, selectedPath])
  const selectedType = selectedValue === undefined ? undefined : typeOfJson(selectedValue)
  const selectedParentType = useMemo(() => {
    if (analysis.parsed == null || selectedPath.length === 0) return undefined
    return typeOfJson(getAtPath(analysis.parsed, selectedPath.slice(0, -1)))
  }, [analysis.parsed, selectedPath])
  const currentTextIsValid = !analysis.error && rawValue === analysis.snapshotText
  const visibleTree = useMemo(() => tree.filter((node) => node.path.length === 0 || expanded['(root)'] && node.path.slice(0, -1).every((_, index) => expanded[pathToString(node.path.slice(0, index + 1))])), [expanded, tree])

  const applyRawText = (nextText: string) => {
    setRawValue(nextText)
    const result = safeParseJson(nextText)
    setAnalysis((prev) =>
      result.ok
        ? { snapshotText: nextText, parsed: result.value, error: null, updatedAt: Date.now() }
        : { ...prev, snapshotText: nextText, error: result.error, updatedAt: Date.now() }
    )
    setIsAnalyzing(false)
  }

  const applyStructuredUpdate = (nextValue: any) => {
    applyRawText(JSON.stringify(nextValue, null, 2))
    setPanelError(null)
  }

  const handleFormat = () => {
    const result = safeParseJson(rawValue)
    if (!result.ok) return setPanelError(result.error)
    applyStructuredUpdate(result.value)
    window.setTimeout(() => editorRef.current?.setPosition?.({ lineNumber: 1, column: 1 }), 0)
  }

  const handleMinify = () => {
    const result = safeParseJson(rawValue)
    if (!result.ok) return setPanelError(result.error)
    applyRawText(JSON.stringify(result.value))
  }

  const handleEscape = () => applyRawText(JSON.stringify(rawValue))

  const handleUnescape = () => {
    const input = rawValue.trim()
    const direct = safeParseJson(input)
    if (direct.ok && typeof direct.value === 'string') return applyRawText(direct.value)
    const wrapped = safeParseJson(`"${input.replace(/"/g, '\\"')}"`)
    if (wrapped.ok && typeof wrapped.value === 'string') return applyRawText(wrapped.value)
    setPanelError('当前内容不是可去转义的 JSON 字符串')
  }

  const withValidSnapshot = (action: (root: any) => void) => {
    if (!currentTextIsValid || analysis.parsed == null) {
      setPanelError('当前文本存在解析错误，请先修复后再编辑结构。')
      return
    }
    action(analysis.parsed)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawValue)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const checkSave = getShortcutChecker('save')
      const checkUndo = getShortcutChecker('undo')
      const checkRedo = getShortcutChecker('redo')
      if (checkSave && checkSave(event)) {
        event.preventDefault()
        void handleCopy()
      }
      if (checkUndo && checkUndo(event) && editorRef.current?.trigger) {
        event.preventDefault()
        editorRef.current.trigger('keyboard', 'undo', null)
      }
      if (checkRedo && checkRedo(event) && editorRef.current?.trigger) {
        event.preventDefault()
        editorRef.current.trigger('keyboard', 'redo', null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getShortcutChecker, rawValue])

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2"><Braces className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold italic">JSON 编辑器</h2></div><p className="text-xs text-muted-foreground mt-2">文本编辑与结构编辑分离，树视图基于最近一次有效快照更新。</p></div>
        <div className="flex items-center gap-2 flex-wrap">{[{ label: '格式化', icon: AlignLeft, onClick: handleFormat }, { label: '压缩', icon: Minimize2, onClick: handleMinify }, { label: '转义', icon: ChevronRight, onClick: handleEscape }, { label: '去转义', icon: ChevronDown, onClick: handleUnescape }, { label: copied ? '已复制' : '复制', icon: Copy, onClick: () => void handleCopy() }].map((item) => <Button key={item.label} variant="outline" size="sm" onClick={item.onClick} className="space-x-1"><item.icon className="w-4 h-4" /><span>{item.label}</span></Button>)}<Button variant="outline" size="sm" onClick={() => applyRawText('')} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-400/20"><Trash2 className="w-4 h-4" /></Button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">{[{ label: '解析状态', value: analysis.error ? '待修复' : isAnalyzing ? '分析中' : '已同步', tone: analysis.error ? 'text-amber-300' : 'text-emerald-300' }, { label: '最近快照', value: new Date(analysis.updatedAt).toLocaleTimeString(), tone: 'text-foreground' }, { label: '节点数量', value: String(tree.length), tone: 'text-foreground' }, { label: '当前文本', value: currentTextIsValid ? '可编辑结构' : '仅保留上次有效树', tone: currentTextIsValid ? 'text-emerald-300' : 'text-amber-300' }].map((item) => <div key={item.label} className="glass-card rounded-2xl border border-border px-4 py-3"><div className="text-muted-foreground/70">{item.label}</div><div className={cn('mt-2 text-sm font-semibold', item.tone)}>{item.value}</div></div>)}</div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-4">
        <div className="glass-card rounded-2xl border border-border overflow-hidden min-h-0 flex flex-col"><div className="px-4 py-3 border-b border-border flex items-center justify-between"><div className="text-sm font-semibold text-foreground">原始文本</div><div className="text-[11px] text-muted-foreground">{MonacoEditor ? 'Monaco 已就绪' : '先用轻量输入，再自动切换 Monaco'}</div></div><div className="flex-1 min-h-0 relative">{MonacoEditor ? <MonacoEditor height="100%" defaultLanguage="json" value={rawValue} onChange={(value: string) => setRawValue(value || '')} onMount={(editor: any) => { editorRef.current = editor }} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', scrollBeyondLastLine: false, automaticLayout: true, padding: { top: 16, bottom: 16 } }} /> : <textarea value={rawValue} onChange={(event) => setRawValue(event.target.value)} className="w-full h-full resize-none bg-[#0f172a] text-slate-100 p-4 font-mono text-sm focus:outline-none" spellCheck={false} />} {(isAnalyzing || (!MonacoEditor && rawValue === DEFAULT_JSON)) ? <div className="absolute top-3 right-3 text-[11px] px-2 py-1 rounded-full border border-border bg-background/70 backdrop-blur text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />本地分析中</div> : null}</div></div>

        <div className="glass-card rounded-2xl border border-border overflow-hidden min-h-0 flex flex-col"><div className="px-4 py-3 border-b border-border flex items-center justify-between"><div className="text-sm font-semibold text-foreground">结构预览</div><div className="text-[11px] text-muted-foreground">{analysis.error ? '基于上次有效快照显示' : '点击节点即可编辑'}</div></div>{analysis.parsed == null ? <div className="p-6 text-sm text-muted-foreground">请输入有效 JSON 以开始结构预览。</div> : <div className="flex-1 min-h-0 grid grid-rows-[1fr,auto]"><div className="overflow-auto p-3 space-y-1">{visibleTree.map((node: TreeNode) => { const nodeId = pathToString(node.path); const canExpand = node.type === 'object' || node.type === 'array'; const isSelected = nodeId === pathToString(selectedPath); const isExpanded = expanded[nodeId]; const Icon = canExpand ? (isExpanded ? ChevronDown : ChevronRight) : null; return <button key={nodeId} onClick={() => setSelectedPath(node.path)} className={cn('w-full flex items-center gap-2 rounded-xl px-2 py-2 text-left text-xs border', isSelected ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/20')}><span className="shrink-0" style={{ width: node.depth * 12 }} />{canExpand ? <span className={cn('w-4 h-4 inline-flex items-center justify-center rounded hover:bg-muted/30', node.hasChildren ? 'opacity-100' : 'opacity-30')} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (node.hasChildren) setExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] })) }}>{Icon ? <Icon className="w-3 h-3" /> : null}</span> : <span className="w-4" />}<span className="font-mono truncate text-foreground">{node.keyLabel}</span><span className="ml-auto font-mono text-[10px] text-muted-foreground/80">{node.preview}</span></button>})}</div><div className="border-t border-border p-4 space-y-3"><div className="text-xs text-muted-foreground">当前选择：<span className="font-mono text-foreground">{pathToString(selectedPath)}</span></div>{analysis.error ? <div className="text-xs text-amber-300 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" />当前文本解析失败：{analysis.error}</div> : null}{panelError ? <div className="text-xs text-red-300">{panelError}</div> : null}{selectedParentType === 'object' && selectedPath.length > 0 && typeof selectedPath[selectedPath.length - 1] === 'string' ? <div className="flex items-center gap-2"><Input value={editKey} onChange={(event) => setEditKey(event.target.value)} className="h-9 bg-muted/20" /><Button variant="outline" size="sm" onClick={() => withValidSnapshot((root) => { const nextKey = editKey.trim(); if (!nextKey) return setPanelError('key 不能为空'); const nextValue = renameKey(root, selectedPath, nextKey); applyStructuredUpdate(nextValue); setExpanded((prev) => remapExpandedKeysForRename(prev, selectedPath, nextKey)); setSelectedPath((prev) => [...prev.slice(0, -1), nextKey]); })}><Pencil className="w-4 h-4" /></Button></div> : null}<textarea value={editLiteral} onChange={(event) => setEditLiteral(event.target.value)} className="w-full h-24 rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs resize-none focus:outline-none focus:border-primary/50" placeholder='值，例如 {"a":1} / [1,2] / true / null' /><div className="flex gap-2 flex-wrap"><Button variant="outline" size="sm" onClick={() => withValidSnapshot((root) => { const nextLiteral = safeParseJson(editLiteral); if (!nextLiteral.ok) return setPanelError(nextLiteral.error); applyStructuredUpdate(setAtPath(root, selectedPath, nextLiteral.value)); })}>更新值</Button><Button variant="outline" size="sm" className={cn(selectedPath.length === 0 && 'opacity-50', 'text-red-300 hover:text-red-200 hover:bg-red-500/10 border-red-400/20')} disabled={selectedPath.length === 0} onClick={() => withValidSnapshot((root) => applyStructuredUpdate(deleteAtPath(root, selectedPath)))}><Minus className="w-4 h-4 mr-1" />删除节点</Button></div>{selectedType === 'object' || selectedType === 'array' ? <div className="space-y-2"><div className="text-xs text-muted-foreground">添加子节点</div><div className="flex gap-2 flex-wrap">{selectedType === 'object' ? <Input value={addKey} onChange={(event) => setAddKey(event.target.value)} placeholder="新 key" className="h-9 bg-muted/20 flex-1 min-w-[140px]" /> : null}<Input value={addLiteral} onChange={(event) => setAddLiteral(event.target.value)} placeholder='值，例如 "x" / 1 / {} / []' className="h-9 bg-muted/20 flex-1 min-w-[180px] font-mono" /><Button variant="outline" size="sm" onClick={() => withValidSnapshot((root) => { const target = selectedPath.length === 0 ? root : getAtPath(root, selectedPath); const parsedLiteral = safeParseJson(addLiteral); if (!parsedLiteral.ok) return setPanelError(parsedLiteral.error); if (selectedType === 'object') { const nextKey = addKey.trim(); if (!nextKey) return setPanelError('对象节点添加子项需要 key'); if (Object.prototype.hasOwnProperty.call(target, nextKey)) return setPanelError('key 已存在'); applyStructuredUpdate(setAtPath(root, selectedPath, { ...(target || {}), [nextKey]: parsedLiteral.value })); setAddKey(''); setAddLiteral('""'); return } applyStructuredUpdate(setAtPath(root, selectedPath, [...(target || []), parsedLiteral.value])); setAddLiteral('null') })}><Plus className="w-4 h-4" /></Button></div></div> : <div className="text-[11px] text-muted-foreground">选择 object 或 array 节点后可直接添加子项。</div>}</div></div>}</div>
      </div>

      <div className="glass-card rounded-2xl border border-border p-4 text-xs text-muted-foreground space-y-1"><div className="text-sm font-semibold text-foreground flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" />使用提示</div><p>• 首屏先渲染轻量文本编辑器，再按需加载 Monaco，避免本地工具首次卡顿。</p><p>• 结构树只在最近一次有效快照上更新，输入中断时不会整页抖动。</p><p>• 当文本存在语法错误时，树面板会保留上次有效结构，便于对照修复。</p></div>
    </div>
  )
}
