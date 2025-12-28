import React, { useMemo, useRef, useState } from 'react'

import { NavLink } from 'react-router-dom'

import { cn } from '../lib/utils'
import { 
  LayoutDashboard, 
  Store, 

  LogOut, 
  ChevronRight,
  Code2,
  Clock,
  Link2,
  ShieldCheck,
  Binary,
  Fingerprint,
  Search,
  FileCode2,
  Terminal,
  NotebookPen,
  Bot,
  ListTodo,
  PanelsLeftRight,
  QrCode,
  BookOpen,
  Globe,
  Check,
  Palette
} from 'lucide-react'



import { useAuthStore } from '../stores/useAuthStore'
import { useToolStore } from '../stores/useToolStore'
import { useTodoStore } from '../stores/useTodoStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useComponentStore } from '../stores/useComponentStore'
import { TimeWidget } from './TimeWidget'
import { WeatherWidget } from './WeatherWidget'
import { Button } from './Button'


const iconMap: Record<string, any> = {
  'dashboard': LayoutDashboard,
  'market': Store,
  'components': Store,
  'pet_market': Store,
  'json': Code2,
  'base64': Binary,
  'time': Clock,
  'url': Link2,
  'hash': ShieldCheck,
  'jwt': Fingerprint,
  'regex': Search,
  'diff': FileCode2,
  'monaco': FileCode2,
  'linux': Terminal,
  'notes': NotebookPen,
  'chat': Bot,
  'qrcode': QrCode,
  'promptvault': BookOpen,
  'sitevault': Globe,
  'todolist': ListTodo,
  'excalidraw': PanelsLeftRight,
}

type ToolMeta = { id: string; name: string; icon: string }

const TOOL_META: ToolMeta[] = [
  { id: 'json', name: 'JSON 编辑器', icon: 'json' },
  { id: 'base64', name: 'Base64 转换', icon: 'base64' },
  { id: 'time', name: '时间戳转换', icon: 'time' },
  { id: 'url', name: 'URL 编解码', icon: 'url' },
  { id: 'hash', name: '哈希计算', icon: 'hash' },
  { id: 'jwt', name: 'JWT 解码', icon: 'jwt' },
  { id: 'regex', name: '正则测试', icon: 'regex' },
  { id: 'diff', name: '文本对比', icon: 'diff' },
  { id: 'linux', name: 'Linux 指令检索', icon: 'linux' },
  { id: 'notes', name: '随心记', icon: 'notes' },
  { id: 'monaco', name: '代码编辑器（Monaco）', icon: 'monaco' },
  { id: 'excalidraw', name: 'Excalidraw 白板', icon: 'excalidraw' },
  { id: 'chat', name: '模型对话', icon: 'chat' },
  { id: 'qrcode', name: '二维码生成', icon: 'qrcode' },
  { id: 'promptvault', name: '提示词宝库', icon: 'promptvault' },
  { id: 'sitevault', name: '精选站点集', icon: 'sitevault' },
  { id: 'todolist', name: 'TodoList', icon: 'todolist' },
]

