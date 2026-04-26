import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Settings2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { TOOL_REGISTRY } from '../lib/toolRegistry'
import { getShortcutDisplayText } from '../lib/shortcuts'
import { useShortcutStore } from '../stores/useShortcutStore'
import { useToolStore } from '../stores/useToolStore'
import { useAuthStore } from '../stores/useAuthStore'



export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const { favorites } = useToolStore()
  const { getShortcutChecker } = useShortcutStore()
  const { profile } = useAuthStore()

  const commands = useMemo(() => {
    const toolCommands = TOOL_REGISTRY.map((tool) => ({ id: tool.id, name: tool.name, path: tool.path, keywords: tool.keywords, icon: tool.icon, favorite: favorites.includes(tool.id) }))
    const adminCommand = profile?.is_super_admin ? [{ id: 'admin-config', name: '配置中心', path: '/admin/config', keywords: ['超管', '配置', '密钥', '激活码'], icon: Settings2, favorite: false }] : []
    return [...adminCommand, ...toolCommands]
  }, [favorites, profile?.is_super_admin])

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      const favoriteCommands = commands.filter((item) => item.favorite)
      return favoriteCommands.length > 0 ? favoriteCommands : commands.slice(0, 8)
    }
    const keyword = query.toLowerCase()
    return commands.filter((item) => item.name.toLowerCase().includes(keyword) || item.keywords.some((kw) => kw.includes(keyword))).slice(0, 8)
  }, [commands, query])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const checkCommandPalette = getShortcutChecker('commandPalette')
      if (checkCommandPalette && checkCommandPalette(event)) {
        event.preventDefault()
        setIsOpen((prev) => !prev)
        return
      }
      if (!isOpen) return
      if (event.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        setSelectedIndex(0)
        return
      }
      if (filteredCommands.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      }
      if (event.key === 'Enter' && filteredCommands[selectedIndex]) {
        event.preventDefault()
        navigate(filteredCommands[selectedIndex].path)
        setIsOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredCommands, getShortcutChecker, isOpen, navigate, selectedIndex])

  useEffect(() => {
    if (isOpen) setSelectedIndex(0)
  }, [isOpen, query])

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -20 }} className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
            <div className="bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-border"><Search className="w-5 h-5 text-muted-foreground" /><input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索工具、关键词或超管入口" className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm" /><div className="flex items-center gap-1 text-xs text-muted-foreground"><kbd className="px-2 py-1 rounded bg-muted border border-border">ESC</kbd><span>关闭</span></div></div>
              <div className="max-h-[60vh] overflow-y-auto">{filteredCommands.length === 0 ? <div className="p-8 text-center text-muted-foreground">没有找到匹配的命令</div> : <div className="p-2">{filteredCommands.map((item, index) => { const Icon = item.icon; const isSelected = index === selectedIndex; return <button key={item.id} onClick={() => { navigate(item.path); setIsOpen(false); setQuery('') }} onMouseEnter={() => setSelectedIndex(index)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}><Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} /></div><div className="flex-1 text-left"><div className="text-sm font-medium text-foreground">{item.name}</div><div className="text-xs text-muted-foreground">{item.keywords.slice(0, 3).join(' · ')}</div></div>{item.favorite ? <div className="text-xs text-primary px-2 py-1 rounded bg-primary/10">已收藏</div> : null}</button>})}</div>}</div>
              <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground"><div className="flex items-center gap-4"><div className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↑</kbd><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↓</kbd><span>导航</span></div><div className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Enter</kbd><span>选择</span></div></div><div className="flex items-center gap-1"><span>{getShortcutDisplayText(useShortcutStore.getState().getShortcutKey('commandPalette'))}</span><span>快速唤起</span></div></div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
