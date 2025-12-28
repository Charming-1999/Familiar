import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Fingerprint, Copy, Check, Trash2, AlertCircle } from 'lucide-react'
import { jwtDecode } from 'jwt-decode'

export const JwtTool: React.FC = () => {
  const [token, setToken] = useState('')
  const [header, setHeader] = useState<any>(null)
  const [payload, setPayload] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setHeader(null)
      setPayload(null)
      setError(null)
      return
    }

    try {
      const decodedPayload = jwtDecode(token)
      const decodedHeader = jwtDecode(token, { header: true })
      setPayload(decodedPayload)
      setHeader(decodedHeader)
      setError(null)
    } catch (err) {
      setError('无效的 JWT 格式')
      setHeader(null)
      setPayload(null)
    }
  }, [token])

  const handleCopy = (data: any, id: string) => {
    if (!data) return
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Fingerprint className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">JWT 解码器</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setToken('')}
          className="text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          清空
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col space-y-2">
          <label className="text-xs text-muted-foreground px-1">JWT Token</label>
          <textarea
            className="flex-1 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="在此处粘贴 JWT Token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && (
            <div className="flex items-center space-x-2 text-destructive text-xs mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-6 overflow-auto pr-2 custom-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-primary italic">HEADER: ALGORITHM & TOKEN TYPE</label>
              <button onClick={() => handleCopy(header, 'header')} className="text-muted-foreground hover:text-primary transition-colors">
                {copied === 'header' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="bg-muted/10 border border-border rounded-lg p-4 font-mono text-xs text-foreground overflow-auto">
              {header ? JSON.stringify(header, null, 2) : <span className="opacity-30">等待解析...</span>}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-primary italic">PAYLOAD: DATA</label>
              <button onClick={() => handleCopy(payload, 'payload')} className="text-muted-foreground hover:text-primary transition-colors">
                {copied === 'payload' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <pre className="bg-muted/10 border border-border rounded-lg p-4 font-mono text-xs text-foreground overflow-auto">
              {payload ? JSON.stringify(payload, null, 2) : <span className="opacity-30">等待解析...</span>}
            </pre>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-lg border-primary/10">
        <h4 className="text-sm font-bold text-primary mb-2 italic">安全提示</h4>
        <p className="text-xs text-muted-foreground">
          JWT 解码仅解析 Token 中的公开信息，不涉及密钥验证。请勿在客户端代码或公开工具中处理包含敏感隐私数据的 JWT。
        </p>
      </div>
    </div>
  )
}
