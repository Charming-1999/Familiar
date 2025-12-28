import React, { useEffect, useMemo, useState } from 'react'
import { Terminal, Copy, Check, Plus, Trash2, Save } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'

type BuiltinCommandCategory =
  | '文件'
  | '文本处理'
  | '进程'
  | '网络'
  | '权限'
  | '包管理'
  | '系统'
  | 'Vim'
  | '其他'

type BuiltinCommandItem = {
  id: string
  title: string
  description: string
  command: string
  category: BuiltinCommandCategory
  tags: string[]
  examples: string[]
  related?: string[]
}

type UserSnippet = {
  id: string
  user_id: string
  title: string
  command: string
  description: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

const BUILTIN_CATEGORIES: BuiltinCommandCategory[] = [
  '文件',
  '文本处理',
  '进程',
  '网络',
  '权限',
  '包管理',
  '系统',
  'Vim',
  '其他',
]

const BUILTIN: BuiltinCommandItem[] = [
  {
    id: 'ls',
    title: '列出目录内容',
    description: '查看文件/目录，支持隐藏文件、详细信息、按时间排序。',
    command: 'ls -alh',
    category: '文件',
    tags: ['ls', '目录', '文件', '查看'],
    examples: ['ls', 'ls -alh', 'ls -lt', 'ls -a'],
    related: ['find', 'tree'],
  },
  {
    id: 'find',
    title: '查找文件',
    description: '按名称/类型/时间查找文件，可配合 xargs 批处理。',
    command: 'find . -name "*.log" -type f',
    category: '文件',
    tags: ['find', '查找', '文件', '目录'],
    examples: [
      'find . -name "*.ts" -type f',
      'find /var/log -type f -mtime -1',
      'find . -type f -maxdepth 2',
      'find . -type f -name "*.log" -print0 | xargs -0 grep -n "ERROR"',
    ],
    related: ['grep', 'xargs'],
  },
  {
    id: 'grep',
    title: '文本搜索（grep）',
    description: '在文件中搜索关键字/正则，支持递归、忽略大小写、显示行号。',
    command: 'grep -RIn "keyword" .',
    category: '文本处理',
    tags: ['grep', '搜索', '正则', '日志'],
    examples: ['grep -n "main" app.js', 'grep -RIn "TODO" .', 'grep -RIn --exclude-dir=node_modules "error" .'],
    related: ['rg', 'awk', 'sed'],
  },
  {
    id: 'sed',
    title: '流式替换（sed）',
    description: '对文本做替换/截取；常用于批量替换配置、日志处理。',
    command: "sed -i 's/old/new/g' file.txt",
    category: '文本处理',
    tags: ['sed', '替换', '批量'],
    examples: [
      "sed -n '1,120p' file.txt",
      "sed -i 's/127.0.0.1/0.0.0.0/g' *.conf",
      "sed 's/[[:space:]]\+$//' file.txt",
    ],
    related: ['awk', 'perl'],
  },
  {
    id: 'ps',
    title: '查看进程（ps）',
    description: '查看进程列表，常配合 grep 过滤。',
    command: 'ps aux | grep node',
    category: '进程',
    tags: ['ps', '进程', '定位'],
    examples: ['ps aux', 'ps aux | grep nginx', 'ps -ef | grep java'],
    related: ['top', 'htop', 'kill'],
  },
  {
    id: 'kill',
    title: '结束进程（kill）',
    description: '按 PID 结束进程；必要时使用强制结束。',
    command: 'kill -9 <pid>',
    category: '进程',
    tags: ['kill', '进程', 'pid'],
    examples: ['kill <pid>', 'kill -9 <pid>', 'pkill -f "vite"'],
    related: ['lsof', 'pkill'],
  },
  {
    id: 'curl',
    title: 'HTTP 请求（curl）',
    description: '调试接口、下载文件、查看响应头。',
    command: 'curl -i https://example.com',
    category: '网络',
    tags: ['curl', 'http', '接口'],
    examples: [
      'curl -i https://example.com',
      'curl -X POST -H "Content-Type: application/json" -d "{\"a\":1}" http://localhost:3000/api',
      'curl -L -o out.zip https://example.com/file.zip',
    ],
    related: ['wget', 'netstat', 'ss'],
  },
  {
    id: 'ss',
    title: '查看端口占用（ss）',
    description: '查看监听端口与对应进程，排查服务启动失败常用。',
    command: 'ss -lntp',
    category: '网络',
    tags: ['端口', '监听', 'ss', '排查'],
    examples: ['ss -lntp', 'ss -lntp | grep 5173', 'lsof -i :5173'],
    related: ['lsof', 'netstat'],
  },
  {
    id: 'chmod',
    title: '修改权限（chmod）',
    description: '修改文件权限；脚本无法执行时常见处理。',
    command: 'chmod +x script.sh',
    category: '权限',
    tags: ['chmod', '权限', '可执行'],
    examples: ['chmod +x script.sh', 'chmod 644 file.txt', 'chmod -R 755 /var/www'],
    related: ['chown', 'umask'],
  },
  {
    id: 'apt',
    title: '包管理（apt）',
    description: 'Debian/Ubuntu 系列常用安装、更新、移除命令。',
    command: 'sudo apt update && sudo apt install -y <pkg>',
    category: '包管理',
    tags: ['apt', '安装', '更新'],
    examples: ['sudo apt update', 'sudo apt install -y git', 'sudo apt remove -y nginx'],
    related: ['yum', 'dnf'],
  },
  {
    id: 'systemctl',
    title: '服务管理（systemctl）',
    description: '查看/启动/停止系统服务，排查服务状态和日志。',
    command: 'systemctl status <service>',
    category: '系统',
    tags: ['systemctl', '服务', 'systemd'],
    examples: ['systemctl status nginx', 'sudo systemctl restart nginx', 'journalctl -u nginx -n 200 --no-pager'],
    related: ['journalctl'],
  },
  {
    id: 'vim-search',
    title: 'Vim：查找与替换',
    description: '常用搜索、全局替换、确认替换等。',
    command: ':%s/old/new/gc',
    category: 'Vim',
    tags: ['vim', '替换', '搜索'],
    examples: ['/keyword', 'n / N', ':%s/old/new/g', ':%s/old/new/gc', ':%s/\\v(\\w+) (\\w+)/\\2 \\1/g'],
    related: ['vim-register', 'vim-split'],
  },
  {
    id: 'vim-split',
    title: 'Vim：分屏与窗口',
    description: '垂直/水平分屏、窗口切换与关闭。',
    command: ':vsp file | :sp file',
    category: 'Vim',
    tags: ['vim', '分屏', '窗口'],
    examples: [':sp file', ':vsp file', 'Ctrl+w w', 'Ctrl+w h/j/k/l', ':q'],
  },
  {
    id: 'vim-register',
    title: 'Vim：寄存器与复制粘贴',
    description: '使用寄存器进行复制粘贴、查看寄存器内容。',
    command: '"+y / "+p',
    category: 'Vim',
    tags: ['vim', '寄存器', '剪贴板'],
    examples: ['"+y', '"+p', ':reg', '"ayy', '"ap'],
  },
]

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export const LinuxCommandTool: React.FC = () => {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'builtin' | 'mine'>('builtin')

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<BuiltinCommandCategory | '全部'>('全部')
  const [selectedId, setSelectedId] = useState<string>(BUILTIN[0]?.id || '')

  const [copiedText, setCopiedText] = useState<string | null>(null)

  // User snippets
  const [snippetsLoading, setSnippetsLoading] = useState(false)
  const [snippetsError, setSnippetsError] = useState<string | null>(null)
  const [snippets, setSnippets] = useState<UserSnippet[]>([])

  const [newTitle, setNewTitle] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTags, setNewTags] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredBuiltin = useMemo(() => {
    const q = normalize(query)
    return BUILTIN.filter((item) => {
      if (category !== '全部' && item.category !== category) return false
      if (!q) return true
      const hay = [
        item.title,
        item.description,
        item.command,
        item.category,
        item.tags.join(' '),
        item.examples.join(' '),
        (item.related || []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [query, category])

  const selectedBuiltin = useMemo(() => {
    return filteredBuiltin.find((x) => x.id === selectedId) || filteredBuiltin[0] || null
  }, [filteredBuiltin, selectedId])

  useEffect(() => {
    if (!selectedBuiltin && filteredBuiltin[0]) setSelectedId(filteredBuiltin[0].id)
    if (selectedBuiltin && selectedBuiltin.id !== selectedId) setSelectedId(selectedBuiltin.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBuiltin.length])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 1200)
  }

  const loadSnippets = async () => {
    if (!user) return
    setSnippetsLoading(true)
    setSnippetsError(null)
    try {
      const { data, error } = await supabase
        .from('command_snippets')
        .select('id,user_id,title,command,description,tags,created_at,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setSnippets((data || []) as UserSnippet[])
    } catch (e: any) {
      setSnippetsError(e.message || '加载失败')
    } finally {
      setSnippetsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'mine') loadSnippets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id])

  const handleCreateSnippet = async () => {
    if (!user) return
    const title = newTitle.trim()
    const command = newCommand.trim()
    if (!title || !command) return

    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        title,
        command,
        description: newDesc.trim() || null,
        tags: parseTags(newTags),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('command_snippets').insert(payload)
      if (error) throw error
      setNewTitle('')
      setNewCommand('')
      setNewDesc('')
      setNewTags('')
      await loadSnippets()
    } catch (e: any) {
      setSnippetsError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSnippet = async (id: string) => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase.from('command_snippets').delete().eq('id', id)
      if (error) throw error
      await loadSnippets()
    } catch (e: any) {
      setSnippetsError(e.message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">Linux 指令检索</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={tab === 'builtin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('builtin')}
          >
            指令库
          </Button>
          <Button
            variant={tab === 'mine' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('mine')}
          >
            我的指令
          </Button>
        </div>
      </div>

      {tab === 'builtin' ? (
        <>
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索命令/参数/关键词（例如：grep、端口、vim 替换）"
              className="bg-muted/30"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="h-9 rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="全部">全部分类</option>
              {BUILTIN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6 flex-1 min-h-0">
            <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
                <span>结果 {filteredBuiltin.length} 条</span>
                <span className="hidden sm:inline">点击查看详情</span>
              </div>
              <div className="overflow-auto max-h-[60vh]">
                {filteredBuiltin.map((item) => (
                  <button
                    key={item.id}
                    className={cn(
                      'w-full text-left px-3 py-3 border-b border-border/60 hover:bg-muted/30 transition-colors',
                      selectedId === item.id && 'bg-primary/10'
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 font-mono">{item.command}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{item.category}</div>
                  </button>
                ))}
                {filteredBuiltin.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">没有匹配结果</div>
                )}
              </div>
            </div>

            <div className="border border-border rounded-lg bg-muted/10 p-4 overflow-auto min-h-[240px]">
              {selectedBuiltin ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-foreground">{selectedBuiltin.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{selectedBuiltin.description}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copy(selectedBuiltin.command)}
                        className="shrink-0"
                      >
                        {copiedText === selectedBuiltin.command ? (
                          <Check className="w-4 h-4 mr-2 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        复制
                      </Button>
                    </div>
                  </div>

                  <div className="glass-card p-4 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-2">常用写法</div>
                    <div className="space-y-2">
                      {selectedBuiltin.examples.map((ex) => (
                        <div key={ex} className="flex items-start justify-between gap-3">
                          <pre className="flex-1 bg-black/20 border border-border/60 rounded p-2 text-xs font-mono overflow-auto">
                            {ex}
                          </pre>
                          <button
                            className={cn(
                              'text-xs px-2 py-1 rounded border border-border hover:border-primary/60 hover:text-primary transition-colors',
                              copiedText === ex && 'border-primary/60 text-primary'
                            )}
                            onClick={() => copy(ex)}
                          >
                            {copiedText === ex ? '已复制' : '复制'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedBuiltin.tags.map((t) => (
                      <span key={t} className="text-[11px] px-2 py-1 rounded-full border border-border bg-muted/30 text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>

                  {selectedBuiltin.related && selectedBuiltin.related.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      联动建议：<span className="text-foreground">{selectedBuiltin.related.join(' / ')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">请选择一条指令查看详情</div>
              )}
            </div>
          </div>

          <div className="glass-card p-4 rounded-lg border-primary/10">
            <div className="text-sm font-bold text-primary mb-2 italic">扩展 / 联动用法</div>
            <div className="text-xs text-muted-foreground">
              指令往往需要组合使用：例如 <span className="font-mono text-foreground">find</span> + <span className="font-mono text-foreground">xargs</span> + <span className="font-mono text-foreground">grep</span> 可以实现对海量文件的批量检索；
              端口排查常用 <span className="font-mono text-foreground">ss</span> / <span className="font-mono text-foreground">lsof</span> 配合 <span className="font-mono text-foreground">kill</span>。
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6 flex-1 min-h-0">
          <div className="border border-border rounded-lg bg-muted/10 p-4 space-y-3">
            {!user ? (
              <div className="text-sm text-muted-foreground">请先登录后使用“我的指令”。</div>
            ) : (
              <>
                <div className="text-sm font-bold text-foreground flex items-center justify-between">
                  新增自定义指令
                  <span className="text-[11px] text-muted-foreground">绑定当前用户</span>
                </div>
                <div className="space-y-2">
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="标题（例如：查找 1 天内日志并过滤 ERROR）" className="bg-muted/30" />
                  <Input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="命令（例如：find /var/log -mtime -1 -type f | xargs grep -n ERROR）" className="bg-muted/30 font-mono" />
                  <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="说明（可选）" className="bg-muted/30" />
                  <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="标签（逗号分隔，例如：日志,grep,find）" className="bg-muted/30" />
                </div>
                <Button onClick={handleCreateSnippet} disabled={saving || !newTitle.trim() || !newCommand.trim()} className="w-full">
                  {saving ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  保存到云端
                </Button>
                {snippetsError && <div className="text-xs text-red-400">{snippetsError}</div>}
              </>
            )}
          </div>

          <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-bold text-foreground">我的指令</div>
              <button className="text-xs text-muted-foreground hover:text-primary" onClick={loadSnippets} disabled={!user || snippetsLoading}>
                刷新
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {!user ? (
                <div className="p-6 text-sm text-muted-foreground">登录后可保存并跨设备同步自定义指令。</div>
              ) : snippetsLoading ? (
                <div className="p-6 text-sm text-muted-foreground">加载中...</div>
              ) : snippets.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">暂无自定义指令</div>
              ) : (
                <div className="divide-y divide-border/60">
                  {snippets.map((s) => (
                    <div key={s.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{s.title}</div>
                          {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => copy(s.command)}>
                            {copiedText === s.command ? <Check className="w-4 h-4 mr-2 text-primary" /> : <Copy className="w-4 h-4 mr-2" />}
                            复制
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20"
                            onClick={() => handleDeleteSnippet(s.id)}
                            disabled={saving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <pre className="bg-black/20 border border-border/60 rounded p-3 text-xs font-mono overflow-auto">{s.command}</pre>
                      {s.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[11px] px-2 py-1 rounded-full border border-border bg-muted/30 text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
