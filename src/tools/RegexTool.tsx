import React, { useState, useMemo } from 'react'
import { Button } from '../components/Button'
import { Search, Trash2, CheckCircle2, XCircle } from 'lucide-react'

import { cn } from '../lib/utils'

export const RegexTool: React.FC = () => {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('')


  const matches = useMemo(() => {
    if (!pattern || !text) return []
    try {
      const regex = new RegExp(pattern, flags)
      const results = []
      let match
      
      if (flags.includes('g')) {
        while ((match = regex.exec(text)) !== null) {
          results.push({
            index: match.index,
            text: match[0],
            groups: [...match].slice(1)
          })
          if (match.index === regex.lastIndex) regex.lastIndex++
        }
      } else {
        match = text.match(regex)
        if (match) {
          results.push({
            index: match.index || 0,
            text: match[0],
            groups: [...match].slice(1)
          })
        }
      }
      return results
    } catch (err) {
      return null
    }
  }, [pattern, flags, text])

  const isValid = pattern === '' || matches !== null

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">正则表达式测试</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => { setPattern(''); setText('') }}
          className="text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          清空
        </Button>
      </div>

      <div className="space-y-4 flex-1 overflow-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 space-y-2">
            <label className="text-xs text-muted-foreground px-1 flex items-center justify-between">
              <span>正则表达式</span>
              {!isValid && <span className="text-destructive flex items-center"><XCircle className="w-3 h-3 mr-1" /> 无效的表达式</span>}
              {isValid && pattern && <span className="text-primary flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> 表达式有效</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">/</span>
              <input
                className={cn(
                  "w-full bg-muted/30 border border-border rounded-lg py-3 px-6 font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors",
                  !isValid && "border-destructive/50 focus:border-destructive"
                )}
                placeholder="[a-zA-Z0-9]+"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">/</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground px-1">修饰符</label>
            <input
              className="w-full bg-muted/30 border border-border rounded-lg py-3 px-4 font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="gim"
              value={flags}
              onChange={(e) => setFlags(e.target.value.replace(/[^gimuy]/g, ''))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
          <div className="flex flex-col space-y-2">
            <label className="text-xs text-muted-foreground px-1">测试文本</label>
            <textarea
              className="flex-1 min-h-[200px] bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="在此输入要测试的文本..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-xs text-muted-foreground px-1 flex justify-between">
              <span>匹配结果 ({matches?.length || 0})</span>
            </label>
            <div className="flex-1 min-h-[200px] bg-muted/10 border border-border rounded-lg p-4 font-mono text-sm overflow-auto">
              {matches === null ? (
                <div className="text-destructive opacity-50 flex items-center h-full justify-center">
                   <AlertCircle className="w-5 h-5 mr-2" /> 表达式语法错误
                </div>
              ) : matches.length === 0 ? (
                <div className="text-muted-foreground opacity-30 flex items-center h-full justify-center">
                   等待匹配...
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.map((m, i) => (
                    <div key={i} className="bg-primary/5 border border-primary/20 rounded p-2 text-xs">
                      <div className="text-primary font-bold mb-1 italic">Match {i + 1} (Index: {m.index})</div>
                      <div className="text-foreground bg-background/50 p-1 rounded mb-2 break-all">{m.text}</div>
                      {m.groups.length > 0 && (
                        <div className="space-y-1 pl-2 border-l border-primary/20">
                          {m.groups.map((g, gi) => (
                            <div key={gi} className="text-muted-foreground">
                              Group {gi + 1}: <span className="text-foreground">{g}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-lg border-primary/10">
        <h4 className="text-sm font-bold text-primary mb-2 italic">常用正则</h4>
        <div className="flex flex-wrap gap-2">
          {[
            { name: '数字', reg: '^\\d+$' },
            { name: '邮箱', reg: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' },
            { name: '手机号', reg: '^1[3-9]\\d{9}$' },
            { name: 'URL', reg: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)' }
          ].map(r => (
            <button 
              key={r.name}
              onClick={() => setPattern(r.reg)}
              className="text-[10px] px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded transition-colors"
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
)
