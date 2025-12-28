import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Clock, RefreshCcw, Copy, Check, ArrowDown, ArrowUp } from 'lucide-react'

export const TimestampTool: React.FC = () => {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [timestamp, setTimestamp] = useState(Math.floor(Date.now() / 1000).toString())
  const [dateStr, setDateStr] = useState(new Date().toLocaleString())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleToDate = () => {
    try {
      const t = parseInt(timestamp)
      const d = new Date(t * 1000)
      if (isNaN(d.getTime())) throw new Error()
      setDateStr(d.toLocaleString())
    } catch {
      setDateStr('Invalid Timestamp')
    }
  }

  const handleToTimestamp = () => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) throw new Error()
      setTimestamp(Math.floor(d.getTime() / 1000).toString())
    } catch {
      setTimestamp('Invalid Date')
    }
  }

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">时间戳转换</h2>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border-primary/20 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">当前 Unix 时间戳</p>
          <p className="text-4xl font-black text-primary font-mono tracking-tighter">{now}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => handleCopy(now.toString())}
          className="space-x-2 border-primary/20"
        >
          {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '已复制' : '复制当前'}</span>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Unix 时间戳 (秒)</label>
          <div className="flex space-x-2">
            <Input 
              value={timestamp} 
              onChange={(e) => setTimestamp(e.target.value)}
              className="font-mono text-lg bg-muted/30"
            />
            <Button onClick={handleToDate} className="shrink-0">
              <ArrowDown className="w-4 h-4 mr-2" /> 转换
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <RefreshCcw className="w-6 h-6 text-muted-foreground/30" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">本地时间 (YYYY/MM/DD HH:mm:ss)</label>
          <div className="flex space-x-2">
            <Input 
              value={dateStr} 
              onChange={(e) => setDateStr(e.target.value)}
              className="font-mono text-lg bg-muted/30"
            />
            <Button onClick={handleToTimestamp} className="shrink-0">
              <ArrowUp className="w-4 h-4 mr-2" /> 转换
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted/20 border border-border">
          <p className="text-[10px] text-muted-foreground uppercase mb-2">常用单位</p>
          <ul className="text-xs space-y-2 font-mono">
            <li className="flex justify-between"><span>1 分钟</span> <span className="text-primary">60 秒</span></li>
            <li className="flex justify-between"><span>1 小时</span> <span className="text-primary">3,600 秒</span></li>
            <li className="flex justify-between"><span>1 天</span> <span className="text-primary">86,400 秒</span></li>
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-muted/20 border border-border">
          <p className="text-[10px] text-muted-foreground uppercase mb-2">JavaScript 代码</p>
          <code className="text-[10px] text-primary/70 block bg-black/40 p-2 rounded">
            Math.floor(Date.now() / 1000)
          </code>
        </div>
      </div>
    </div>
  )
}
