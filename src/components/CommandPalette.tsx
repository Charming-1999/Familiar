import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Command } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToolStore } from '../stores/useToolStore'
import { useShortcutStore } from '../stores/useShortcutStore'
import { getShortcutDisplayText } from '../lib/shortcuts'
import {
  Code2,
  Binary,
  Clock,
  Link2,
  ShieldCheck,
  Fingerprint,
  Search as SearchIcon,
  FileCode2,
  Terminal,
  NotebookPen,
  Bot,
  ListTodo,
  PanelsLeftRight,
  QrCode,
  BookOpen,
  Globe,
  FileText,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'

const iconMap: Record<string, any> = {
  json: Code2,
  base64: Binary,
  time: Clock,
  url: Link2,
  hash: ShieldCheck,
  jwt: Fingerprint,
  regex: SearchIcon,
  diff: FileCode2,
  monaco: FileCode2,
  linux: Terminal,
  notes: NotebookPen,
  chat: Bot,
  qrcode: QrCode,
  promptvault: BookOpen,
  sitevault: Globe,
  todolist: ListTodo,
  excalidraw: PanelsLeftRight,
  cron: Clock,
  markdown: FileText,
  image: ImageIcon,
  nanobanana: Sparkles,
}

type ToolItem = {
  id: string
  name: string
  icon: string
  path: string
  keywords: string[]
}

const TOOLS: ToolItem[] = [
  { id: 'json', name: 'JSON 编辑器', icon: 'json', path: '/tool/json', keywords: ['json', '编辑', 'editor'] },
  { id: 'base64', name: 'Base64 转换', icon: 'base64', path: '/tool/base64', keywords: ['base64', '转换', 'encode'] },
  { id: 'time', name: '时间戳转换', icon: 'time', path: '/tool/time', keywords: ['时间', 'timestamp', '转换'] },
  { id: 'url', name: 'URL 编解码', icon: 'url', path: '/tool/url', keywords: ['url', '编码', 'decode'] },
  { id: 'hash', name: '哈希计算', icon: 'hash', path: '/tool/hash', keywords: ['hash', 'md5', 'sha'] },
  { id: 'jwt', name: 'JWT 解码', icon: 'jwt', path: '/tool/jwt', keywords: ['jwt', 'token', '解码'] },
  { id: 'regex', name: '正则测试', icon: 'regex', path: '/tool/regex', keywords: ['正则', 'regex', '表达式'] },
  { id: 'diff', name: '文本对比', icon: 'diff', path: '/tool/diff', keywords: ['对比', 'diff', '比较'] },
  { id: 'linux', name: 'Linux 指令检索', icon: 'linux', path: '/tool/linux', keywords: ['linux', '命令', 'command'] },
  { id: 'notes', name: '随心记', icon: 'notes', path: '/tool/notes', keywords: ['笔记', 'note', '记录'] },
  { id: 'monaco', name: '代码编辑器', icon: 'monaco', path: '/tool/monaco', keywords: ['代码', 'editor', 'monaco'] },
  { id: 'excalidraw', name: 'Excalidraw 白板', icon: 'excalidraw', path: '/tool/excalidraw', keywords: ['白板', '画板', 'draw'] },
  { id: 'chat', name: '模型对话', icon: 'chat', path: '/tool/chat', keywords: ['对话', 'chat', 'ai'] },
  { id: 'qrcode', name: '二维码生成', icon: 'qrcode', path: '/tool/qrcode', keywords: ['二维码', 'qr', 'code'] },
  { id: 'promptvault', name: '提示词宝库', icon: 'promptvault', path: '/tool/promptvault', keywords: ['提示词', 'prompt', '宝库'] },
  { id: 'sitevault', name: '精选站点集', icon: 'sitevault', path: '/tool/sitevault', keywords: ['站点', 'site', '书签'] },
  { id: 'todolist', name: 'TodoList', icon: 'todolist', path: '/tool/todolist', keywords: ['todo', '待办', '任务'] },
  { id: 'cron', name: 'Cron 表达式生成器', icon: 'cron', path: '/tool/cron', keywords: ['cron', '定时', '表达式'] },
  { id: 'markdown', name: 'Markdown 编辑器', icon: 'markdown', path: '/tool/markdown', keywords: ['markdown', 'md', '编辑器'] },
  { id: 'image', name: '图片工具集', icon: 'image', path: '/tool/image', keywords: ['图片', 'image', '压缩'] },
  { id: 'nanobanana', name: 'NanoBanana 生图', icon: 'nanobanana', path: '/tool/nanobanana', keywords: ['生图', '绘画', 'nano', 'banana', 'pro', 'image'] },
]

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const { favorites } = useToolStore()
  const { getShortcutChecker } = useShortcutStore()

  const filteredTools = useMemo(() => {
    if (!query.trim()) {
      // 显示收藏的工具
      const favoriteTools = TOOLS.filter((t) => favorites.includes(t.id))
      return favoriteTools.length > 0 ? favoriteTools : TOOLS.slice(0, 8)
    }

    const q = query.toLowerCase()
    return TOOLS.filter((tool) => {
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.keywords.some((kw) => kw.includes(q))
      )
    }).slice(0, 8)
  }, [query, favorites])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 使用配置的快捷键检查命令面板
      const checkCommandPalette = getShortcutChecker('commandPalette')
      if (checkCommandPalette && checkCommandPalette(e)) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        return
      }

      if (!isOpen) return

      // Escape 关闭
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        setSelectedIndex(0)
        return
      }

      // 上下键导航
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredTools.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredTools.length) % filteredTools.length)
      }

      // Enter 确认
      if (e.key === 'Enter' && filteredTools[selectedIndex]) {
        e.preventDefault()
        handleSelect(filteredTools[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredTools, selectedIndex])

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
    }
  }, [query, isOpen])

  const handleSelect = (tool: ToolItem) => {
    navigate(tool.path)
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* 搜索面板 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
            >
              <div className="bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* 搜索输入框 */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索工具... (输入工具名称或关键词)"
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <kbd className="px-2 py-1 rounded bg-muted border border-border">ESC</kbd>
                    <span>关闭</span>
                  </div>
                </div>

                {/* 结果列表 */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {filteredTools.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      没有找到匹配的工具
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredTools.map((tool, index) => {
                        const Icon = iconMap[tool.icon] || Code2
                        const isSelected = index === selectedIndex
                        const isFavorite = favorites.includes(tool.id)

                        return (
                          <button
                            key={tool.id}
                            onClick={() => handleSelect(tool)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/30'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isSelected ? 'bg-primary/20' : 'bg-muted'
                              }`}
                            >
                              <Icon
                                className={`w-5 h-5 ${
                                  isSelected ? 'text-primary' : 'text-muted-foreground'
                                }`}
                              />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium text-foreground">
                                {tool.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tool.keywords.slice(0, 3).join(' · ')}
                              </div>
                            </div>
                            {isFavorite && (
                              <div className="text-xs text-primary px-2 py-1 rounded bg-primary/10">
                                已收藏
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 底部提示 */}
                <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↑</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↓</kbd>
                      <span>导航</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Enter</kbd>
                      <span>选择</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{getShortcutDisplayText(useShortcutStore.getState().getShortcutKey('commandPalette'))}</span>
                    <span>快速唤起</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
