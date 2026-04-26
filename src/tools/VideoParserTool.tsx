import React, { useMemo, useRef, useState } from 'react'
import { Clapperboard, Copy, ExternalLink, Image as ImageIcon, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { parseVideoLink, type VideoParseResult } from '../lib/runtimeConfig'
import { cn } from '../lib/utils'

type ParseState = 'idle' | 'loading' | 'success' | 'error'

type CopyState = {
  key: string
  active: boolean
}

const EMPTY_RESULT: VideoParseResult = {
  type: 'UNKNOWN',
  title: '',
  cover: '',
  url: '',
  imageList: [],
  sourceUrl: '',
}

export const VideoParserTool: React.FC = () => {
  const [link, setLink] = useState('')
  const [result, setResult] = useState<VideoParseResult | null>(null)
  const [status, setStatus] = useState<ParseState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>({ key: '', active: false })
  const controllerRef = useRef<AbortController | null>(null)

  const normalizedResult = result || EMPTY_RESULT
  const isVideo = normalizedResult.type === 'VIDEO' && !!normalizedResult.url
  const isImageAlbum = normalizedResult.type === 'IMAGE' || normalizedResult.imageList.length > 0
  const hasResult = !!result

  const statusMeta = useMemo(() => {
    if (status === 'loading') return { label: '解析中', tone: 'text-sky-300', text: '正在调用解析服务，通常几秒内返回。' }
    if (status === 'error') return { label: '失败', tone: 'text-red-300', text: error || '解析失败，请检查链接或配置。' }
    if (status === 'success') return { label: '完成', tone: 'text-emerald-300', text: isVideo ? '已拿到视频直链，可直接预览和复制。' : '已拿到图集结果，可逐张查看与打开。' }
    return { label: '待命', tone: 'text-muted-foreground', text: '支持短链和原始链接，解析结果会以卡片方式展示。' }
  }, [error, isVideo, status])

  const withCopyFeedback = async (key: string, value: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopyState({ key, active: true })
    window.setTimeout(() => setCopyState((prev) => (prev.key === key ? { key: '', active: false } : prev)), 1200)
  }

  const handleParse = async () => {
    const target = link.trim()
    if (!target) {
      setStatus('error')
      setError('请先输入要解析的视频或图集链接。')
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus('loading')
    setError(null)

    try {
      const parsed = await parseVideoLink(target, controller.signal)
      setResult({ ...parsed, sourceUrl: parsed.sourceUrl || target })
      setStatus('success')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setStatus('error')
      setError(e?.message || '解析失败，请稍后重试。')
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-3xl border border-border p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-foreground">
              <Clapperboard className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold italic">视频链接解析</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">输入短链或原始链接后，自动识别视频/图集类型，并给出封面、标题与可操作的媒体地址。</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 min-w-[220px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">当前状态</div>
            <div className={cn('mt-2 text-sm font-semibold', statusMeta.tone)}>{statusMeta.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{statusMeta.text}</div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="粘贴短链、B 站链接或其它平台分享地址" className="h-11 bg-muted/20 flex-1 min-w-[260px]" />
          <Button onClick={() => void handleParse()} disabled={status === 'loading'} className="h-11 px-5">
            {status === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            {status === 'loading' ? '解析中…' : '开始解析'}
          </Button>
          <Button variant="outline" onClick={() => setLink('')} className="h-11" disabled={status === 'loading'}>
            清空
          </Button>
        </div>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div> : null}
      </div>

      {hasResult ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-5">
          <div className="glass-card rounded-3xl border border-border overflow-hidden">
            <div className="aspect-video bg-black/40 border-b border-border overflow-hidden">
              {normalizedResult.cover ? <img src={normalizedResult.cover} alt={normalizedResult.title || 'cover'} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="w-8 h-8" /></div>}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[11px] px-2 py-1 rounded-full border', isVideo ? 'border-sky-400/20 text-sky-300 bg-sky-500/10' : 'border-violet-400/20 text-violet-300 bg-violet-500/10')}>{normalizedResult.type || 'UNKNOWN'}</span>
                    <span className="text-xs text-muted-foreground">解析结果</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-foreground break-all">{normalizedResult.title || '未返回标题'}</h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => void withCopyFeedback('source', normalizedResult.sourceUrl || link.trim())}>
                    <Copy className="w-4 h-4 mr-2" />
                    {copyState.key === 'source' && copyState.active ? '已复制原链' : '复制原链'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(normalizedResult.sourceUrl || link.trim(), '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="w-4 h-4 mr-2" />打开原链
                  </Button>
                </div>
              </div>

              {isVideo ? (
                <div className="space-y-3">
                  <video src={normalizedResult.url} controls className="w-full rounded-2xl border border-border bg-black" preload="metadata" />
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => void withCopyFeedback('video', normalizedResult.url)}>
                      <Copy className="w-4 h-4 mr-2" />
                      {copyState.key === 'video' && copyState.active ? '已复制视频地址' : '复制视频地址'}
                    </Button>
                    <Button variant="outline" onClick={() => window.open(normalizedResult.url, '_blank', 'noopener,noreferrer')}>
                      <ExternalLink className="w-4 h-4 mr-2" />打开媒体
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-background/20 px-4 py-4 text-sm text-muted-foreground">
                  当前结果不是视频直链，将在右侧展示图集列表或其它媒体信息。
                </div>
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">媒体列表</div>
                <div className="text-xs text-muted-foreground mt-1">视频支持快捷复制；图集支持逐张预览、复制和打开。</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setResult(null); setStatus('idle'); setError(null) }}>
                <Trash2 className="w-4 h-4 mr-2" />清空结果
              </Button>
            </div>

            {isImageAlbum ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {normalizedResult.imageList.map((imageUrl, index) => (
                  <div key={`${imageUrl}-${index}`} className="rounded-2xl border border-border overflow-hidden bg-background/20">
                    <div className="aspect-square bg-black/30 overflow-hidden">
                      <img src={imageUrl} alt={`image-${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-xs text-muted-foreground">第 {index + 1} 张</div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => void withCopyFeedback(`image-${index}`, imageUrl)}>
                          <Copy className="w-4 h-4 mr-1" />{copyState.key === `image-${index}` && copyState.active ? '已复制' : '复制'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(imageUrl, '_blank', 'noopener,noreferrer')}>
                          <ExternalLink className="w-4 h-4 mr-1" />打开
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isVideo ? (
              <div className="rounded-2xl border border-border bg-background/20 px-4 py-4 text-sm text-muted-foreground">当前为视频结果，主卡片里已经提供预览和操作按钮。</div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/20 px-4 py-4 text-sm text-muted-foreground">接口返回了非视频/图集结果，暂未提供更多媒体项。</div>
            )}

            <div className="rounded-2xl border border-border bg-background/20 px-4 py-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">快捷操作</div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => void handleParse()} disabled={status === 'loading'}>
                  <RefreshCw className={cn('w-4 h-4 mr-2', status === 'loading' && 'animate-spin')} />重新解析
                </Button>
                {normalizedResult.cover ? (
                  <Button variant="outline" size="sm" onClick={() => void withCopyFeedback('cover', normalizedResult.cover)}>
                    <Copy className="w-4 h-4 mr-2" />{copyState.key === 'cover' && copyState.active ? '已复制封面' : '复制封面'}
                  </Button>
                ) : null}
                {normalizedResult.cover ? (
                  <Button variant="outline" size="sm" onClick={() => window.open(normalizedResult.cover, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="w-4 h-4 mr-2" />打开封面
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-border p-8 text-center text-muted-foreground">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Clapperboard className="w-7 h-7" />
          </div>
          <div className="text-lg font-semibold text-foreground">等待解析结果</div>
          <p className="mt-2 text-sm">输入分享链接后即可看到封面、标题、视频地址或图集列表，整个过程会给出清晰状态反馈。</p>
        </div>
      )}
    </div>
  )
}
