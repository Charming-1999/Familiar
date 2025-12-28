import React, { useEffect, useMemo, useState } from 'react'
import { Quote } from 'lucide-react'

import { cn } from '../lib/utils'

type QuoteItem = {
  text: string
  author?: string
}

const QUOTES: QuoteItem[] = [
  { text: 'Debugging is like being the detective in a crime movie where you are also the murderer.', author: 'Filipe Fortes' },
  { text: 'Weeks of coding can save you hours of planning.', author: 'Unknown' },
  { text: 'It works on my machine.', author: 'Every developer' },
  { text: 'There are only two hard things in Computer Science: cache invalidation and naming things.', author: 'Phil Karlton' },
  { text: 'If it hurts, do it more often.', author: 'Jez Humble' },
  { text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'A bug is never just a bug.', author: 'Unknown' },
  { text: '99 little bugs in the code, 99 little bugs… take one down, patch it around, 127 little bugs in the code.', author: 'Unknown' },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function safeReadJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeWriteJSON(key: string, value: any) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export const DailyQuoteWidget: React.FC<{ className?: string }> = ({ className }) => {
  const storageKey = 'daily-quote:v1'

  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = todayKey()
    const cached = safeReadJSON<{ date: string; index: number }>(storageKey)

    if (cached && cached.date === t && Number.isFinite(cached.index)) {
      const i = Math.max(0, Math.min(QUOTES.length - 1, cached.index))
      setIndex(i)
      return
    }

    const i = Math.floor(Math.random() * QUOTES.length)
    setIndex(i)
    safeWriteJSON(storageKey, { date: t, index: i })
  }, [])

  const item = useMemo(() => QUOTES[index] || QUOTES[0], [index])

  return (
    <div className={cn('glass-card border border-border rounded-xl px-4 py-3', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-primary">
          <Quote className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-foreground leading-relaxed line-clamp-3">{item.text}</div>
          {item.author ? <div className="mt-1 text-[11px] text-muted-foreground truncate">— {item.author}</div> : null}
        </div>
      </div>
    </div>
  )
}
