import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Loader2, Square, ExternalLink, Sparkles, Upload, RotateCcw, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'


type NanoBananaModel =
  | 'gpt-image-2'
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
  | '9:21'
  | '1:3'
  | '3:1'
  | '2:1'
  | '1:2'

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

type HistoryItem = {
  id: string
  user_id: string
  prompt: string
  model: string
  aspect_ratio: string | null
  image_url: string
  original_url: string | null
  created_at: string
}

const LS_API_KEY = 'nanobanana:apiKey'
const LS_BASE_URL = 'nanobanana:baseUrl'

const DEFAULT_BASE_URL = 'https://grsai.dakka.com.cn'

const HISTORY_PAGE_SIZE = 12

const MODELS: Array<{ id: NanoBananaModel; label: string }> = [
  { id: 'gpt-image-2', label: 'gpt-image-2' },
  { id: 'nano-banana-fast', label: 'nano-banana-fast' },
  { id: 'nano-banana', label: 'nano-banana' },
  { id: 'nano-banana-pro', label: 'nano-banana-pro' },
  { id: 'nano-banana-pro-vt', label: 'nano-banana-pro-vt' },
  { id: 'nano-banana-pro-cl', label: 'nano-banana-pro-cl' },
  { id: 'nano-banana-pro-vip', label: 'nano-banana-pro-vip' },
  { id: 'nano-banana-pro-4k-vip', label: 'nano-banana-pro-4k-vip' },
]

