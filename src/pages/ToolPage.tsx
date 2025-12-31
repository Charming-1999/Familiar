import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { JsonEditor } from '../tools/JsonEditor'
import { Base64Tool } from '../tools/Base64Tool'
import { TimestampTool } from '../tools/TimestampTool'
import { UrlTool } from '../tools/UrlTool'
import { HashTool } from '../tools/HashTool'
import { JwtTool } from '../tools/JwtTool'
import { RegexTool } from '../tools/RegexTool'
import { DiffTool } from '../tools/DiffTool'
import { LinuxCommandTool } from '../tools/LinuxCommandTool'
import { NotesTool } from '../tools/NotesTool'
import { ModelChatTool } from '../tools/ModelChatTool'
import { TodoListTool } from '../tools/TodoListTool'
import { ExcalidrawTool } from '../tools/ExcalidrawTool'
import { MonacoEditorTool } from '../tools/MonacoEditorTool'
import { QrCodeTool } from '../tools/QrCodeTool'
import { PromptVaultTool } from '../tools/PromptVaultTool'
import { SiteVaultTool } from '../tools/SiteVaultTool'
import { CronTool } from '../tools/CronTool'
import { ImageTool } from '../tools/ImageTool'
import { NanoBananaTool } from '../tools/NanoBananaTool'
import { Button } from '../components/Button'





import { ArrowLeft, Star } from 'lucide-react'
import { useToolStore } from '../stores/useToolStore'
import { cn } from '../lib/utils'

const TOOL_COMPONENTS: Record<string, React.FC> = {
  'json': JsonEditor,
  'base64': Base64Tool,
  'time': TimestampTool,
  'url': UrlTool,
  'hash': HashTool,
  'jwt': JwtTool,
  'regex': RegexTool,
  'diff': DiffTool,
  'linux': LinuxCommandTool,
  'notes': NotesTool,
  'chat': ModelChatTool,
  'todolist': TodoListTool,
  'excalidraw': ExcalidrawTool,
  'monaco': MonacoEditorTool,
  'qrcode': QrCodeTool,
  'promptvault': PromptVaultTool,
  'sitevault': SiteVaultTool,
  'cron': CronTool,
  'image': ImageTool,
  'nanobanana': NanoBananaTool,
}







export const ToolPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toggleFavorite, isFavorite } = useToolStore()

  if (!id || !TOOL_COMPONENTS[id]) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold text-muted-foreground">工具不存在</h2>
        <Button variant="link" onClick={() => navigate('/market')}>返回工具市场</Button>
      </div>
    )
  }

  const Component = TOOL_COMPONENTS[id]
  const favorited = isFavorite(id)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "hover:bg-primary/10",
            favorited ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => toggleFavorite(id)}
        >
          <Star className={cn("w-4 h-4 mr-2", favorited && "fill-current")} />
          {favorited ? '已收藏' : '加入收藏'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <Component />
      </div>
    </div>
  )
}
