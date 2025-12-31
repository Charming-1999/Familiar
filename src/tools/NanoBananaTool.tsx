import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Square, ExternalLink, Sparkles, Upload, RotateCcw, X } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'


type NanoBananaModel =
  | 'nano-banana-fast'
  | 'nano-banana'
  | 'nano-banana-pro'
  | 'nano-banana-pro-vt'
  | 'nano-banana-pro-cl'
  | 'nano-banana-pro-vip'
  | 'nano-banana-pro-4k-vip'

type AspectRatio =
  | 'auto'
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '5:4'
  | '4:5'
  | '21:9'

type ImageSize = '1K' | '2K' | '4K'

type NanoBananaResultItem = {
  url: string
  content: string
}

type NanoBananaJob = {
  id: string
  results: NanoBananaResultItem[]
  progress: number
  status: 'running' | 'succeeded' | 'failed'
  failure_reason?: string
  error?: string
}

const LS_API_KEY = 'nanobanana:apiKey'
const LS_BASE_URL = 'nanobanana:baseUrl'

const DEFAULT_BASE_URL = 'https://grsai.dakka.com.cn'

const MODELS: Array<{ id: NanoBananaModel; label: string }> = [
  { id: 'nano-banana-fast', label: 'nano-banana-fast（快速）' },
  { id: 'nano-banana', label: 'nano-banana（标准）' },
  { id: 'nano-banana-pro', label: 'nano-banana-pro（Pro）' },
  { id: 'nano-banana-pro-vt', label: 'nano-banana-pro-vt（Pro VT）' },
  { id: 'nano-banana-pro-cl', label: 'nano-banana-pro-cl（Pro CL）' },
  { id: 'nano-banana-pro-vip', label: 'nano-banana-pro-vip（Pro VIP）' },
  { id: 'nano-banana-pro-4k-vip', label: 'nano-banana-pro-4k-vip（4K VIP）' },
]

const ASPECT_RATIOS: Array<{ id: AspectRatio; label: string }> = [
  { id: 'auto', label: 'auto（自动）' },
  { id: '1:1', label: '1:1' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '4:3', label: '4:3' },
  { id: '3:4', label: '3:4' },
  { id: '3:2', label: '3:2' },
  { id: '2:3', label: '2:3' },
  { id: '5:4', label: '5:4' },
  { id: '4:5', label: '4:5' },
  { id: '21:9', label: '21:9' },
]

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const cleanup = () => {
      window.clearTimeout(t)
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    if (signal) {
      if (signal.aborted) {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', onAbort)
    }
  })
}

