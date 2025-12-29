import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Bot, Send, Square, Trash2, Plus, MessagesSquare } from 'lucide-react'
import { Button } from '../components/Button'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'

type ChatRole = 'system' | 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: Exclude<ChatRole, 'system'>
  content: string
  think?: string | null
  createdAt: number
}

type Conversation = {
  id: string
  title: string
  updated_at: string
  created_at: string
}

const API_URL = 'https://grsaiapi.com/v1/chat/completions'
const API_KEY = 'sk-f7c46d4aec1b4497bbd043979bb348b4'

type ModelId = 'gemini-3-pro' | 'gemini-3-flash'

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function extractDeltaContent(payload: any): string {
  const choice = payload?.choices?.[0]
  return choice?.delta?.content || choice?.message?.content || payload?.delta?.content || payload?.message?.content || ''
}

type StreamIterCb = (chunk: string) => void

type StreamResult = {
  finishReason?: string | null
}

async function streamChatCompletion(args: {
  model: ModelId
  messages: Array<{ role: ChatRole; content: string }>
  signal: AbortSignal
  onDelta: StreamIterCb
}): Promise<StreamResult> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: args.model,
      stream: true,
      messages: args.messages,
    }),
    signal: args.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `请求失败（${res.status}）`)
  }

  if (!res.body) {
    const text = await res.text().catch(() => '')
    try {
      const json = JSON.parse(text)
      const content = extractDeltaContent(json)
      if (content) args.onDelta(content)
      return { finishReason: json?.choices?.[0]?.finish_reason ?? null }
    } catch {
      if (text) args.onDelta(text)
      return { finishReason: null }
    }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''
  let finishReason: string | null | undefined = null
  let sseDataParts: string[] = []

  const looksLikeJsonOrFragment = (s: string) => {
    const t = s.trim()
    return t.startsWith('{') || t.startsWith('[') || t.includes('"choices"') || t.includes('"delta"') || t.includes('"message"')
  }

  const handleData = (data: string) => {
    const t = data.trim()
    if (!t) return
    if (t === '[DONE]') {
      finishReason = finishReason ?? 'stop'
      return
    }

    try {
      const payload = JSON.parse(t)
      const delta = extractDeltaContent(payload)
      if (delta) args.onDelta(delta)
      finishReason = payload?.choices?.[0]?.finish_reason ?? finishReason
      return
    } catch {
      if (!looksLikeJsonOrFragment(t)) {
        args.onDelta(t)
      }
    }
  }

  const dispatchSseEvent = () => {
    if (sseDataParts.length === 0) return
    const joined = sseDataParts.join('\n')
    sseDataParts = []
    handleData(joined)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const nl = buffer.indexOf('\n')
      if (nl < 0) break

      let line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)

      if (line === '') {
        dispatchSseEvent()
        continue
      }

      if (line.startsWith('data:')) {
        sseDataParts.push(line.slice('data:'.length).trimStart())
        continue
      }

      // ignore SSE metadata/comment lines
      if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:') || line.startsWith(':')) {
        continue
      }

      // some servers may omit `data:` on continuation lines
      if (sseDataParts.length) {
        sseDataParts.push(line)
        continue
      }

      // non-SSE / NDJSON line
      handleData(line)
    }
  }

  // flush remaining buffer
  if (buffer) {
    let line = buffer
    if (line.endsWith('\r')) line = line.slice(0, -1)

    if (line === '') {
      dispatchSseEvent()
    } else if (line.startsWith('data:')) {
      sseDataParts.push(line.slice('data:'.length).trimStart())
    } else if (sseDataParts.length) {
      sseDataParts.push(line)
    } else {
      handleData(line)
    }
  }

  dispatchSseEvent()

  return { finishReason }
}


type ThinkParseState = {
  mode: 'content' | 'think'
  buffer: string
}

function createThinkParser(): ThinkParseState {
  return { mode: 'content', buffer: '' }
}

