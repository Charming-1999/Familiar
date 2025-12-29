import React, { useState, useRef } from 'react'
import { Image as ImageIcon, Upload, Download, Copy, CheckCircle2, Maximize2, RefreshCw } from 'lucide-react'
import { Button } from '../components/Button'

type TabType = 'base64' | 'compress' | 'resize'

export const ImageTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('base64')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [base64Result, setBase64Result] = useState<string>('')
  const [copied, setCopied] = useState(false)
  
  // Resize state
  const [resizeWidth, setResizeWidth] = useState<number>(800)
  const [resizeHeight, setResizeHeight] = useState<number>(600)
  const [maintainAspect, setMaintainAspect] = useState(true)
  const [resizedImage, setResizedImage] = useState<string>('')
  
  // Compress state
  const [compressQuality, setCompressQuality] = useState<number>(80)
  const [compressedImage, setCompressedImage] = useState<string>('')
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [compressedSize, setCompressedSize] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    setImageFile(file)
    setOriginalSize(file.size)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImagePreview(result)
      setBase64Result(result)
    }
    reader.readAsDataURL(file)
  }

  const handleBase64ToImage = (base64: string) => {
    try {
      if (!base64.startsWith('data:image/')) {
        alert('请输入有效的 Base64 图片数据')
        return
      }
      setImagePreview(base64)
      setBase64Result(base64)
    } catch (err) {
      alert('Base64 解析失败')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleResize = () => {
    if (!imagePreview) {
      alert('请先上传图片')
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      let targetWidth = resizeWidth
      let targetHeight = resizeHeight

      if (maintainAspect) {
        const aspectRatio = img.width / img.height
        if (resizeWidth / resizeHeight > aspectRatio) {
          targetWidth = resizeHeight * aspectRatio
        } else {
          targetHeight = resizeWidth / aspectRatio
        }
      }

      canvas.width = targetWidth
      canvas.height = targetHeight
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

      const resized = canvas.toDataURL('image/png')
      setResizedImage(resized)
    }
    img.src = imagePreview
  }

  const handleCompress = () => {
    if (!imagePreview) {
      alert('请先上传图片')
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const compressed = canvas.toDataURL('image/jpeg', compressQuality / 100)
      setCompressedImage(compressed)
      
      // 估算压缩后大小
      const base64Length = compressed.split(',')[1].length
      const estimatedSize = (base64Length * 3) / 4
      setCompressedSize(Math.round(estimatedSize))
    }
    img.src = imagePreview
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold italic">图片工具集</h2>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('base64')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'base64'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Base64 转换
        </button>
        <button
          onClick={() => setActiveTab('resize')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'resize'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          尺寸调整
        </button>
        <button
          onClick={() => setActiveTab('compress')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'compress'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          图片压缩
        </button>
      </div>

      {/* 文件上传区域 */}
      <div className="p-6 rounded-lg border-2 border-dashed border-border bg-muted/10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-foreground mb-2">点击上传或拖拽图片到此处</p>
          <p className="text-xs text-muted-foreground mb-4">支持 JPG、PNG、GIF、WebP 等格式</p>
          <Button onClick={() => fileInputRef.current?.click()}>
            选择图片
          </Button>
        </div>
      </div>

      {/* Base64 转换 */}
      {activeTab === 'base64' && (
        <div className="space-y-4">
          {imagePreview && (
            <div className="p-4 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">图片预览</span>
                <span className="text-xs text-muted-foreground">
                  {imageFile?.name} ({formatSize(originalSize)})
                </span>
              </div>
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-auto rounded-lg border border-border"
                style={{ maxHeight: '300px' }}
              />
            </div>
          )}

          {base64Result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Base64 编码结果</span>
                <Button variant="outline" size="sm" onClick={() => handleCopy(base64Result)}>
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={base64Result}
                readOnly
                className="w-full h-32 p-3 rounded-lg border border-border bg-muted/20 font-mono text-xs resize-none"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">或粘贴 Base64 转换为图片</label>
            <textarea
              placeholder="粘贴 Base64 编码..."
              className="w-full h-24 p-3 rounded-lg border border-border bg-muted/20 font-mono text-xs resize-none"
              onChange={(e) => {
                const value = e.target.value.trim()
                if (value) handleBase64ToImage(value)
              }}
            />
          </div>
        </div>
      )}

      {/* 尺寸调整 */}
      {activeTab === 'resize' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">宽度 (px)</label>
              <input
                type="number"
                value={resizeWidth}
                onChange={(e) => setResizeWidth(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-muted/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">高度 (px)</label>
              <input
                type="number"
                value={resizeHeight}
                onChange={(e) => setResizeHeight(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-muted/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="maintain-aspect"
              checked={maintainAspect}
              onChange={(e) => setMaintainAspect(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="maintain-aspect" className="text-sm text-foreground cursor-pointer">
              保持宽高比
            </label>
          </div>

          <Button onClick={handleResize} disabled={!imagePreview} className="w-full">
            <Maximize2 className="w-4 h-4 mr-2" />
            调整尺寸
          </Button>

          {resizedImage && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg border border-border bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">调整后预览</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(resizedImage, 'resized-image.png')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                </div>
                <img
                  src={resizedImage}
                  alt="Resized"
                  className="max-w-full h-auto rounded-lg border border-border"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 图片压缩 */}
      {activeTab === 'compress' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">压缩质量</label>
              <span className="text-sm text-primary">{compressQuality}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={compressQuality}
              onChange={(e) => setCompressQuality(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              质量越低，文件越小，但画质会下降
            </p>
          </div>

          <Button onClick={handleCompress} disabled={!imagePreview} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            压缩图片
          </Button>

          {compressedImage && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg border border-border bg-primary/5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">原始大小：</span>
                    <span className="text-foreground font-medium ml-2">{formatSize(originalSize)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">压缩后：</span>
                    <span className="text-primary font-medium ml-2">{formatSize(compressedSize)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">压缩率：</span>
                    <span className="text-green-500 font-medium ml-2">
                      {((1 - compressedSize / originalSize) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">压缩后预览</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(compressedImage, 'compressed-image.jpg')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                </div>
                <img
                  src={compressedImage}
                  alt="Compressed"
                  className="max-w-full h-auto rounded-lg border border-border"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
