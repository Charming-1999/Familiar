import React, { useMemo, useRef, useState } from 'react'
import { StickyNote, X, Minus, Maximize2, Send, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { cn } from '../lib/utils'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatNowForTitle(d: Date) {
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function clampText(s: string) {
  return s.slice(0, 4000)
}

export const StickyNotesWidget: React.FC = () => {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const infoTimerRef = useRef<number | null>(null)

  const canSubmit = useMemo(() => {
    return !!user && text.trim().length > 0 && !submitting
  }, [submitting, text, user])

  const clearInfoSoon = () => {
    if (infoTimerRef.current != null) window.clearTimeout(infoTimerRef.current)
    infoTimerRef.current = window.setTimeout(() => {
      infoTimerRef.current = null
      setInfo(null)
    }, 2500)
  }

  const handleSubmit = async () => {
    if (!user) return
    const content = text.trim()
    if (!content) return

    setSubmitting(true)
    setError(null)

    try {
      const { data: last, error: lastError } = await supabase
        .from('notes')
        .select('order_index')
        .eq('user_id', user.id)
        .order('order_index', { ascending: false })
        .limit(1)

      if (lastError) throw lastError
      const nextIndex = (last?.[0]?.order_index ?? -1) + 1

      const title = `灵感 ${formatNowForTitle(new Date())}`
      const { error: insertError } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
        format: 'plain',
        order_index: nextIndex,
        updated_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      setText('')
      setInfo('已提交到“随心记”')
      clearInfoSoon()
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2.5rem)]',
        'glass-card border border-border shadow-lg',
        'rounded-xl'
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground truncate">灵感速记</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background/10 hover:bg-muted/30"
            onClick={() => navigate('/tool/notes')}
            title="打开随心记"
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background/10 hover:bg-muted/30"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? <Maximize2 className="w-4 h-4 text-muted-foreground" /> : <Minus className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background/10 hover:bg-red-500/10 hover:border-red-400/40"
            onClick={() => setText('')}
            title="清空"
            disabled={submitting}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="p-3">
          <textarea
            value={text}
            onChange={(e) => setText(clampText(e.target.value))}
            placeholder={`回车提交到“随心记”（标题：灵感 + 当前时间）\nShift+Enter 换行`}
            className={cn(
              'w-full h-44 resize-none rounded-lg border border-border bg-background/10',
              'px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSubmit) handleSubmit()
              }
            }}
            disabled={submitting}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground min-w-0">
              <div className="truncate">当前用户：{profile?.email || user.email || '未知'}</div>
              {info ? <div className="text-primary truncate">{info}</div> : null}
              {error ? <div className="text-red-400 truncate">{error}</div> : null}
            </div>

            <button
              className={cn(
                'h-9 px-3 rounded-md border border-border bg-background/10 hover:bg-muted/30',
                'inline-flex items-center gap-2 text-sm',
                !canSubmit && 'opacity-50 pointer-events-none'
              )}
              onClick={handleSubmit}
              title="提交到随心记"
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中…' : '提交'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
