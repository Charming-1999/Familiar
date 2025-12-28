import React, { useState } from 'react'
import { Button } from '../components/Button'
import { Link2, ArrowLeftRight, Copy, Check, Trash2 } from 'lucide-react'


export const UrlTool: React.FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [copied, setCopied] = useState(false)

  const handleProcess = () => {
    try {
      if (mode === 'encode') {
        setOutput(encodeURIComponent(input))
      } else {
        setOutput(decodeURIComponent(input))
      }
    } catch (err) {
      setOutput('错误: 无效的 URL 编码字符串')
    }
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
  }



  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">URL 编解码</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={mode === 'encode' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setMode('encode')}
          >
            编码
          </Button>
          <Button 
            variant={mode === 'decode' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setMode('decode')}
          >
            解码
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>输入内容</span>
            <button onClick={handleClear} className="hover:text-red-400 flex items-center">
              <Trash2 className="w-3 h-3 mr-1" />
              清空
            </button>
          </div>
          <textarea
            className="flex-1 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder={mode === 'encode' ? '输入要编码的文本...' : '输入 URL 编码字符串...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <div className="flex flex-col space-y-2 relative">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>输出结果</span>
            <button onClick={handleCopy} className="hover:text-primary flex items-center">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? '已复制' : '复制结果'}
            </button>
          </div>
          <textarea
            readOnly
            className="flex-1 bg-muted/10 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none"
            value={output}
            placeholder="结果将在此处显示..."
          />
          <Button 
            className="absolute top-1/2 left-[-1.5rem] -translate-y-1/2 rounded-full w-8 h-8 p-0 hidden md:flex border border-border bg-background hover:bg-primary/10 transition-colors group"
            variant="outline"
            onClick={handleProcess}
          >
            <ArrowLeftRight className="w-4 h-4 group-active:rotate-180 transition-transform duration-300" />
          </Button>
          <Button 
            className="md:hidden mt-4"
            onClick={handleProcess}
          >
            转换
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 rounded-lg border-primary/10">
        <h4 className="text-sm font-bold text-primary mb-2 italic">关于 URL 编码</h4>
        <p className="text-xs text-muted-foreground">
          URL 编码（也称为百分比编码）是一种用于在 URI（统一资源标识符）中编码信息的机制。
          它将非法字符替换为 "%" 后跟两位十六进制数。
        </p>
      </div>
    </div>
  )
}
