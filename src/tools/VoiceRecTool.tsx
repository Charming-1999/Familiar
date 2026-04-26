import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Upload, Link2, Copy, Check, Loader2, Square, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../components/Button'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { submitAsrTask, queryAsrResult } from '../lib/runtimeConfig'
import type { AsrSubmitOptions, AsrQueryResult, AsrUtterance } from '../lib/runtimeConfig'

const VIDEO_MIME_PREFIXES = ['video/']
const ACCEPTED_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'amr', 'mp4', 'mov', 'webm', 'avi', 'mkv']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'amr']

const LANGUAGES = [
  { value: '', label: '自动检测' },
  { value: 'zh-CN', label: '中文普通话' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'yue-CN', label: '粤语' },
  { value: 'de-DE', label: '德语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'es-MX', label: '西班牙语' },
  { value: 'pt-BR', label: '葡萄牙语' },
  { value: 'ru-RU', label: '俄语' },
  { value: 'id-ID', label: '印尼语' },
  { value: 'th-TH', label: '泰语' },
  { value: 'vi-VN', label: '越南语' },
  { value: 'ar-SA', label: '阿拉伯语' },
  { value: 'it-IT', label: '意大利语' },
  { value: 'tr-TR', label: '土耳其语' },
  { value: 'ms-MY', label: '马来语' },
  { value: 'fil-PH', label: '菲律宾语' },
  { value: 'nl-NL', label: '荷兰语' },
  { value: 'pl-PL', label: '波兰语' },
]

const FORMAT_OPTIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'amr']

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function isVideoFile(file: File): boolean {
  return VIDEO_MIME_PREFIXES.some((p) => file.type.startsWith(p))
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}

type Status = 'idle' | 'extracting' | 'uploading' | 'submitting' | 'polling' | 'success' | 'error'

