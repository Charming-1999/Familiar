import React, { Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Star } from 'lucide-react'

import { Button } from '../components/Button'
import { TOOL_REGISTRY_BY_ID } from '../lib/toolRegistry'
import { cn } from '../lib/utils'
import { useToolStore } from '../stores/useToolStore'

const ToolFallback = ({ name }: { name: string }) => (
  <div className="flex-1 min-h-0 flex items-center justify-center">
    <div className="glass-card rounded-2xl border border-border px-8 py-7 text-center space-y-3">
      <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
      <div className="text-sm text-foreground">正在加载 {name}</div>
    </div>
  </div>
)

export const ToolPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toggleFavorite, isFavorite } = useToolStore()
  const tool = id ? TOOL_REGISTRY_BY_ID[id] : undefined

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold text-muted-foreground">工具不存在</h2>
        <Button variant="link" onClick={() => navigate('/market')}>返回工具市场</Button>
      </div>
    )
  }

  const Component = tool.component
  const favorited = isFavorite(tool.id)

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground -ml-3">
            <ArrowLeft className="w-4 h-4 mr-2" />返回
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground italic">{tool.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className={cn('hover:bg-primary/10', favorited ? 'text-primary' : 'text-muted-foreground')} onClick={() => toggleFavorite(tool.id)}>
          <Star className={cn('w-4 h-4 mr-2', favorited && 'fill-current')} />
          {favorited ? '已收藏' : '加入收藏'}
        </Button>
      </div>

      <Suspense fallback={<ToolFallback name={tool.name} />}>
        <Component />
      </Suspense>
    </div>
  )
}