export const Sidebar: React.FC = () => {
  const { signOut, user } = useAuthStore()
  const { favorites, moveFavorite } = useToolStore()
  const { todos, toggleTodo } = useTodoStore()
  const { theme, setTheme } = useThemeStore()
  const { isSubscribed } = useComponentStore()


  const [todoHoverOpen, setTodoHoverOpen] = useState(false)
  const closeTodoHoverTimer = useRef<number | null>(null)
  const dragFavoriteIdRef = useRef<string | null>(null)


  const openTodoHover = () => {
    if (closeTodoHoverTimer.current != null) {
      window.clearTimeout(closeTodoHoverTimer.current)
      closeTodoHoverTimer.current = null
    }
    setTodoHoverOpen(true)
  }

  const scheduleCloseTodoHover = () => {
    if (closeTodoHoverTimer.current != null) {
      window.clearTimeout(closeTodoHoverTimer.current)
    }
    closeTodoHoverTimer.current = window.setTimeout(() => {
      closeTodoHoverTimer.current = null
      setTodoHoverOpen(false)
    }, 250)
  }


  const pendingTop5 = useMemo(() => {
    return [...todos]
      .filter((t) => !t.completed)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  }, [todos])



  const navItems = [
    { name: '工作台', icon: 'dashboard', path: '/' },
    { name: '工具市场', icon: 'market', path: '/market' },
    { name: '组件市场', icon: 'components', path: '/components' },
    { name: '宠物市场', icon: 'pet_market', path: '/pets', disabled: true, tip: '开发中，敬请期待' },
  ]

  const favoriteTools = useMemo(() => {
    const byId = new Map(TOOL_META.map((t) => [t.id, t] as const))
    const out: ToolMeta[] = []
    for (const id of favorites) {
      const t = byId.get(id)
      if (t) out.push(t)
    }
    return out
  }, [favorites])





  return (
    <aside className="w-64 border-r border-border flex flex-col h-screen bg-background/50 backdrop-blur-xl">
      <div className="p-6">
        <h1 className="text-2xl font-bold italic text-primary tracking-tighter text-glow font-mono">
          Familiar
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-8">
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">
            主菜单
          </p>
          {navItems.map((item) => {
            const Icon = iconMap[item.icon]
            if ((item as any).disabled) {
              const tip = (item as any).tip || '开发中，敬请期待'
              return (
                <div key={item.path} className="relative group">
                  <div
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-transparent",
                      "text-muted-foreground/50 cursor-not-allowed"
                    )}
                    aria-disabled
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] px-2 py-1 rounded-md border border-border bg-background/95 backdrop-blur shadow-sm text-foreground opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                    {tip}
                  </div>
                </div>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>

        {favoriteTools.length > 0 && (
          <div className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">
              我的收藏
            </p>
            {favoriteTools.map((tool) => {
              const Icon = iconMap[tool.icon]
              const isTodoList = tool.id === 'todolist'

              return (
                <div
                  key={tool.id}
                  className="relative group"
                  draggable
                  onDragStart={(e) => {
                    dragFavoriteIdRef.current = tool.id
                    try {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', tool.id)
                    } catch {
                      // ignore
                    }
                  }}
                  onDragEnd={() => {
                    dragFavoriteIdRef.current = null
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    try {
                      e.dataTransfer.dropEffect = 'move'
                    } catch {
                      // ignore
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sourceId = dragFavoriteIdRef.current
                    if (sourceId) moveFavorite(sourceId, tool.id)
                    dragFavoriteIdRef.current = null
                  }}
                  onPointerEnter={isTodoList ? openTodoHover : undefined}
                  onPointerLeave={isTodoList ? scheduleCloseTodoHover : undefined}
                >
                  <NavLink
                    to={`/tool/${tool.id}`}
                    className={({ isActive }) => cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4" />
                      <span>{tool.name}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </NavLink>

                  {isTodoList && (
                    <div
                      className={cn(
                        "absolute left-full top-1/2 -translate-y-1/2 translate-x-2 w-72 z-50 transition-opacity",
                        todoHoverOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                      )}
                    >

                      <div className="rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-foreground">最近未完成（5 条内）</div>
                          <div className="text-[10px] text-muted-foreground">点击打勾完成</div>
                        </div>

                        {pendingTop5.length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">暂无未完成待办</div>
                        ) : (
                          <div className="space-y-1">
                            {pendingTop5.map((t) => (
                              <div key={t.id} className="flex items-start gap-2 px-2 py-1 rounded-lg hover:bg-muted/30">
                                <button
                                  className="mt-0.5 w-5 h-5 rounded border border-border bg-muted/10 flex items-center justify-center hover:border-primary/50"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleTodo(t.id, true)
                                  }}
                                  title="完成"
                                >
                                  <Check className="w-3.5 h-3.5 text-primary opacity-0" />
                                </button>

                                <div className="flex-1 min-w-0 text-xs text-foreground truncate">{t.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 px-3 py-4 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-foreground">{user?.email}</p>
            <p className="text-[10px] text-primary/70">已激活</p>
          </div>
        </div>

        <div className="px-3 mb-4 space-y-2">
          {isSubscribed('time') ? <TimeWidget compact /> : null}
          {isSubscribed('weather') ? <WeatherWidget compact /> : null}
        </div>

        {isSubscribed('theme') ? (
          <div className="px-3 mb-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              <Palette className="w-3.5 h-3.5" />
              主题
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="mt-2 w-full h-9 rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="dark">暗色</option>
              <option value="light">白色</option>
              <option value="transparent">透明</option>
              <option value="pixel">复古像素</option>
              <option value="neon">赛博霓虹</option>
              <option value="minimal">极简灰阶</option>
              <option value="green">护眼绿</option>
              <option value="deepsea">深海蓝</option>
            </select>
          </div>
        ) : null}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>

    </aside>
  )
}
