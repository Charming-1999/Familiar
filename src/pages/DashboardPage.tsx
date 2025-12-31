import React from 'react'
import { motion } from 'framer-motion'
import { Star, Code2, Binary, Clock, Link2, ShieldCheck, Plus, Fingerprint, Search, FileCode2, Terminal, NotebookPen, Bot, ListTodo, PanelsLeftRight, QrCode, BookOpen, Globe, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'



import { useToolStore } from '../stores/useToolStore'
import { useComponentStore } from '../stores/useComponentStore'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { StickyNotesWidget } from '../components/StickyNotesWidget'
import { DailyQuoteWidget } from '../components/DailyQuoteWidget'

const iconMap: Record<string, any> = {
  'json': Code2,
  'base64': Binary,
  'time': Clock,
  'url': Link2,
  'hash': ShieldCheck,
  'jwt': Fingerprint,
  'regex': Search,
  'diff': FileCode2,
  'linux': Terminal,
  'notes': NotebookPen,
  'monaco': FileCode2,
  'excalidraw': PanelsLeftRight,
  'chat': Bot,
  'qrcode': QrCode,
  'promptvault': BookOpen,
  'sitevault': Globe,
  'todolist': ListTodo,
  'cron': Clock,
  'markdown': FileText,
  'image': ImageIcon,
  'nanobanana': Sparkles,
}




const TOOL_NAMES: Record<string, string> = {
  'json': 'JSON 编辑器',
  'base64': 'Base64 转换',
  'time': '时间戳转换',
  'url': 'URL 编解码',
  'hash': '哈希计算',
  'jwt': 'JWT 解码',
  'regex': '正则测试',
  'diff': '文本对比',
  'linux': 'Linux 指令检索',
  'notes': '随心记',
  'monaco': '代码编辑器（Monaco）',
  'excalidraw': 'Excalidraw 白板',
  'chat': '模型对话',
  'qrcode': '二维码生成',
  'promptvault': 'Prompt 市场',
  'sitevault': '精选网站',
  'todolist': 'TodoList',
  'cron': 'Cron 表达式',
  'image': '图片工具集',
  'nanobanana': 'NanoBanana 生图',
}




export const DashboardPage: React.FC = () => {
  const { favorites } = useToolStore()
  const quote = useComponentStore((s) => s.subscriptions.quote)
  const sticky = useComponentStore((s) => s.subscriptions.sticky)
  const navigate = useNavigate()

  return (
    <div className="space-y-12">
      {quote ? <DailyQuoteWidget className="max-w-[720px]" /> : null}

      <header>
        <h2 className="text-4xl font-bold tracking-tighter text-foreground italic mb-2">个人工作台</h2>
        <p className="text-muted-foreground">欢迎回来，这是您的常用工具集</p>
      </header>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {favorites.map((id, index) => {
            const Icon = iconMap[id] || Code2
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                key={id}
                className="group p-6 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer text-center"
                onClick={() => navigate(`/tool/${id}`)}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                  {TOOL_NAMES[id] || id}
                </h3>
              </motion.div>
            )
          })}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 text-muted-foreground hover:text-primary transition-all"
            onClick={() => navigate('/market')}
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">添加更多工具</span>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-muted/10">
          <Star className="w-16 h-16 text-muted-foreground/30 mb-6" />
          <h3 className="text-xl font-medium text-foreground mb-2">工作台空空如也</h3>
          <p className="text-muted-foreground mb-8">前往工具市场将常用工具加入收藏</p>
          <Button onClick={() => navigate('/market')} className="h-12 px-8">
            浏览工具市场
          </Button>
        </div>
      )}

      <section className="space-y-6">
        <h3 className="text-lg font-bold text-foreground flex items-center">
          <Clock className="w-5 h-5 mr-2 text-primary" />
          最近使用
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Placeholder for recent tools */}
           <div className="p-4 rounded-lg bg-muted/30 border border-border flex items-center justify-between opacity-50 italic text-sm">
             暂无使用记录
           </div>
        </div>
      </section>

      {sticky ? <StickyNotesWidget /> : null}
    </div>
  )
}