const ASPECT_RATIOS: Array<{ id: AspectRatio; label: string }> = [
  { id: 'auto', label: 'auto' },
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
  { id: '9:21', label: '9:21' },
  { id: '1:3', label: '1:3' },
  { id: '3:1', label: '3:1' },
  { id: '2:1', label: '2:1' },
  { id: '1:2', label: '1:2' },
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

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export const NanoBananaTool: React.FC = () => {
  const { user } = useAuthStore()

  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)

  const [model, setModel] = useState<NanoBananaModel>('gpt-image-2')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto')
  const [imageSize, setImageSize] = useState<ImageSize>('1K')
  const [numImages, setNumImages] = useState(2)
  const [urlsText, setUrlsText] = useState('')
  const [uploading, setUploading] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [job, setJob] = useState<NanoBananaJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History state
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [persistingUrls, setPersistingUrls] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const imageSizeOptions = useMemo(() => getImageSizeOptions(model), [model])
  const showImageSize = imageSizeOptions.length > 0
  const totalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))

  // ── History loading ──
  const loadHistory = useCallback(async (page: number) => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const { count } = await supabase
        .from('nanobanana_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      setHistoryTotal(count ?? 0)

      const from = page * HISTORY_PAGE_SIZE
      const to = from + HISTORY_PAGE_SIZE - 1
      const { data } = await supabase
        .from('nanobanana_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      setHistoryItems((data as HistoryItem[]) || [])
      setHistoryPage(page)
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [user])

  // ── Persist results to permanent storage ──
  const persistResults = useCallback(async (
    results: NanoBananaResultItem[],
    promptText: string,
    modelId: string,
    ratio: string
  ) => {
    if (!user || results.length === 0) return
    setPersistingUrls(true)
    try {
      for (const item of results) {
        try {
          const resp = await fetch(item.url)
          if (!resp.ok) continue
          const blob = await resp.blob()
          const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
          const path = `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

          const { error: upErr } = await supabase.storage
            .from('nanobanana_results')
            .upload(path, blob, { cacheControl: '31536000', upsert: false })
          if (upErr) continue

          const { data: { publicUrl } } = supabase.storage
            .from('nanobanana_results')
            .getPublicUrl(path)

          await supabase.from('nanobanana_history').insert({
            user_id: user.id,
            prompt: promptText,
            model: modelId,
            aspect_ratio: ratio,
            image_url: publicUrl,
            original_url: item.url,
          })
        } catch {
          // skip individual failures
        }
      }
      loadHistory(0)
    } finally {
      setPersistingUrls(false)
    }
  }, [user, loadHistory])

  useEffect(() => {
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

  // Load history on mount
  useEffect(() => {
    if (user) loadHistory(0)
  }, [user, loadHistory])

  useEffect(() => {
    if (!showImageSize) return
    if (imageSizeOptions.includes(imageSize)) return
    setImageSize(imageSizeOptions[0] || '1K')
  }, [model, showImageSize, imageSize, imageSizeOptions])

  // Lightbox ESC handler
  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        setUploading(true)
        setError(null)
        try {
          const fileExt = item.type.split('/')[1] || 'png'
          const fileName = `paste-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
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
          setError(`粘贴上传失败: ${err.message}`)
        } finally {
          setUploading(false)
        }
        break
      }
    }
  }

  const addReferenceUrl = (url: string) => {
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
      setError('请填写 API Key')
      return
    }
    if (!p) {
      setError('请填写提示词')
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

      const tasks: Promise<any>[] = []
      for (let i = 0; i < numImages; i++) {
        const body: any = {
          model,
          prompt: p,
          aspectRatio,
          webHook: '-1',
          shutProgress: false,
        }

        if (urls.length > 0) body.urls = urls
        if (showImageSize) body.imageSize = imageSize

        const drawEndpoint = model === 'gpt-image-2' ? '/v1/draw/completions' : '/v1/draw/nano-banana'

        tasks.push(
          fetch(`${base}${drawEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          }).then(res => res.text()).then(text => safeJsonParse<any>(text))
        )
      }

      const submitResults = await Promise.all(tasks)
      
      const jobIds: string[] = []
      for (const result of submitResults) {
        if (!result) throw new Error('API返回格式错误')
        const jobId = result?.data?.id || result?.id
        if (!jobId) throw new Error(result?.msg || '未获取到任务 id')
        jobIds.push(jobId)
      }

      setJob({
        id: jobIds.join(','),
        results: [],
        progress: 0,
        status: 'running',
        failure_reason: '',
        error: '',
      })

      const allResults: NanoBananaResultItem[] = []
      let completedCount = 0
      const jobStatuses = new Map<string, string>()

      while (!controller.signal.aborted && completedCount < jobIds.length) {
        await sleep(1200, controller.signal)

        const pollPromises = jobIds.map(jobId => 
          fetch(`${base}/v1/draw/result`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ id: jobId }),
            signal: controller.signal,
          }).then(r => r.text()).then(t => ({ jobId, data: safeJsonParse<any>(t) }))
        )

        const pollResults = await Promise.all(pollPromises)

        let totalProgress = 0
        completedCount = 0

        for (const { jobId, data } of pollResults) {
          if (!data) continue

          const result = data?.data || data
          const status = (result?.status as string) || 'running'
          const progress = typeof result?.progress === 'number' ? result.progress : 0
          
          jobStatuses.set(jobId, status)
          totalProgress += progress

          if (status === 'succeeded') {
            completedCount++
            const items = Array.isArray(result?.results) ? result.results : []
            for (const item of items) {
              if (!allResults.find(r => r.url === item.url)) {
                allResults.push(item)
              }
            }
          } else if (status === 'failed') {
            throw new Error(result?.failure_reason || result?.error || '生成失败')
          }
        }

        const avgProgress = Math.floor(totalProgress / jobIds.length)
        setJob({
          id: jobIds.join(','),
          results: allResults,
          progress: avgProgress,
          status: completedCount === jobIds.length ? 'succeeded' : 'running',
          failure_reason: '',
          error: '',
        })
      }

      setSubmitting(false)
      abortRef.current = null

      // Persist results in background
      if (allResults.length > 0) {
        persistResults(allResults, p, model, aspectRatio)
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
    <div className="space-y-6 px-2 py-4 overflow-y-auto [&_*]:!font-sans">
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

      {/* Header */}
      <div className="nanobanana-override flex items-center justify-between gap-4 flex-wrap px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI 生图
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {persistingUrls && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              保存中...
            </span>
          )}
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

      {/* Two-column: Form + Results */}
      <div className="nanobanana-override grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px] px-2">

        {/* Left: Form */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <div className="glass-card p-5 rounded-xl space-y-4 shadow-sm border-2">

            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full"></div>
              API 设置
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">API Key</div>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="apikey"
                className="bg-muted/10"
              />
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
              参数
            </div>

            <div className={cn('grid gap-3', showImageSize ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3')}>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">模型</div>
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
                <div className="text-xs text-muted-foreground">比例</div>
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

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">数量</div>
                <select
                  value={numImages}
                  onChange={(e) => setNumImages(Number(e.target.value))}
                  className="nanobanana-select w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value={1}>1 张</option>
                  <option value={2}>2 张</option>
                  <option value={3}>3 张</option>
                  <option value={4}>4 张</option>
                  <option value={5}>5 张</option>
                </select>
              </div>

              {showImageSize && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">分辨率</div>
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
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">提示词</div>
              <textarea
                className={cn(
                  'w-full min-h-[120px] bg-muted/10 border border-border rounded-lg p-3 text-sm resize-y focus:outline-none focus:border-primary/50 transition-colors',
                  submitting && 'opacity-70'
                )}
                placeholder="描述你想要生成的图片"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">参考图</div>
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
                  'w-full min-h-[60px] bg-muted/10 border border-border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-primary/50 transition-colors',
                  submitting && 'opacity-70'
                )}
                placeholder="粘贴图片 URL"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                onPaste={handlePaste}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Status + Results */}
        <div className="space-y-4 min-h-0 flex flex-col">
          <div className="glass-card p-5 rounded-xl space-y-3 shadow-sm border-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full"></div>
                任务状态
              </div>
              {job?.id ? (
                <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">id: {job.id}</div>
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
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30">
                <ImageIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-bold text-foreground">生成结果</div>
            </div>

            {!job ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                暂无结果
              </div>
            ) : job.results.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {submitting ? '生成中...' : '暂无结果'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="grid grid-cols-1 gap-4">
                  {job.results.map((r, idx) => (
                    <div key={`${r.url}-${idx}`} className="rounded-xl border border-border bg-gradient-to-br from-muted/5 to-muted/10 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="w-full bg-black/20 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(r.url)}>
                        <img
                          src={r.url}
                          alt={r.content || `result-${idx + 1}`}
                          className="w-full h-auto object-contain max-h-[600px]"
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        {r.content && <div className="text-sm text-foreground/80 leading-relaxed">{r.content}</div>}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <a
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            打开
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addReferenceUrl(r.url)}
                            className="h-7 text-xs"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
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

      {/* History Section */}
      {user && (
        <div className="nanobanana-override px-2 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm font-bold text-foreground">生成历史</div>
            {historyTotal > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground">
                {historyTotal}
              </span>
            )}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">暂无历史记录</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-border bg-gradient-to-br from-muted/5 to-muted/10 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => setLightboxUrl(item.image_url)}
                  >
                    <div className="aspect-square bg-black/10 overflow-hidden">
                      <img src={item.image_url} alt={item.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs text-foreground/80 truncate">{item.prompt}</div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{item.model}</span>
                        <span>{formatTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage === 0}
                    onClick={() => loadHistory(historyPage - 1)}
                    className="h-8"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    上一页
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {historyPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= totalPages - 1}
                    onClick={() => loadHistory(historyPage + 1)}
                    className="h-8"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
