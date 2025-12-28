import React, { useState } from 'react'
import { Button } from '../components/Button'
import { Binary, ArrowLeftRight, Copy, Check, Upload } from 'lucide-react'


export const Base64Tool: React.FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [copied, setCopied] = useState(false)

  const handleProcess = () => {
    try {
      if (mode === 'encode') {
        setOutput(btoa(input))
      } else {
        setOutput(atob(input))
      }
    } catch (err) {
      setOutput('Error: Invalid input for Base64 ' + mode)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setOutput(base64)
      setInput(`File: ${file.name} (${file.type})`)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Binary className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">Base64 转换</h2>
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
            <div className="flex items-center space-x-4">
               <label className="cursor-pointer hover:text-primary flex items-center">
                 <Upload className="w-3 h-3 mr-1" />
                 图片转 Base64
                 <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
               </label>
               <button onClick={() => setInput('')} className="hover:text-red-400">清空</button>
            </div>
          </div>
          <textarea
            className="flex-1 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder={mode === 'encode' ? '输入要编码的文本...' : '输入 Base64 字符串...'}
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
          />
          <Button 
            className="absolute top-1/2 left-[-1.5rem] -translate-y-1/2 rounded-full w-8 h-8 p-0 hidden md:flex border border-border bg-background"
            variant="outline"
            onClick={handleProcess}
          >
            <ArrowLeftRight className="w-4 h-4" />
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
        <h4 className="text-sm font-bold text-primary mb-2 italic">小技巧</h4>
        <p className="text-xs text-muted-foreground">
          您可以直接上传图片，工具会自动将其转换为 Data URL 格式的 Base64 字符串，方便在 HTML/CSS 中直接引用。
        </p>
      </div>
    </div>
  )
}