function feedThinkParser(state: ThinkParseState, delta: string): { contentAdd: string; thinkAdd: string } {
  state.buffer += delta
  let contentAdd = ''
  let thinkAdd = ''

  const START = '<think>'
  const END = '</think>'

  while (state.buffer.length) {
    if (state.mode === 'content') {
      const idx = state.buffer.indexOf(START)
      if (idx >= 0) {
        contentAdd += state.buffer.slice(0, idx)
        state.buffer = state.buffer.slice(idx + START.length)
        state.mode = 'think'
        continue
      }

      const keep = Math.min(state.buffer.length, START.length - 1)
      if (state.buffer.length > keep) {
        contentAdd += state.buffer.slice(0, state.buffer.length - keep)
        state.buffer = state.buffer.slice(state.buffer.length - keep)
      }
      break
    } else {
      const idx = state.buffer.indexOf(END)
      if (idx >= 0) {
        thinkAdd += state.buffer.slice(0, idx)
        state.buffer = state.buffer.slice(idx + END.length)
        state.mode = 'content'
        continue
      }

      const keep = Math.min(state.buffer.length, END.length - 1)
      if (state.buffer.length > keep) {
        thinkAdd += state.buffer.slice(0, state.buffer.length - keep)
        state.buffer = state.buffer.slice(state.buffer.length - keep)
      }
      break
    }
  }

  return { contentAdd, thinkAdd }
}

function flushThinkParser(state: ThinkParseState): { contentAdd: string; thinkAdd: string } {
  const rest = state.buffer
  state.buffer = ''
  if (!rest) return { contentAdd: '', thinkAdd: '' }
  return state.mode === 'think' ? { contentAdd: '', thinkAdd: rest } : { contentAdd: rest, thinkAdd: '' }
}

function clampTitle(s: string) {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length ? t.slice(0, 30) : '新对话'
}

function TypingIndicator(props: { label?: string }) {
  const label = props.label ?? '正在生成'
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground select-none">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  )
}

