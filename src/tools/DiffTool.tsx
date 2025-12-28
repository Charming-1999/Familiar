import React, { useState } from 'react'
import { Button } from '../components/Button'
import { FileCode2, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'


export const DiffTool: React.FC = () => {
  const [text1, setText1] = useState('')
  const [text2, setText2] = useState('')


  // A very simple line-by-line diff implementation
  const getDiff = () => {
    const lines1 = text1.split('\n')
    const lines2 = text2.split('\n')
    const maxLines = Math.max(lines1.length, lines2.length)
    const diffResult = []

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || ''
      const line2 = lines2[i] || ''
      if (line1 === line2) {
        diffResult.push({ type: 'equal', content: line1, lineNum: i + 1 })
      } else {
        if (i < lines1.length) diffResult.push({ type: 'remove', content: line1, lineNum: i + 1 })
        if (i < lines2.length) diffResult.push({ type: 'add', content: line2, lineNum: i + 1 })
      }
    }
    return diffResult
  }

  const diff = getDiff()

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileCode2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">文本对比 (Diff)</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => { setText1(''); setText2('') }}
          className="text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          清空
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-1/3">
        <div className="flex flex-col space-y-2">
          <label className="text-xs text-muted-foreground px-1">原始文本 (Left)</label>
          <textarea
            className="flex-1 bg-muted/30 border border-border rounded-lg p-3 font-mono text-xs resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="粘贴第一个文本..."
            value={text1}
            onChange={(e) => setText1(e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <label className="text-xs text-muted-foreground px-1">对比文本 (Right)</label>
          <textarea
            className="flex-1 bg-muted/30 border border-border rounded-lg p-3 font-mono text-xs resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="粘贴第二个文本..."
            value={text2}
            onChange={(e) => setText2(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <label className="text-xs text-muted-foreground px-1">对比结果</label>
        <div className="flex-1 bg-muted/10 border border-border rounded-lg overflow-auto font-mono text-xs custom-scrollbar">
          {(!text1 && !text2) ? (
            <div className="h-full flex items-center justify-center text-muted-foreground opacity-30">
              等待输入文本以进行对比...
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {diff.map((line, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex min-h-[1.5rem] items-center px-2",
                    line.type === 'add' && "bg-green-500/10 text-green-400",
                    line.type === 'remove' && "bg-red-500/10 text-red-400",
                    line.type === 'equal' && "text-muted-foreground/70"
                  )}
                >
                  <span className="w-8 shrink-0 text-[10px] opacity-30 select-none">{line.lineNum}</span>
                  <span className="w-4 shrink-0 font-bold select-none">
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  <pre className="flex-1 whitespace-pre-wrap break-all">{line.content}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
