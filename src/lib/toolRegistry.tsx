import React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Binary,
  BookOpen,
  Bot,
  Clapperboard,
  Clock,
  Code2,
  FileCode2,
  Fingerprint,
  Globe,
  Image as ImageIcon,
  Link2,
  ListTodo,
  Mic,
  NotebookPen,
  PanelsLeftRight,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'

export type ToolCategory = 'dev' | 'convert' | 'security'

type ToolModule = Record<string, React.ComponentType<any>>

function lazyNamed(loader: () => Promise<ToolModule>, exportName: string) {
  return React.lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] }
  })
}

export type ToolRegistryItem = {
  id: string
  name: string
  description: string
  keywords: string[]
  category: ToolCategory
  icon: LucideIcon
  path: string
  component: React.LazyExoticComponent<React.ComponentType<any>>
}

export const TOOL_REGISTRY: ToolRegistryItem[] = [
  { id: 'json', name: 'JSON 编辑器', description: '去抖解析、树形编辑、转义处理与本地即时校验。', keywords: ['json', '编辑', '格式化', '树形'], category: 'dev', icon: Code2, path: '/tool/json', component: lazyNamed(() => import('../tools/JsonEditor'), 'JsonEditor') },
  { id: 'base64', name: 'Base64 转换', description: '支持文本与图片的 Base64 互转。', keywords: ['base64', '转换', 'encode'], category: 'convert', icon: Binary, path: '/tool/base64', component: lazyNamed(() => import('../tools/Base64Tool'), 'Base64Tool') },
  { id: 'time', name: '时间戳转换', description: 'Unix 时间戳与本地时间快速互转。', keywords: ['时间', 'timestamp', '转换'], category: 'dev', icon: Clock, path: '/tool/time', component: lazyNamed(() => import('../tools/TimestampTool'), 'TimestampTool') },
  { id: 'url', name: 'URL 编解码', description: '处理 URL 参数的转义与还原。', keywords: ['url', '编码', 'decode'], category: 'convert', icon: Link2, path: '/tool/url', component: lazyNamed(() => import('../tools/UrlTool'), 'UrlTool') },
  { id: 'hash', name: '哈希计算', description: '支持 MD5、SHA256、SHA512 等哈希生成。', keywords: ['hash', 'md5', 'sha'], category: 'security', icon: ShieldCheck, path: '/tool/hash', component: lazyNamed(() => import('../tools/HashTool'), 'HashTool') },
  { id: 'jwt', name: 'JWT 解码', description: '解析并查看 JWT Token 的 Header 和 Payload。', keywords: ['jwt', 'token', '解码'], category: 'security', icon: Fingerprint, path: '/tool/jwt', component: lazyNamed(() => import('../tools/JwtTool'), 'JwtTool') },
  { id: 'regex', name: '正则测试', description: '实时测试正则表达式匹配结果。', keywords: ['正则', 'regex', '表达式'], category: 'dev', icon: Search, path: '/tool/regex', component: lazyNamed(() => import('../tools/RegexTool'), 'RegexTool') },
  { id: 'diff', name: '文本对比', description: '两段文本的差异对比与高亮展示。', keywords: ['对比', 'diff', '比较'], category: 'dev', icon: FileCode2, path: '/tool/diff', component: lazyNamed(() => import('../tools/DiffTool'), 'DiffTool') },
  { id: 'linux', name: 'Linux 指令检索', description: '常用 Linux/Vim 指令速查，支持自定义指令云同步。', keywords: ['linux', '命令', 'command'], category: 'dev', icon: Terminal, path: '/tool/linux', component: lazyNamed(() => import('../tools/LinuxCommandTool'), 'LinuxCommandTool') },
  { id: 'notes', name: '随心记', description: '纯文本/Markdown 笔记，多标签、拖拽排序、快捷键与云端自动保存。', keywords: ['笔记', 'note', '记录'], category: 'dev', icon: NotebookPen, path: '/tool/notes', component: lazyNamed(() => import('../tools/NotesTool'), 'NotesTool') },
  { id: 'monaco', name: '代码编辑器（Monaco）', description: '本地代码编辑器：多语言高亮、查找替换、自动保存。', keywords: ['代码', 'editor', 'monaco'], category: 'dev', icon: FileCode2, path: '/tool/monaco', component: lazyNamed(() => import('../tools/MonacoEditorTool'), 'MonacoEditorTool') },
  { id: 'excalidraw', name: 'Excalidraw 白板', description: '本地草稿与云端文档双轨管理的可视化白板。', keywords: ['白板', '画板', 'draw'], category: 'dev', icon: PanelsLeftRight, path: '/tool/excalidraw', component: lazyNamed(() => import('../tools/ExcalidrawTool'), 'ExcalidrawTool') },
  { id: 'video-parser', name: '视频链接解析', description: '短链、视频与图集链接一键解析，支持预览、复制和快捷打开。', keywords: ['视频', '图集', '解析', '去水印'], category: 'convert', icon: Clapperboard, path: '/tool/video-parser', component: lazyNamed(() => import('../tools/VideoParserTool'), 'VideoParserTool') },
  { id: 'voice-rec', name: '语音识别', description: '上传音频/视频文件或粘贴链接，大模型语音转文本。', keywords: ['语音', '识别', 'asr', 'speech', '转文字', '录音'], category: 'convert', icon: Mic, path: '/tool/voice-rec', component: lazyNamed(() => import('../tools/VoiceRecTool'), 'VoiceRecTool') },
  { id: 'chat', name: 'Chat', description: '支持多会话与流式输出的模型对话工具。', keywords: ['对话', 'chat', 'ai'], category: 'dev', icon: Bot, path: '/tool/chat', component: lazyNamed(() => import('../tools/ModelChatTool'), 'ModelChatTool') },
  { id: 'qrcode', name: '二维码生成', description: '输入文本/链接自动生成二维码，支持导出。', keywords: ['二维码', 'qr', 'code'], category: 'convert', icon: QrCode, path: '/tool/qrcode', component: lazyNamed(() => import('../tools/QrCodeTool'), 'QrCodeTool') },
  { id: 'promptvault', name: 'Prompt 市场', description: '沉淀高质量 Prompt，支持提交、复制和删除本人内容。', keywords: ['提示词', 'prompt', '宝库'], category: 'dev', icon: BookOpen, path: '/tool/promptvault', component: lazyNamed(() => import('../tools/PromptVaultTool'), 'PromptVaultTool') },
  { id: 'sitevault', name: '精选网站', description: '沉淀高质量站点链接，支持新增、编辑与删除本人条目。', keywords: ['站点', 'site', '书签'], category: 'dev', icon: Globe, path: '/tool/sitevault', component: lazyNamed(() => import('../tools/SiteVaultTool'), 'SiteVaultTool') },
  { id: 'todolist', name: 'TodoList', description: '简单待办清单，支持收藏区 hover 快捷完成。', keywords: ['todo', '待办', '任务'], category: 'dev', icon: ListTodo, path: '/tool/todolist', component: lazyNamed(() => import('../tools/TodoListTool'), 'TodoListTool') },
  { id: 'cron', name: 'Cron 表达式', description: '可视化生成 Cron 定时任务表达式。', keywords: ['cron', '定时', '表达式'], category: 'dev', icon: Clock, path: '/tool/cron', component: lazyNamed(() => import('../tools/CronTool'), 'CronTool') },
  { id: 'image', name: '图片工具集', description: '图片转换、压缩与基础处理的多合一工具。', keywords: ['图片', 'image', '压缩'], category: 'convert', icon: ImageIcon, path: '/tool/image', component: lazyNamed(() => import('../tools/ImageTool'), 'ImageTool') },
  { id: 'nanobanana', name: 'AI 生图', description: 'gpt-image-2 / nano-banana-pro 系列生图：支持参考图、比例与分辨率，展示进度与结果。', keywords: ['生图', '绘画', 'gpt-image', 'nano', 'banana', 'ai'], category: 'dev', icon: Sparkles, path: '/tool/nanobanana', component: lazyNamed(() => import('../tools/NanoBananaTool'), 'NanoBananaTool') },
]

export const TOOL_REGISTRY_BY_ID = Object.fromEntries(TOOL_REGISTRY.map((item) => [item.id, item])) as Record<string, ToolRegistryItem>