function parseUrls(text: string): string[] {
  const raw = text
    .split(/\r?\n|,|;|\s+/g)
    .map((s) => s.trim())
    .filter(Boolean)

  // 去重（保持顺序）
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of raw) {
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

function getImageSizeOptions(model: NanoBananaModel): ImageSize[] {
  if (model === 'nano-banana-pro-4k-vip') return ['4K']
  if (model === 'nano-banana-pro-vip') return ['1K', '2K']
  if (model.startsWith('nano-banana-pro')) return ['1K', '2K', '4K']
  return []
}

export const NanoBananaTool: React.FC = () => {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)

  const [model, setModel] = useState<NanoBananaModel>('nano-banana-pro')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto')
  const [imageSize, setImageSize] = useState<ImageSize>('1K')
  const [urlsText, setUrlsText] = useState('')
  const [uploading, setUploading] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [job, setJob] = useState<NanoBananaJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageSizeOptions = useMemo(() => getImageSizeOptions(model), [model])

  const showImageSize = imageSizeOptions.length > 0

  useEffect(() => {
    // 初始化 key/baseUrl（支持 .env 默认值，也支持本地存储覆盖）
    const envKey = (import.meta as any)?.env?.VITE_NANOBANANA_API_KEY
    const storedKey = window.localStorage.getItem(LS_API_KEY)
    setApiKey((storedKey || envKey || '').toString())

    const envBase = (import.meta as any)?.env?.VITE_NANOBANANA_BASE_URL
    const storedBase = window.localStorage.getItem(LS_BASE_URL)
    setBaseUrl((storedBase || envBase || DEFAULT_BASE_URL).toString())

    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    // 当模型切换时，确保 imageSize 落在允许范围内
    if (!showImageSize) return
    if (imageSizeOptions.includes(imageSize)) return
    setImageSize(imageSizeOptions[0] || '1K')
  }, [model, showImageSize, imageSize, imageSizeOptions])

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setSubmitting(false)
  }

  const persistSettings = () => {
    try {
      window.localStorage.setItem(LS_API_KEY, apiKey)
      window.localStorage.setItem(LS_BASE_URL, baseUrl)
    } catch {
      // ignore
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('nanobanana_temp')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })


      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('nanobanana_temp')
        .getPublicUrl(filePath)

      setUrlsText((prev) => {
        const lines = prev.split('\n').map(l => l.trim()).filter(Boolean)
        lines.push(publicUrl)
        return lines.join('\n')
      })
    } catch (err: any) {
      setError(`上传失败: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const useAsReference = (url: string) => {
    setUrlsText((prev) => {
      const urls = parseUrls(prev)
      if (urls.includes(url)) return prev
      return [...urls, url].join('\n')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeUrl = (urlToRemove: string) => {
    setUrlsText((prev) => {
      const urls = parseUrls(prev)
      return urls.filter(u => u !== urlToRemove).join('\n')
    })
  }

  const referenceUrls = useMemo(() => parseUrls(urlsText), [urlsText])

  const submitAndPoll = async () => {


    const key = apiKey.trim()
    const base = baseUrl.trim().replace(/\/$/, '')
    const p = prompt.trim()

    if (!key) {
      setError('请先填写 API Key（Authorization: Bearer apikey）')
      return
    }
    if (!p) {
      setError('请先填写提示词（prompt）')
      return
    }

    persistSettings()
    setError(null)
    setSubmitting(true)
    setJob(null)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    try {
      const urls = parseUrls(urlsText)

      const body: any = {
        model,
        prompt: p,
        aspectRatio,
        webHook: '-1',
        shutProgress: false,
      }

      if (urls.length > 0) body.urls = urls
      if (showImageSize) body.imageSize = imageSize

      const submitRes = await fetch(`${base}/v1/draw/nano-banana`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const submitText = await submitRes.text().catch(() => '')
      const submitJson = safeJsonParse<any>(submitText)

      if (!submitRes.ok) {
        throw new Error((submitJson?.msg as string) || submitText || `请求失败（${submitRes.status}）`)
      }

      // webHook = -1 预期返回 { code:0, data:{ id } }
      const jobId = submitJson?.data?.id || submitJson?.id
      if (!jobId) {
        throw new Error(submitJson?.msg || '未获取到任务 id，请检查接口返回')
      }

      setJob({
        id: jobId,
        results: [],
        progress: 0,
        status: 'running',
        failure_reason: '',
        error: '',
      })

      // 轮询结果
      while (!controller.signal.aborted) {
        await sleep(1200, controller.signal)

        const r = await fetch(`${base}/v1/draw/result`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ id: jobId }),
          signal: controller.signal,
        })

        const t = await r.text().catch(() => '')
        const j = safeJsonParse<any>(t)

        if (!r.ok) {
          throw new Error((j?.msg as string) || t || `请求失败（${r.status}）`)
        }

        const data = j?.data || j
        const next: NanoBananaJob = {
          id: data?.id || jobId,
          results: Array.isArray(data?.results) ? data.results : [],
          progress: typeof data?.progress === 'number' ? data.progress : 0,
          status: (data?.status as any) || 'running',
          failure_reason: data?.failure_reason || '',
          error: data?.error || '',
        }

        setJob(next)

        if (next.status === 'succeeded') {
          setSubmitting(false)
          abortRef.current = null
          return
        }

        if (next.status === 'failed') {
          throw new Error(next.failure_reason || next.error || '生成失败')
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e?.message || '请求失败')
      setSubmitting(false)
      abortRef.current = null
    }
  }

  const progress = job?.progress ?? 0
  const status = job?.status

  return (
    <div className="space-y-6 h-full flex flex-col px-2 py-4 [&_*]:!font-sans">
      <style>{`
        [data-theme='pixel'] .nanobanana-override,
        [data-theme='pixel'] .nanobanana-override * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 0.875rem !important;
          line-height: 1.5 !important;
          letter-spacing: normal !important;
          border-radius: 0.75rem !important;
          border-width: 1px !important;
          box-shadow: none !important;
          text-transform: none !important;
        }
        [data-theme='pixel'] .nanobanana-override button {
          border-radius: 0.5rem !important;
          padding: 0.5rem 1rem !important;
          font-size: 0.875rem !important;
        }
        [data-theme='pixel'] .nanobanana-override input,
        [data-theme='pixel'] .nanobanana-override select,
        [data-theme='pixel'] .nanobanana-override textarea {
          font-size: 0.875rem !important;
          line-height: 1.5 !important;
          padding: 0.5rem 0.75rem !important;
          height: auto !important;
        }
        [data-theme='pixel'] .nanobanana-override select {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          background-color: hsl(var(--background)) !important;
        }
        
        /* 超强优先级覆盖：针对像素风主题的 select option */
        body[data-theme='pixel'] .nanobanana-override select option,
        body[data-theme='pixel'] select.nanobanana-select option,
        [data-theme='pixel'] .nanobanana-override select option,
        [data-theme='pixel'] select.nanobanana-select option,
        html[data-theme='pixel'] .nanobanana-override select option,
        html[data-theme='pixel'] select.nanobanana-select option {
          all: initial !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 14px !important;
          font-weight: 400 !important;
          line-height: 1.8 !important;
          padding: 6px 12px !important;
          margin: 0 !important;
          height: auto !important;
          min-height: 32px !important;
          max-height: none !important;
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #1f2937 !important;
          display: block !important;
          width: 100% !important;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
          word-wrap: break-word !important;
          border: none !important;
          outline: none !important;
          box-sizing: border-box !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
          text-shadow: none !important;
        }
        
        /* option hover 状态 */
        body[data-theme='pixel'] .nanobanana-override select option:hover,
        body[data-theme='pixel'] select.nanobanana-select option:hover,
        [data-theme='pixel'] .nanobanana-override select option:hover,
        [data-theme='pixel'] select.nanobanana-select option:hover {
          background-color: #f3f4f6 !important;
          background: #f3f4f6 !important;
          color: #1f2937 !important;
        }
        
        .nanobanana-override h2 {
          font-size: 1.5rem !important;
        }
      `}</style>
      <div className="nanobanana-override flex items-center justify-between gap-4 flex-wrap px-2">

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            NanoBanana Pro 生图
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {submitting ? (
            <Button variant="destructive" size="sm" onClick={stop} className="shadow-lg">
              <Square className="w-4 h-4 mr-2" />
              停止
            </Button>
          ) : (
            <Button size="sm" onClick={submitAndPoll} className="shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
              <Sparkles className="w-4 h-4 mr-2" />
              生成
            </Button>
          )}
        </div>
      </div>

      <div className="nanobanana-override grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 px-2">


        {/* 左：表单 */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <div className="glass-card p-5 rounded-xl space-y-4 shadow-sm border-2">

            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              鉴权与接口
            </div>


            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">API Key（Bearer）</div>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="apikey"
                className="bg-muted/10"
              />
              <div className="text-[11px] text-muted-foreground">
                将用于请求头：<span className="font-mono">Authorization: Bearer apikey</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Base URL</div>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
                className="bg-muted/10 font-mono"
              />
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl space-y-4 shadow-sm border-2">
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              生成参数
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">模型（model）</div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as NanoBananaModel)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-background text-foreground">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">输出比例（aspectRatio）</div>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="nanobanana-select w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r.id} value={r.id} className="bg-background text-foreground">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {showImageSize ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">分辨率（imageSize）</div>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value as ImageSize)}
                    className="nanobanana-select w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {imageSizeOptions.map((s) => (
                      <option key={s} value={s} className="bg-background text-foreground">
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-muted-foreground">分辨率越高，生成时间越长；不同模型可选项不同。</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">分辨率（imageSize）</div>
                  <div className="h-9 rounded-md border border-border bg-muted/10 px-3 text-sm flex items-center text-muted-foreground">
                    当前模型不支持（仅 Pro 系列支持）
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">提示词（prompt）</div>
              <textarea
                className={cn(
                  'w-full min-h-[140px] bg-muted/10 border border-border rounded-lg p-3 text-sm resize-y focus:outline-none focus:border-primary/50 transition-colors',
                  submitting && 'opacity-70'
                )}
                placeholder="例如：一只可爱的猫咪在草地上玩耍"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">参考图（支持多张上传或粘贴 URL）</div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-7 px-2 text-[11px]"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3 mr-1" />
                    )}
                    上传
                  </Button>
                </div>
              </div>

              {referenceUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-2">
                  {referenceUrls.map((url, i) => (
                    <div key={i} className="group relative aspect-square rounded-lg border-2 border-border bg-background overflow-hidden hover:border-primary/50 transition-colors">
                      <img src={url} alt="ref" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeUrl(url)}
                        className="absolute top-1 right-1 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:scale-110"
                        title="移除"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}


              <textarea
                className={cn(
                  'w-full min-h-[80px] bg-muted/10 border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-primary/50 transition-colors',
                  submitting && 'opacity-70'
                )}
                placeholder="直接粘贴图片 URL，多条用换行或逗号分隔"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
              />
            </div>



            {error ? (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div>
                采用轮询模式（<span className="font-mono">webHook = -1</span>）获取进度与结果
              </div>
              <div className="flex items-center gap-2">
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    请求中…
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* 右：进度与结果 */}
        <div className="space-y-4 min-h-0 flex flex-col">
          <div className="glass-card p-5 rounded-xl space-y-4 shadow-sm border-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                任务状态
              </div>

              {job?.id ? (
                <div className="text-xs text-muted-foreground font-mono">id: {job.id}</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">进度</span>
                <span className="text-foreground font-mono">{Math.max(0, Math.min(100, progress))}%</span>
              </div>
              <div className="h-2 rounded bg-muted/30 overflow-hidden border border-border">
                <div
                  className={cn(
                    'h-full bg-primary transition-all',
                    status === 'failed' && 'bg-red-400',
                    status === 'succeeded' && 'bg-emerald-400'
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">状态</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded border text-[11px] font-medium',
                    status === 'running' && 'border-primary/30 bg-primary/10 text-primary',
                    status === 'succeeded' && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
                    status === 'failed' && 'border-red-400/30 bg-red-400/10 text-red-400'
                  )}
                >
                  {status || '—'}
                </span>
              </div>

              {job?.failure_reason || job?.error ? (
                <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                  {job.failure_reason ? `failure_reason: ${job.failure_reason}` : null}
                  {job.failure_reason && job.error ? <div className="h-1" /> : null}
                  {job.error ? `error: ${job.error}` : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl flex-1 min-h-0 overflow-hidden flex flex-col shadow-sm border-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30">
                <ImageIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-bold text-foreground">生成结果</div>
            </div>


            {!job ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                还没有生成记录，填写参数后点击"生成"
              </div>
            ) : job.results.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {submitting ? '生成中…（等待结果返回）' : '暂无结果'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="grid grid-cols-1 gap-4">
                  {job.results.map((r, idx) => (
                    <div key={`${r.url}-${idx}`} className="rounded-xl border border-border bg-gradient-to-br from-muted/5 to-muted/10 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="w-full bg-black/20 flex items-center justify-center overflow-hidden">
                        <img
                          src={r.url}
                          alt={r.content || `result-${idx + 1}`}
                          className="w-full h-auto object-contain max-h-[600px]"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="text-sm text-foreground/80 leading-relaxed">{r.content || '—'}</div>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <a
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            在新窗口打开
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => useAsReference(r.url)}
                            className="h-8 text-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            作为参考图
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