export const ModelChatTool: React.FC = () => {
  const { user } = useAuthStore()

  const [model, setModel] = useState<ModelId>('gemini-3-flash')

  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)

  const assistantContentRef = useRef('')
  const assistantThinkRef = useRef('')


  const apiMessages = useMemo(() => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as ChatRole, content: m.content }))
  }, [messages])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  const loadConversations = async () => {

    if (!user) return
    setConversationsLoading(true)
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id,title,updated_at,created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setConversations((data || []) as Conversation[])
      if (!activeConversationIdRef.current && (data?.[0]?.id || null)) {
        setActiveConversationId(data![0].id)
      }

    } catch (e: any) {
      setError(e?.message || '加载会话失败')
    } finally {
      setConversationsLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    if (!user) return
    setMessagesLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id,role,content,think,created_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const list = (data || []).map((r: any) => ({
        id: r.id,
        role: r.role,
        content: r.content || '',
        think: r.think ?? null,
        createdAt: new Date(r.created_at).getTime(),
      })) as ChatMessage[]

      setMessages(list)
    } catch (e: any) {
      setError(e?.message || '加载消息失败')
    } finally {
      setMessagesLoading(false)
    }
  }

  const createConversation = async (): Promise<Conversation | null> => {
    if (!user) return null
    setError(null)
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: '新对话', updated_at: new Date().toISOString() })
        .select('id,title,updated_at,created_at')
        .single()

      if (error) throw error
      const conv = data as Conversation

      setConversations((prev) => [conv, ...prev].slice(0, 20))
      setActiveConversationId(conv.id)
      setMessages([])

      // keep only latest 20 windows in DB
      const { data: extra } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(20, 200)

      const extraIds = (extra || []).map((x: any) => x.id).filter(Boolean)
      if (extraIds.length) {
        await supabase.from('chat_conversations').delete().in('id', extraIds)
      }

      return conv
    } catch (e: any) {
      setError(e?.message || '新建会话失败')
      return null
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!user) return
    const ok = window.confirm('确定删除这个对话窗口吗？删除后不可恢复。')
    if (!ok) return

    setError(null)
    try {
      const { error } = await supabase.from('chat_conversations').delete().eq('id', conversationId).eq('user_id', user.id)
      if (error) throw error

      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      if (activeConversationId === conversationId) {
        const nextId = conversations.find((c) => c.id !== conversationId)?.id || null
        setActiveConversationId(nextId)
        setMessages([])
      }
    } catch (e: any) {
      setError(e?.message || '删除失败')
    }
  }

  useEffect(() => {
    if (!user) {
      setConversations([])
      setActiveConversationId(null)
      setMessages([])
      return
    }
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    const onVisible = (e?: Event) => {
      if (e?.type === 'focus' || document.visibilityState === 'visible') {
        requestAnimationFrame(() => {
          loadConversations()
          const cid = activeConversationIdRef.current
          if (cid) loadMessages(cid)
        })
      }
    }

    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user || !activeConversationId) {
      setMessages([])
      return
    }
    loadMessages(activeConversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeConversationId])


  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, sending])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
  }

  const clearLocal = () => {
    stop()
    setError(null)
    setMessages([])
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    if (!user) {
      setError('请先登录后使用对话记录功能')
      return
    }

    setError(null)
    setSending(true)

    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation()
      convId = conv?.id || null
    }

    if (!convId) {
      setSending(false)
      return
    }

    const now = new Date().toISOString()

    // persist user message
    const { data: userRow, error: userInsertError } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: convId, user_id: user.id, role: 'user', content: text, created_at: now })
      .select('id,created_at')
      .single()

    if (userInsertError) {
      setError(userInsertError.message || '发送失败')
      setSending(false)
      return
    }

    const userMsg: ChatMessage = {
      id: userRow?.id || uid(),
      role: 'user',
      content: text,
      createdAt: userRow?.created_at ? new Date(userRow.created_at).getTime() : Date.now(),
    }

    const assistantLocalId = uid()
    const assistantMsg: ChatMessage = { id: assistantLocalId, role: 'assistant', content: '', think: '', createdAt: Date.now() }

    assistantContentRef.current = ''
    assistantThinkRef.current = ''

    setInput('')
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const controller = new AbortController()
    abortRef.current = controller

    const parser = createThinkParser()

    const base = [...apiMessages, { role: 'user' as const, content: text }]
    const context = base.slice(-20)

    try {
      await streamChatCompletion({
        model,
        messages: context,
        signal: controller.signal,
        onDelta: (delta) => {
          const { contentAdd, thinkAdd } = feedThinkParser(parser, delta)
          if (!contentAdd && !thinkAdd) return

          assistantContentRef.current += contentAdd
          assistantThinkRef.current += thinkAdd

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantLocalId
                ? {
                    ...m,
                    content: assistantContentRef.current,
                    think: assistantThinkRef.current,
                  }
                : m
            )
          )
        },
      })

      // flush remaining buffer (we keep a few chars to detect `<think>`/`</think>` across chunks)
      const tail = flushThinkParser(parser)
      if (tail.contentAdd || tail.thinkAdd) {
        assistantContentRef.current += tail.contentAdd
        assistantThinkRef.current += tail.thinkAdd
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantLocalId
              ? {
                  ...m,
                  content: assistantContentRef.current,
                  think: assistantThinkRef.current,
                }
              : m
          )
        )
      }

    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || '请求失败')
      }
    } finally {
      abortRef.current = null
      setSending(false)

      const finalContent = assistantContentRef.current
      const finalThink = assistantThinkRef.current

      if (finalContent || finalThink) {
        await supabase.from('chat_messages').insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'assistant',
          content: finalContent || '',
          think: finalThink || null,
        })

        const title = clampTitle(text)
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString(), title })
          .eq('id', convId)
          .eq('user_id', user.id)

        await loadConversations()
      }
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">模型对话</h2>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            className="h-9 rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            disabled={sending}
          >
            <option value="gemini-3-flash">gemini-3-flash</option>
            <option value="gemini-3-pro">gemini-3-pro</option>
          </select>

          <Button variant="outline" size="sm" onClick={clearLocal} disabled={sending} className="space-x-1">
            <Trash2 className="w-4 h-4" />
            <span>清空</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={stop}
            disabled={!sending}
            className={cn('space-x-1', sending ? 'border-red-400/30 text-red-300 hover:text-red-200 hover:bg-red-400/10' : '')}
          >
            <Square className="w-4 h-4" />
            <span>停止</span>
          </Button>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-400 border border-red-400/20 rounded-lg bg-red-500/5">{error}</div>}

      {!user ? (
        <div className="glass-card p-6 rounded-lg text-sm text-muted-foreground">
          请先登录后使用“模型对话”。历史对话会保存到云端（最近 20 个对话窗口）。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 flex-1 min-h-0">
          <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessagesSquare className="w-4 h-4 text-primary" />
                对话窗口
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={loadConversations}
                  disabled={conversationsLoading}
                >
                  刷新
                </button>
                <Button size="sm" onClick={createConversation} disabled={sending} className="space-x-1">
                  <Plus className="w-4 h-4" />
                  <span>新建</span>
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {conversationsLoading ? (
                <div className="p-4 text-sm text-muted-foreground">加载中...</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">暂无对话窗口，点击“新建”开始。</div>
              ) : (
                <div className="divide-y divide-border/60">
                  {conversations.map((c) => {
                    const active = c.id === activeConversationId
                    return (
                      <div key={c.id} className={cn('px-3 py-3 flex items-center justify-between gap-2', active && 'bg-primary/10')}>
                        <button className="flex-1 min-w-0 text-left" onClick={() => setActiveConversationId(c.id)}>
                          <div className="text-sm font-semibold text-foreground truncate">{c.title || '新对话'}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 truncate">{new Date(c.updated_at).toLocaleString()}</div>
                        </button>
                        <button
                          className="text-xs text-red-400 hover:text-red-500"
                          onClick={() => deleteConversation(c.id)}
                          title="删除"
                        >
                          删除
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-muted/10 overflow-hidden flex flex-col min-h-0">
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
              {!activeConversationId ? (
                <div className="p-4 text-sm text-muted-foreground">请选择一个对话窗口，或点击左侧“新建”。</div>
              ) : messagesLoading ? (
                <div className="p-4 text-sm text-muted-foreground">加载中...</div>
              ) : messages.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">开始对话吧。</div>
              ) : (
                messages.map((m, idx) => {
                  const isUser = m.role === 'user'
                  const isLast = idx === messages.length - 1
                  const showTyping = !isUser && sending && isLast && !m.content

                  return (
                    <div key={m.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-4 py-3 text-sm border',

                          isUser
                            ? 'bg-primary/15 border-primary/20 text-foreground'
                            : 'bg-background/30 border-border text-foreground'
                        )}
                      >
                        {!isUser && m.think?.trim() ? (
                          <details className="mb-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">思考过程</summary>
                            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-black/20 border border-border/60 rounded p-2 overflow-auto">
                              {m.think}
                            </pre>
                          </details>
                        ) : null}

                        <div className={cn('markdown', isUser ? 'markdown-user' : '')}>
                          {showTyping ? <TypingIndicator /> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-border p-3">
              <textarea
                className="w-full h-24 bg-muted/10 border border-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="输入内容，Enter 发送，Shift+Enter 换行"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                disabled={sending}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-[11px] text-muted-foreground">流式输出 + think 适配已开启</div>
                <Button onClick={send} disabled={sending || !input.trim()} className="space-x-1">
                  <Send className="w-4 h-4" />
                  <span>发送</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
