import React, { useState } from 'react'
import { Button } from '../components/Button'
import { ShieldCheck, Copy, Check, Trash2 } from 'lucide-react'
import CryptoJS from 'crypto-js'

const HASH_ALGORITHMS = [
  { id: 'md5', name: 'MD5' },
  { id: 'sha1', name: 'SHA1' },
  { id: 'sha256', name: 'SHA256' },
  { id: 'sha512', name: 'SHA512' },
  { id: 'sha3', name: 'SHA3' },
]

export const HashTool: React.FC = () => {
  const [input, setInput] = useState('')

  const [copied, setCopied] = useState<string | null>(null)

  const getHash = (algorithm: string) => {
    if (!input) return ''
    try {
      switch (algorithm) {
        case 'md5': return CryptoJS.MD5(input).toString()
        case 'sha1': return CryptoJS.SHA1(input).toString()
        case 'sha256': return CryptoJS.SHA256(input).toString()
        case 'sha512': return CryptoJS.SHA512(input).toString()
        case 'sha3': return CryptoJS.SHA3(input).toString()
        default: return ''
      }
    } catch (err) {
      return '计算错误'
    }
  }

  const handleCopy = (text: string, id: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">哈希计算</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setInput('')}
          className="text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          清空
        </Button>
      </div>

      <div className="space-y-4 flex-1 overflow-auto pr-2 custom-scrollbar">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground px-1">输入内容</label>
          <textarea
            className="w-full h-32 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="输入要计算哈希的文本..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {HASH_ALGORITHMS.map((item) => {
            const hashResult = getHash(item.id)
            return (
              <div key={item.id} className="glass-card p-4 rounded-lg border-primary/5 group relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-primary italic">{item.name}</span>
                  <button 
                    onClick={() => handleCopy(hashResult, item.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {copied === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="font-mono text-xs break-all bg-background/50 p-2 rounded border border-border/50 text-muted-foreground group-hover:text-foreground transition-colors">
                  {hashResult || <span className="opacity-30">等待输入...</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass-card p-4 rounded-lg border-primary/10">
        <h4 className="text-sm font-bold text-primary mb-2 italic">安全提示</h4>
        <p className="text-xs text-muted-foreground">
          哈希算法是单向的，无法逆转。MD5 和 SHA1 在现代安全场景下已不再推荐用于密码存储，建议优先使用 SHA256 或更强的算法。
        </p>
      </div>
    </div>
  )
}
