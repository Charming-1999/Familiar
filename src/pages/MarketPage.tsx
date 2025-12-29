import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Code2, Binary, Clock, Link2, ShieldCheck, ChevronRight, Fingerprint, Search, FileCode2, Terminal, NotebookPen, Bot, ListTodo, PanelsLeftRight, QrCode, BookOpen, Globe, FileText, Image as ImageIcon } from 'lucide-react'



import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useToolStore } from '../stores/useToolStore'
import { cn } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

const ALL_TOOLS = [
  { id: 'json', name: 'JSON 编辑器', description: '专业的 JSON 格式化、压缩、转 TS 及树形预览', icon: Code2, category: 'dev' },
  { id: 'base64', name: 'Base64 转换', description: '支持文本与图片的 Base64 互转', icon: Binary, category: 'convert' },
  { id: 'time', name: '时间戳转换', description: 'Unix 时间戳与本地时间快速互转', icon: Clock, category: 'dev' },
  { id: 'url', name: 'URL 编解码', description: '处理 URL 参数的转义与还原', icon: Link2, category: 'convert' },
  { id: 'hash', name: '哈希计算', description: 'MD5, SHA256, SHA512 等哈希值生成', icon: ShieldCheck, category: 'security' },
  { id: 'jwt', name: 'JWT 解码', description: '解析并查看 JWT Token 的 Header 和 Payload', icon: Fingerprint, category: 'security' },
  { id: 'regex', name: '正则测试', description: '实时测试正则表达式匹配结果', icon: Search, category: 'dev' },
  { id: 'diff', name: '文本对比', description: '两段文本的差异对比与高亮展示', icon: FileCode2, category: 'dev' },
  { id: 'linux', name: 'Linux 指令检索', description: '常用 Linux/Vim 指令速查，支持自定义指令云同步', icon: Terminal, category: 'dev' },
  { id: 'notes', name: '随心记', description: '纯文本/Markdown 笔记，多标签、拖拽排序、快捷键与云端自动保存', icon: NotebookPen, category: 'dev' },
  { id: 'monaco', name: '代码编辑器（Monaco）', description: '本地代码编辑器：多语言高亮、查找替换、自动保存', icon: FileCode2, category: 'dev' },
  { id: 'excalidraw', name: 'Excalidraw 白板', description: '云端自动保存白板（v1：仅矢量/文本），跨设备同步', icon: PanelsLeftRight, category: 'dev' },
  { id: 'chat', name: '模型对话', description: '基于 grsaiapi 的流式对话，支持 gemini-3-pro / gemini-3-flash', icon: Bot, category: 'dev' },
  { id: 'qrcode', name: '二维码生成', description: '输入文本/链接自动生成二维码，支持纠错等级、颜色与 PNG/SVG 导出', icon: QrCode, category: 'convert' },
  { id: 'promptvault', name: 'Prompt 市场', description: '沉淀高质量 Prompt：全站可见，支持提交/复制/删除本人', icon: BookOpen, category: 'dev' },
  { id: 'sitevault', name: '精选网站', description: '沉淀高质量站点链接：全站可见，支持新增/编辑/删除本人', icon: Globe, category: 'dev' },
  { id: 'todolist', name: 'TodoList', description: '简单待办清单：增删勾选，支持收藏区 hover 快捷完成', icon: ListTodo, category: 'dev' },
  { id: 'cron', name: 'Cron 表达式生成器', description: '可视化生成 Cron 定时任务表达式，支持预设和自定义配置', icon: Clock, category: 'dev' },
  { id: 'image', name: '图片工具集', description: 'Base64 转换、尺寸调整、图片压缩等多合一图片处理工具', icon: ImageIcon, category: 'convert' },
]






export const MarketPage: React.FC = () => {
  const { toggleFavorite, isFavorite } = useToolStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_TOOLS
    return ALL_TOOLS.filter((t) => {
      const hay = `${t.name}\n${t.description}\n${t.id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query])

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground italic mb-2">工具市场</h2>
          <p className="text-muted-foreground">发现并探索高效的开发辅助工具</p>
        </div>
        <div className="w-full sm:w-80">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索工具（名称/描述）..."
            className="bg-muted/10"
          />
        </div>
      </header>

      {filteredTools.length === 0 ? (
        <div className="glass-card p-10 rounded-2xl text-center text-muted-foreground">
          没有找到匹配的工具
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool, index) => {
            const Icon = tool.icon
            const favorited = isFavorite(tool.id)

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={tool.id}
                className="group glass-card p-6 rounded-xl hover:border-primary/40 transition-all cursor-pointer relative"
                onClick={() => navigate(`/tool/${tool.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Icon className="w-6 h-6" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "hover:bg-primary/20",
                      favorited ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(tool.id)
                    }}
                  >
                    <Star className={cn("w-5 h-5", favorited && "fill-current")} />
                  </Button>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {tool.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tool.description}
                </p>

                <div className="mt-6 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  立即使用 <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
