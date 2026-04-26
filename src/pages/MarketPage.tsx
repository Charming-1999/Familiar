import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { TOOL_REGISTRY } from '../lib/toolRegistry'
import { cn } from '../lib/utils'
import { useToolStore } from '../stores/useToolStore'

export const MarketPage: React.FC = () => {
  const { toggleFavorite, isFavorite } = useToolStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filteredTools = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return TOOL_REGISTRY
    return TOOL_REGISTRY.filter((tool) => `${tool.name}\n${tool.description}\n${tool.id}\n${tool.keywords.join(' ')}`.toLowerCase().includes(keyword))
  }, [query])

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground italic mb-2">工具市场</h2>
          <p className="text-muted-foreground">统一元数据与按需加载已启用，新增工具不再需要在多个页面重复维护。</p>
        </div>
        <div className="w-full sm:w-80">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索工具（名称 / 描述 / 关键词）" className="bg-muted/10" />
        </div>
      </header>

      {filteredTools.length === 0 ? (
        <div className="glass-card p-10 rounded-2xl text-center text-muted-foreground">没有找到匹配的工具</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool, index) => {
            const Icon = tool.icon
            const favorited = isFavorite(tool.id)
            return (
              <motion.div key={tool.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="group glass-card p-6 rounded-xl hover:border-primary/40 transition-all cursor-pointer relative" onClick={() => navigate(tool.path)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all"><Icon className="w-6 h-6" /></div>
                  <Button variant="ghost" size="icon" className={cn('hover:bg-primary/20', favorited ? 'text-primary' : 'text-muted-foreground')} onClick={(event) => { event.stopPropagation(); toggleFavorite(tool.id) }}><Star className={cn('w-5 h-5', favorited && 'fill-current')} /></Button>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{tool.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">{tool.keywords.slice(0, 3).map((keyword) => <span key={keyword} className="text-[11px] px-2 py-1 rounded-full border border-border bg-muted/20 text-muted-foreground">{keyword}</span>)}</div>
                <div className="mt-6 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">立即使用 <ChevronRight className="w-3 h-3 ml-1" /></div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
