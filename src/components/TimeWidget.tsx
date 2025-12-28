import React, { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'

function formatDateTime(d: Date) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).format(d)

  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)

  return { date, time }
}

export const TimeWidget: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const { date, time } = useMemo(() => formatDateTime(now), [now])

  if (compact) {
    return (
      <div className="glass-card px-3 py-2 rounded-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-primary" />
            <div className="text-xs font-semibold text-foreground">时间</div>
          </div>
          <div className="text-sm font-bold text-foreground font-mono tabular-nums">{time}</div>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground truncate">{date}</div>
      </div>
    )
  }

  return (
    <div className="glass-card p-4 rounded-xl border-primary/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">当前时间</div>
        </div>
        <div className="text-[11px] text-muted-foreground">本地</div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">{time}</div>
        <div className="mt-1 text-xs text-muted-foreground">{date}</div>
      </div>
    </div>
  )
}
