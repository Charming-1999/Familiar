import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Plus, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { DailyQuoteWidget } from '../components/DailyQuoteWidget'
import { StickyNotesWidget } from '../components/StickyNotesWidget'
import { TOOL_REGISTRY_BY_ID } from '../lib/toolRegistry'
import { useComponentStore } from '../stores/useComponentStore'
import { useToolStore } from '../stores/useToolStore'

export const DashboardPage: React.FC = () => {
  const { favorites } = useToolStore()
  const quote = useComponentStore((state) => state.subscriptions.quote)
  const sticky = useComponentStore((state) => state.subscriptions.sticky)
  const navigate = useNavigate()

  const favoriteTools = useMemo(() => favorites.map((id) => TOOL_REGISTRY_BY_ID[id]).filter(Boolean), [favorites])

  return (
    <div className="space-y-12">
      {quote ? <DailyQuoteWidget className="max-w-[720px]" /> : null}
      <header>
        <h2 className="text-4xl font-bold tracking-tighter text-foreground italic mb-2">个人工作台</h2>
        <p className="text-muted-foreground">常用工具入口已经改为共享注册中心，名称、图标与描述将始终保持一致。</p>
      </header>

      {favoriteTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{favoriteTools.map((tool, index) => { const Icon = tool.icon; return <motion.div key={tool.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} className="group p-6 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer text-center" onClick={() => navigate(tool.path)}><div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary" /></div><h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{tool.name}</h3></motion.div>})}<motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 text-muted-foreground hover:text-primary transition-all" onClick={() => navigate('/market')}><Plus className="w-8 h-8 mb-2" /><span className="text-sm font-medium">添加更多工具</span></motion.div></div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-muted/10"><Star className="w-16 h-16 text-muted-foreground/30 mb-6" /><h3 className="text-xl font-medium text-foreground mb-2">工作台空空如也</h3><p className="text-muted-foreground mb-8">前往工具市场将常用工具加入收藏</p><Button onClick={() => navigate('/market')} className="h-12 px-8">浏览工具市场</Button></div>
      )}

      <section className="space-y-6">
        <h3 className="text-lg font-bold text-foreground flex items-center"><Clock className="w-5 h-5 mr-2 text-primary" />最近使用</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="p-4 rounded-lg bg-muted/30 border border-border flex items-center justify-between opacity-50 italic text-sm">暂无使用记录</div></div>
      </section>

      {sticky ? <StickyNotesWidget /> : null}
    </div>
  )
}
