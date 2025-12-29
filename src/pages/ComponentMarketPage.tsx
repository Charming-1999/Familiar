import React from 'react'
import { motion } from 'framer-motion'
import { Clock, CloudSun, Palette, Star, StickyNote, Quote, Target, Search } from 'lucide-react'

import { Button } from '../components/Button'
import { useComponentStore } from '../stores/useComponentStore'
import { cn } from '../lib/utils'

const ALL_COMPONENTS = [
  {
    id: 'time' as const,
    name: '时间组件',
    description: '订阅后：在页面顶部展示时间 + 日期 + 星期',
    icon: Clock,
  },
  {
    id: 'weather' as const,
    name: '气候组件',
    description: '订阅后：展示当前位置的温度/体感/天气/风速/湿度（需定位授权）',
    icon: CloudSun,
  },
  {
    id: 'theme' as const,
    name: '主题组件',
    description: '订阅后：解锁页面风格选择（未订阅默认暗色）',
    icon: Palette,
  },
  {
    id: 'quote' as const,
    name: '程序员语录（Daily Quote）',
    description: '订阅后：在工作台顶部展示每日随机一句技术名言/冷笑话（离线保存）',
    icon: Quote,
  },
  {
    id: 'sticky' as const,
    name: '快捷记事贴（Sticky Notes）',
    description: '订阅后：在工作台右下角出现"灵感速记"，Enter 回车提交到"随心记"（不做本地保存，Shift+Enter 换行）',
    icon: StickyNote,
  },
  {
    id: 'focus' as const,
    name: '专注模式',
    description: '订阅后：全屏专注计时器，支持番茄工作法，帮助你高效专注工作',
    icon: Target,
  },
  {
    id: 'search' as const,
    name: '快捷搜索栏（Command Palette）',
    description: '订阅后：按 Ctrl/Cmd+Q 唤起全局搜索，快速导航到任意工具',
    icon: Search,
  },
]

export const ComponentMarketPage: React.FC = () => {
  const { toggleSubscribed, isSubscribed } = useComponentStore()

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground italic mb-2">组件市场</h2>
          <p className="text-muted-foreground">订阅组件后，页面会出现对应能力</p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Star className="w-4 h-4" />
          <span>订阅状态会保存到云端</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_COMPONENTS.map((c, index) => {
          const Icon = c.icon
          const subscribed = isSubscribed(c.id)

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              key={c.id}
              className={cn(
                'group glass-card p-6 rounded-xl transition-all relative',
                subscribed ? 'border-primary/30' : 'hover:border-primary/30'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  'p-3 rounded-lg border transition-all',
                  subscribed
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-muted/20 border-border text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                )}>
                  <Icon className="w-6 h-6" />
                </div>

                <Button
                  size="sm"
                  variant={subscribed ? 'outline' : 'default'}
                  className={cn(subscribed ? 'hover:border-red-400/40 hover:text-red-300' : '')}
                  onClick={() => toggleSubscribed(c.id)}
                >
                  {subscribed ? '已订阅（点击取消）' : '订阅'}
                </Button>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">{c.name}</h3>
              <p className="text-sm text-muted-foreground">{c.description}</p>

              <div className="mt-6 text-xs text-muted-foreground">
                {subscribed ? '已生效：返回任意页面即可看到变化。' : '未订阅：该能力不会出现在页面上。'}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
