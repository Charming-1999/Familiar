import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as QRCode from 'qrcode'
import { QrCode, Copy, Check, Trash2, Download } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'

type EcLevel = 'L' | 'M' | 'Q' | 'H'

export const QrCodeTool: React.FC = () => {
  const [text, setText] = useState('')
  const [size, setSize] = useState(256)
  const [margin, setMargin] = useState(2)
  const [level, setLevel] = useState<EcLevel>('M')
  const [darkColor, setDarkColor] = useState('#111827')
  const [lightColor, setLightColor] = useState('#ffffff')

  const [dataUrl, setDataUrl] = useState<string>('')
  const [svgText, setSvgText] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState<'text' | 'dataUrl' | 'svg' | null>(null)

  const genReqIdRef = useRef(0)

  const canGenerate = useMemo(() => text.trim().length > 0, [text])

  useEffect(() => {
    if (!canGenerate) {
      setDataUrl('')
      setSvgText('')
      setError(null)
      setGenerating(false)
      return
    }

    const reqId = ++genReqIdRef.current
    setGenerating(true)
    setError(null)

    const t = window.setTimeout(async () => {
      try {
        const opts = {
          errorCorrectionLevel: level,
          width: size,
          margin,
          color: { dark: darkColor, light: lightColor },
        } as const

        const [png, svg] = await Promise.all([
          QRCode.toDataURL(text, opts),
          QRCode.toString(text, { ...opts, type: 'svg' as const }),
        ])

        if (genReqIdRef.current !== reqId) return
        setDataUrl(png)
        setSvgText(svg)
      } catch (e: any) {
        if (genReqIdRef.current !== reqId) return
        setError(e?.message || '生成失败')
        setDataUrl('')
        setSvgText('')
      } finally {
        if (genReqIdRef.current === reqId) setGenerating(false)
      }
    }, 150)

    return () => {
      window.clearTimeout(t)
    }
  }, [canGenerate, darkColor, level, lightColor, margin, size, text])

  const setCopiedToast = (k: 'text' | 'dataUrl' | 'svg') => {
    setCopied(k)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const copyText = async (value: string, k: 'text' | 'dataUrl' | 'svg') => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedToast(k)
  }

  const downloadDataUrl = (url: string, filename: string) => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const downloadSvg = (svg: string, filename: string) => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    downloadDataUrl(url, filename)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }


  const clearAll = () => {
    setText('')
    setError(null)
    setDataUrl('')
    setSvgText('')
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <QrCode className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">二维码生成</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空
          </Button>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-400 border border-red-400/20 rounded-lg bg-red-500/5">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6 flex-1 min-h-0">
        <div className="space-y-4 overflow-auto pr-2 custom-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>内容</span>
              <button
                onClick={() => setText('https://example.com')}
                className="hover:text-primary"
                type="button"
              >
                填入示例
              </button>
            </div>
            <textarea
              className="w-full h-28 bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="输入链接/文本（支持中文）..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">建议：URL 越短越易扫；可提升纠错等级增强容错。</div>
              <button
                className="text-xs text-muted-foreground hover:text-primary flex items-center"
                onClick={() => copyText(text, 'text')}
                type="button"
              >
                {copied === 'text' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied === 'text' ? '已复制' : '复制内容'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground px-1">尺寸（px）</label>
              <Input
                type="number"
                min={128}
                max={1024}
                step={16}
                value={String(size)}
                onChange={(e) => setSize(Math.max(128, Math.min(1024, Number(e.target.value) || 256)))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground px-1">边距（quiet zone）</label>
              <Input
                type="number"
                min={0}
                max={12}
                step={1}
                value={String(margin)}
                onChange={(e) => setMargin(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground px-1">纠错等级</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as EcLevel)}
                className="h-10 w-full rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="L">L（7%）</option>
                <option value="M">M（15%）</option>
                <option value="Q">Q（25%）</option>
                <option value="H">H（30%）</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground px-1">颜色</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="h-10 w-10 rounded border border-border bg-transparent"
                    aria-label="前景色"
                  />
                  <span className="text-xs text-muted-foreground">前景</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="h-10 w-10 rounded border border-border bg-transparent"
                    aria-label="背景色"
                  />
                  <span className="text-xs text-muted-foreground">背景</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">预览</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(dataUrl, 'dataUrl')}
                disabled={!dataUrl}
                className="space-x-1"
              >
                {copied === 'dataUrl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied === 'dataUrl' ? '已复制' : '复制 PNG(DataURL)'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(svgText, 'svg')}
                disabled={!svgText}
                className="space-x-1"
              >
                {copied === 'svg' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied === 'svg' ? '已复制' : '复制 SVG'}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => downloadDataUrl(dataUrl, 'qrcode.png')}
                disabled={!dataUrl}
                className="space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>下载 PNG</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadSvg(svgText, 'qrcode.svg')}
                disabled={!svgText}
                className="space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>SVG</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-6">
            {!canGenerate ? (
              <div className="glass-card p-8 rounded-xl text-sm text-muted-foreground">输入内容后自动生成二维码。</div>
            ) : generating ? (
              <div className="glass-card p-8 rounded-xl text-sm text-muted-foreground">正在生成...</div>
            ) : dataUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={dataUrl}
                  alt="二维码"
                  className="rounded-lg border border-border bg-white"
                  style={{ width: Math.min(size, 360), height: Math.min(size, 360) }}
                />
                <div className="text-xs text-muted-foreground">右上角可下载 PNG/SVG，或复制 DataURL/SVG。</div>
              </div>
            ) : (
              <div className="glass-card p-8 rounded-xl text-sm text-muted-foreground">未生成结果。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