export const VoiceRecTool: React.FC = () => {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const isLoggedIn = !!user
  const isActivated = !!profile?.is_activated

  // Input
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [fileName, setFileName] = useState('')
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)

  // FFmpeg
  const [ffmpegStatus, setFfmpegStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const ffmpegRef = useRef<any>(null)

  // Options
  const [language, setLanguage] = useState('')
  const [enableItn, setEnableItn] = useState(true)
  const [enablePunc, setEnablePunc] = useState(true)
  const [enableDdc, setEnableDdc] = useState(false)
  const [enableSpeakerInfo, setEnableSpeakerInfo] = useState(false)
  const [enableEmotionDetection, setEnableEmotionDetection] = useState(false)
  const [enableGenderDetection, setEnableGenderDetection] = useState(false)
  const [enableLid, setEnableLid] = useState(false)
  const [showUtterances, setShowUtterances] = useState(true)
  const [showSpeechRate, setShowSpeechRate] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // Task
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)

  // Result
  const [result, setResult] = useState<AsrQueryResult['result'] | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    }
  }, [audioPreviewUrl])

  const cleanupStorageFile = useCallback(async (path: string | null) => {
    if (!path) return
    try {
      await supabase.storage.from('asr_uploads').remove([path])
    } catch { /* ignore */ }
  }, [])

  const resetInput = useCallback(() => {
    setAudioUrl('')
    setFileName('')
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioPreviewUrl(null)
    if (uploadedFilePath) cleanupStorageFile(uploadedFilePath)
    setUploadedFilePath(null)
    setAudioFormat('mp3')
  }, [audioPreviewUrl, uploadedFilePath, cleanupStorageFile])

  const resetAll = useCallback(() => {
    abortRef.current?.abort()
    resetInput()
    setStatus('idle')
    setError(null)
    setRequestId(null)
    setPollCount(0)
    setResult(null)
    setCopied(false)
    setShowDetail(false)
  }, [resetInput])

  // Load FFmpeg lazily
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    setFfmpegStatus('loading')
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const ffmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpegRef.current = ffmpeg
      setFfmpegStatus('ready')
      return ffmpeg
    } catch (err) {
      setFfmpegStatus('idle')
      throw new Error(`FFmpeg 加载失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [])

  // Extract audio from video
  const extractAudioFromVideo = useCallback(async (videoFile: File): Promise<Blob> => {
    const ffmpeg = await loadFFmpeg()
    const { fetchFile } = await import('@ffmpeg/util')
    await ffmpeg.writeFile('input', await fetchFile(videoFile))
    await ffmpeg.exec(['-i', 'input', '-q:a', '0', '-map', 'a', 'output.mp3'])
    const data = await ffmpeg.readFile('output.mp3')
    await ffmpeg.deleteFile('input')
    await ffmpeg.deleteFile('output.mp3')
    return new Blob([data], { type: 'audio/mpeg' })
  }, [loadFFmpeg])

  // Upload to Supabase Storage and get signed URL
  const uploadToStorage = useCallback(async (blob: Blob, ext: string): Promise<{ signedUrl: string; filePath: string }> => {
    const userId = user?.id || 'anonymous'
    const randomId = Math.random().toString(36).slice(2, 10)
    const filePath = `uploads/${userId}/${Date.now()}-${randomId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('asr_uploads')
      .upload(filePath, blob, { cacheControl: '3600', upsert: false })

    if (uploadError) throw new Error(`上传失败: ${uploadError.message}`)

    const { data, error: signError } = await supabase.storage
      .from('asr_uploads')
      .createSignedUrl(filePath, 3600)

    if (signError || !data?.signedUrl) throw new Error(`生成签名 URL 失败: ${signError?.message || 'unknown'}`)

    return { signedUrl: data.signedUrl, filePath }
  }, [user?.id])

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const ext = getExtension(file.name)
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`不支持的文件格式: .${ext}`)
      return
    }

    setError(null)
    setFileName(file.name)

    // Cleanup previous upload
    if (uploadedFilePath) {
      cleanupStorageFile(uploadedFilePath)
      setUploadedFilePath(null)
    }
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)

    try {
      let audioBlob: Blob
      let format: string

      if (isVideoFile(file) || !AUDIO_EXTENSIONS.includes(ext)) {
        // Video → extract audio
        setStatus('extracting')
        audioBlob = await extractAudioFromVideo(file)
        format = 'mp3'
      } else {
        audioBlob = file
        format = ext === 'm4a' ? 'aac' : ext
      }

      setAudioFormat(format)
      setAudioPreviewUrl(URL.createObjectURL(audioBlob))

      // Upload
      setStatus('uploading')
      const { signedUrl, filePath } = await uploadToStorage(audioBlob, format)
      setAudioUrl(signedUrl)
      setUploadedFilePath(filePath)
      setStatus('idle')
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : '文件处理失败')
    }
  }, [uploadedFilePath, audioPreviewUrl, cleanupStorageFile, extractAudioFromVideo, uploadToStorage])

  // Submit and poll
  const handleSubmit = useCallback(async () => {
    if (!audioUrl) { setError('请先上传音频文件或输入音频链接'); return }

    const controller = new AbortController()
    abortRef.current = controller

    setError(null)
    setResult(null)
    setRequestId(null)
    setPollCount(0)
    setCopied(false)
    setShowDetail(false)

    try {
      // Submit
      setStatus('submitting')
      const options: AsrSubmitOptions = {
        audioUrl,
        audioFormat,
        language: language || undefined,
        enableItn,
        enablePunc,
        enableDdc,
        enableSpeakerInfo,
        enableEmotionDetection,
        enableGenderDetection,
        enableLid,
        showUtterances,
        showSpeechRate,
        showVolume,
      }

      const { requestId: rid } = await submitAsrTask(options, controller.signal)
      setRequestId(rid)

      // Poll
      setStatus('polling')
      const maxPolls = 100
      for (let i = 0; i < maxPolls; i++) {
        await sleep(3000, controller.signal)
        setPollCount(i + 1)

        const queryResult = await queryAsrResult(rid, controller.signal)

        if (queryResult.status === 'completed') {
          setResult(queryResult.result || null)
          setStatus('success')
          // Cleanup storage
          if (uploadedFilePath) {
            cleanupStorageFile(uploadedFilePath)
            setUploadedFilePath(null)
          }
          return
        }

        if (queryResult.status === 'failed') {
          throw new Error(queryResult.error || '识别任务失败')
        }
        // running → continue
      }

      throw new Error('识别超时（5分钟），请检查音频文件或稍后重试')
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStatus('idle')
        return
      }
      setError(err instanceof Error ? err.message : '识别失败')
      setStatus('error')
    }
  }, [audioUrl, audioFormat, language, enableItn, enablePunc, enableDdc, enableSpeakerInfo, enableEmotionDetection, enableGenderDetection, enableLid, showUtterances, showSpeechRate, showVolume, uploadedFilePath, cleanupStorageFile])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const handleCopyText = useCallback(() => {
    const text = result?.text
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result?.text])

  const isWorking = status === 'extracting' || status === 'uploading' || status === 'submitting' || status === 'polling'
  const canSubmit = isLoggedIn && isActivated && !!audioUrl && !isWorking

  const plainText = result?.text || ''
  const utterances: AsrUtterance[] = result?.utterances || []

  // --- Render ---

  if (!isLoggedIn || !isActivated) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Mic className="w-12 h-12 opacity-30" />
        <p className="text-sm">请先登录并激活账户后使用语音识别。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">语音识别</h2>
          {status !== 'idle' && status !== 'success' && status !== 'error' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary animate-pulse">
              {status === 'extracting' && '提取音频中...'}
              {status === 'uploading' && '上传中...'}
              {status === 'submitting' && '提交任务中...'}
              {status === 'polling' && `识别中 (${pollCount})`}
            </span>
          )}
          {status === 'success' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">完成</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isWorking ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Square className="w-3 h-3 mr-1" /> 停止
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
              <Mic className="w-3 h-3 mr-1" /> 开始识别
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetAll}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-2 gap-4 pr-1 custom-scrollbar">
        {/* Left: Input + Options */}
        <div className="space-y-4">
          {/* Audio Input */}
          <div className="glass-card p-4 rounded-lg border-primary/5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">音频输入</h3>

            {/* Mode tabs */}
            <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
              <button
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setInputMode('file')}
              >
                <Upload className="w-3 h-3 inline mr-1" />上传文件
              </button>
              <button
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setInputMode('url')}
              >
                <Link2 className="w-3 h-3 inline mr-1" />粘贴链接
              </button>
            </div>

            {inputMode === 'file' ? (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isWorking}
                />
                {!fileName ? (
                  <button
                    className="w-full p-6 rounded-lg border-2 border-dashed border-border bg-muted/10 hover:border-primary/30 hover:bg-muted/20 transition-colors text-center"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isWorking}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">点击选择音频或视频文件</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">支持 mp3, wav, ogg, mp4, mov, webm 等</p>
                    {ffmpegStatus === 'loading' && (
                      <p className="text-xs text-primary mt-2 animate-pulse">FFmpeg 加载中...</p>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border">
                    <Mic className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{fileName}</span>
                    {(status === 'extracting' || status === 'uploading') && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                    )}
                    <button
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      onClick={resetInput}
                      disabled={isWorking}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {audioPreviewUrl && (
                  <audio controls src={audioPreviewUrl} className="w-full h-8" />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="输入音频文件 URL"
                  value={audioUrl}
                  onChange={(e) => {
                    setAudioUrl(e.target.value)
                    const ext = getExtension(e.target.value.split('?')[0])
                    if (FORMAT_OPTIONS.includes(ext)) setAudioFormat(ext)
                  }}
                  className="w-full bg-muted/20 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isWorking}
                />
              </div>
            )}

            {/* Format + Language */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">音频格式</label>
                <select
                  value={audioFormat}
                  onChange={(e) => setAudioFormat(e.target.value)}
                  className="w-full bg-muted/20 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isWorking}
                >
                  {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">识别语言</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-muted/20 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isWorking}
                >
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="glass-card p-4 rounded-lg border-primary/5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">高级选项</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {([
                [enableItn, setEnableItn, '文本规整化 (ITN)', '数字/日期等规范化'] as const,
                [enablePunc, setEnablePunc, '自动标点', '添加标点符号'] as const,
                [enableDdc, setEnableDdc, '顺滑处理', '去除口语填充词'] as const,
                [enableSpeakerInfo, setEnableSpeakerInfo, '说话人识别', '区分不同说话人'] as const,
                [enableEmotionDetection, setEnableEmotionDetection, '情绪检测', '标注情绪标签'] as const,
                [enableGenderDetection, setEnableGenderDetection, '性别检测', '标注性别标签'] as const,
                [enableLid, setEnableLid, '语种识别', '识别语言种类'] as const,
                [showUtterances, setShowUtterances, '句级详情', '句/词级时间戳'] as const,
                [showSpeechRate, setShowSpeechRate, '语速信息', '每句语速'] as const,
                [showVolume, setShowVolume, '音量信息', '每句音量'] as const,
              ] as const).map(([val, setter, label, desc]) => (
                <label key={label} className="flex items-start gap-2 cursor-pointer group" title={desc}>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setter(e.target.checked)}
                    className="mt-0.5 accent-primary"
                    disabled={isWorking}
                  />
                  <span className="text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                    {label}
                    <span className="block text-[10px] text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {status === 'polling' && (
            <div className="glass-card p-4 rounded-lg border-primary/5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                识别进行中
              </h3>
              {requestId && (
                <p className="text-xs text-muted-foreground font-mono truncate">Task: {requestId}</p>
              )}
              <p className="text-xs text-muted-foreground">已轮询 {pollCount} 次，每 3 秒查询一次...</p>
              <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${Math.min(100, pollCount)}%` }}
                />
              </div>
            </div>
          )}

          {status === 'success' && result && (
            <>
              {/* Full text */}
              <div className="glass-card p-4 rounded-lg border-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">识别结果</h3>
                  <Button variant="ghost" size="sm" onClick={handleCopyText} disabled={!plainText}>
                    {copied ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-[300px] overflow-auto custom-scrollbar leading-relaxed">
                  {plainText || '(无识别文本)'}
                </div>
              </div>

              {/* Utterance detail */}
              {utterances.length > 0 && (
                <div className="glass-card p-4 rounded-lg border-primary/5 space-y-2">
                  <button
                    className="flex items-center justify-between w-full text-sm font-semibold text-foreground"
                    onClick={() => setShowDetail(!showDetail)}
                  >
                    <span>分句详情 ({utterances.length} 句)</span>
                    {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showDetail && (
                    <div className="space-y-2 max-h-[400px] overflow-auto custom-scrollbar">
                      {utterances.map((u, i) => (
                        <div key={i} className="bg-muted/10 rounded-lg p-2.5 text-xs space-y-1 border border-border/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground font-mono">
                              {formatTime(u.start_time)} - {formatTime(u.end_time)}
                            </span>
                            {u.speaker && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">
                                {u.speaker}
                              </span>
                            )}
                            {u.emotion && u.emotion !== 'neutral' && (
                              <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px]">
                                {u.emotion}
                              </span>
                            )}
                            {u.gender && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">
                                {u.gender === 'male' ? '男' : '女'}
                              </span>
                            )}
                            {u.speech_rate != null && (
                              <span className="text-muted-foreground">{u.speech_rate.toFixed(1)} 字/秒</span>
                            )}
                            {u.volume != null && (
                              <span className="text-muted-foreground">{u.volume.toFixed(1)} dB</span>
                            )}
                          </div>
                          <p className="text-foreground leading-relaxed">{u.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {status !== 'polling' && !result && (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground/50">
              <Mic className="w-16 h-16 mb-3 opacity-20" />
              <p className="text-sm">上传音频/视频文件或粘贴链接</p>
              <p className="text-xs mt-1">支持说话人分离、情绪检测等高级功能</p>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="glass-card p-3 rounded-lg border-primary/10 flex-shrink-0">
        <p className="text-xs text-muted-foreground">
          支持音频格式: mp3, wav, ogg, flac, aac, m4a, opus, amr | 视频格式: mp4, mov, webm (自动提取音频) | 首次处理视频需加载 FFmpeg (~25MB)
        </p>
      </div>
    </div>
  )
}
