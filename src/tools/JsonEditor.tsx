import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Minimize2, Trash2, WrapText } from 'lucide-react'

import { Button } from '../components/Button'
import { safeParseJson } from '../lib/jsonTools'
import { cn } from '../lib/utils'

/* ------------------------------------------------------------------ */
/*  Syntax-highlighted JSON renderer                                  */
/* ------------------------------------------------------------------ */

const colorOf = (type: string) => {
  switch (type) {
    case 'string':
      return 'text-emerald-400'
    case 'number':
      return 'text-amber-300'
    case 'boolean':
      return 'text-violet-400'
    case 'null':
      return 'text-red-400'
    case 'key':
      return 'text-sky-300'
    default:
      return 'text-foreground'
  }
}

const INDENT = 2

const renderJson = (value: unknown, indent: number, isLast: boolean): React.ReactNode[] => {
  const pad = ' '.repeat(indent)
  const comma = isLast ? '' : ','

  if (value === null) return [<span key={`${indent}-null`}>{pad}<span className={colorOf('null')}>null</span>{comma}{'\n'}</span>]
  if (typeof value === 'boolean') return [<span key={`${indent}-bool`}>{pad}<span className={colorOf('boolean')}>{String(value)}</span>{comma}{'\n'}</span>]
  if (typeof value === 'number') return [<span key={`${indent}-num`}>{pad}<span className={colorOf('number')}>{String(value)}</span>{comma}{'\n'}</span>]
  if (typeof value === 'string') {
    const escaped = JSON.stringify(value)
    return [<span key={`${indent}-str`}>{pad}<span className={colorOf('string')}>{escaped}</span>{comma}{'\n'}</span>]
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [<span key={`${indent}-arr`}>{pad}[]{comma}{'\n'}</span>]
    const nodes: React.ReactNode[] = [<span key={`${indent}-ao`}>{pad}[{'\n'}</span>]
    value.forEach((item, i) => {
      nodes.push(...renderJson(item, indent + INDENT, i === value.length - 1))
    })
    nodes.push(<span key={`${indent}-ac`}>{pad}]{comma}{'\n'}</span>)
    return nodes
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return [<span key={`${indent}-obj`}>{pad}{'{}'}{comma}{'\n'}</span>]
    const inner = ' '.repeat(indent + INDENT)
    const nodes: React.ReactNode[] = [<span key={`${indent}-oo`}>{pad}{'{'}{'\n'}</span>]
    entries.forEach(([k, v], i) => {
      const isLastEntry = i === entries.length - 1
      // For primitive values, render key: value on one line
      if (v === null || typeof v !== 'object') {
        const valComma = isLastEntry ? '' : ','
        let valSpan: React.ReactNode
        if (v === null) valSpan = <span className={colorOf('null')}>null</span>
        else if (typeof v === 'boolean') valSpan = <span className={colorOf('boolean')}>{String(v)}</span>
        else if (typeof v === 'number') valSpan = <span className={colorOf('number')}>{String(v)}</span>
        else valSpan = <span className={colorOf('string')}>{JSON.stringify(v)}</span>
        nodes.push(<span key={`${indent}-k-${k}`}>{inner}<span className={colorOf('key')}>{JSON.stringify(k)}</span>: {valSpan}{valComma}{'\n'}</span>)
      } else {
        // For nested objects/arrays, render key: then inline the opening bracket
        const childLines = renderJson(v, indent + INDENT, isLastEntry)
        // The first child line starts with padding + bracket, we need to prepend the key
        const firstChild = childLines[0]
        if (React.isValidElement(firstChild)) {
          const children = (firstChild.props as { children: React.ReactNode }).children
          const childArr = React.Children.toArray(children)
          // Remove leading whitespace from first child and prepend key
          const bracket = childArr.length > 0 ? childArr[0] : ''
          const rest = childArr.slice(1)
          nodes.push(
            <span key={`${indent}-k-${k}`}>
              {inner}<span className={colorOf('key')}>{JSON.stringify(k)}</span>:{' '}
              {typeof bracket === 'string' ? bracket.trimStart() : bracket}
              {rest}
            </span>
          )
          nodes.push(...childLines.slice(1))
        } else {
          nodes.push(<span key={`${indent}-k-${k}`}>{inner}<span className={colorOf('key')}>{JSON.stringify(k)}</span>: </span>)
          nodes.push(...childLines)
        }
      }
    })
    nodes.push(<span key={`${indent}-oc`}>{pad}{'}'}{comma}{'\n'}</span>)
    return nodes
  }

  return [<span key={`${indent}-unk`}>{pad}{String(value)}{comma}{'\n'}</span>]
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export const JsonEditor: React.FC = () => {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const parsed = useMemo(() => {
    const trimmed = input.trim()
    if (!trimmed) return { ok: true as const, value: undefined }
    return safeParseJson(trimmed)
  }, [input])

  const formattedNodes = useMemo(() => {
    if (!parsed.ok || parsed.value === undefined) return null
    return renderJson(parsed.value, 0, true)
  }, [parsed])

  const handleFormat = useCallback(() => {
    if (!parsed.ok || parsed.value === undefined) return
    setInput(JSON.stringify(parsed.value, null, 2))
  }, [parsed])

  const handleMinify = useCallback(() => {
    if (!parsed.ok || parsed.value === undefined) return
    setInput(JSON.stringify(parsed.value))
  }, [parsed])

  const handleEscape = useCallback(() => {
    setInput(JSON.stringify(input))
  }, [input])

  const handleUnescape = useCallback(() => {
    const trimmed = input.trim()
    const direct = safeParseJson(trimmed)
    if (direct.ok && typeof direct.value === 'string') {
      setInput(direct.value)
      return
    }
    const wrapped = safeParseJson(`"${trimmed.replace(/"/g, '\\"')}"`)
    if (wrapped.ok && typeof wrapped.value === 'string') {
      setInput(wrapped.value)
    }
  }, [input])

  const handleCopy = useCallback(async () => {
    const text = parsed.ok && parsed.value !== undefined ? JSON.stringify(parsed.value, null, 2) : input
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }, [input, parsed])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(t)
  }, [copied])

  const handleClear = useCallback(() => {
    setInput('')
    textareaRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleFormat} disabled={!parsed.ok || parsed.value === undefined}>
          <WrapText className="w-4 h-4 mr-1" />格式化
        </Button>
        <Button variant="outline" size="sm" onClick={handleMinify} disabled={!parsed.ok || parsed.value === undefined}>
          <Minimize2 className="w-4 h-4 mr-1" />压缩
        </Button>
        <Button variant="outline" size="sm" onClick={handleEscape} disabled={!input.trim()}>
          转义
        </Button>
        <Button variant="outline" size="sm" onClick={handleUnescape} disabled={!input.trim()}>
          去转义
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCopy()} disabled={!input.trim()}>
          <Copy className="w-4 h-4 mr-1" />{copied ? '已复制' : '复制'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={!input} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-400/20">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴 JSON ..."
          spellCheck={false}
          className="w-full h-full resize-none rounded-xl border border-border bg-[#0d1117] text-slate-100 p-4 font-mono text-sm leading-relaxed focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
        />

        {/* Right: structured output */}
        <div className={cn(
          'w-full h-full rounded-xl border border-border bg-[#0d1117] overflow-auto',
          !input.trim() && 'flex items-center justify-center',
        )}>
          {!input.trim() ? (
            <span className="text-muted-foreground/40 text-sm select-none">结构化结果</span>
          ) : !parsed.ok ? (
            <div className="p-4 text-sm text-red-400 font-mono whitespace-pre-wrap">{(parsed as { ok: false; error: string }).error}</div>
          ) : (
            <pre className="p-4 text-sm font-mono leading-relaxed whitespace-pre select-text">{formattedNodes}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
