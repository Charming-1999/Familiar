import { supabase } from './supabase'

export type SystemConfigRecord = {
  key: string
  label: string
  value: string
  category: string
  description: string | null
  is_secret: boolean
  updated_at: string
  updated_by: string | null
  created_at: string
}

export type ActivationCodeRecord = {
  id: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  used_at: string | null
  used_by: string | null
}

export type SystemConfigInput = {
  key: string
  label: string
  value: string
  category: string
  description: string
  is_secret: boolean
  updated_by?: string | null
}

export type VideoParseResult = {
  type: string
  title: string
  cover: string
  url: string
  imageList: string[]
  sourceUrl: string
}

export type ChatApiRole = 'system' | 'user' | 'assistant'

export type ChatApiMessage = {
  role: ChatApiRole
  content: string
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const API_BASE_PATH = '/api'

function buildActivationCodes(quantity: number) {
  const normalized = Math.min(20, Math.max(1, Math.floor(quantity || 1)))
  const codes = new Set<string>()

  while (codes.size < normalized) {
    const code = Array.from({ length: 10 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    codes.add(code)
  }

  return [...codes]
}

async function getFunctionHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function parseResponseText(text: string, fallback: string) {
  if (!text) return fallback
  try {
    const json = JSON.parse(text)
    return json?.error || json?.message || json?.msg || fallback
  } catch {
    return text
  }
}

function normalizeVideoResult(payload: any): VideoParseResult {
  const content = payload?.result || payload?.content || payload || {}
  const imageList = Array.isArray(content?.imageList) ? content.imageList.filter((item: unknown) => typeof item === 'string' && item.trim()) : []
  return {
    type: typeof content?.type === 'string' ? content.type : 'UNKNOWN',
    title: typeof content?.title === 'string' ? content.title : '',
    cover: typeof content?.cover === 'string' ? content.cover : '',
    url: typeof content?.url === 'string' ? content.url : '',
    imageList,
    sourceUrl: typeof content?.sourceUrl === 'string' ? content.sourceUrl : typeof content?.originText === 'string' ? content.originText : '',
  }
}

export async function parseVideoLink(link: string, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_PATH}/video-parser`, {
    method: 'POST',
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ link }),
    signal,
  })

  const text = await response.text().catch(() => '')
  if (!response.ok) throw new Error(parseResponseText(text, 'Video parse failed'))
  return normalizeVideoResult(text ? JSON.parse(text) : {})
}

export async function requestModelChatStream(args: { model: string; messages: ChatApiMessage[]; signal: AbortSignal }) {
  const response = await fetch(`${API_BASE_PATH}/model-chat`, {
    method: 'POST',
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ model: args.model, messages: args.messages }),
    signal: args.signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(parseResponseText(text, `Request failed (${response.status})`))
  }

  return response
}

export type AsrSubmitOptions = {
  audioUrl: string
  audioFormat: string
  language?: string
  enableItn?: boolean
  enablePunc?: boolean
  enableDdc?: boolean
  enableSpeakerInfo?: boolean
  enableEmotionDetection?: boolean
  enableGenderDetection?: boolean
  enableLid?: boolean
  showUtterances?: boolean
  showSpeechRate?: boolean
  showVolume?: boolean
}

export type AsrUtterance = {
  text: string
  start_time: number
  end_time: number
  speaker?: string
  emotion?: string
  gender?: string
  speech_rate?: number
  volume?: number
  additions?: Record<string, unknown>
}

export type AsrQueryResult = {
  ok: boolean
  status: 'running' | 'completed' | 'failed'
  result?: { text?: string; utterances?: AsrUtterance[] }
  error?: string
}

export async function submitAsrTask(options: AsrSubmitOptions, signal?: AbortSignal) {
  const { audioUrl, audioFormat, language, ...flags } = options
  const response = await fetch(`${API_BASE_PATH}/asr-submit`, {
    method: 'POST',
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ audioUrl, audioFormat, language, options: flags }),
    signal,
  })

  const text = await response.text().catch(() => '')
  if (!response.ok) throw new Error(parseResponseText(text, 'ASR submit failed'))
  const json = text ? JSON.parse(text) : {}
  if (!json.requestId) throw new Error('Missing request ID from server')
  return { requestId: json.requestId as string }
}

export async function queryAsrResult(requestId: string, signal?: AbortSignal): Promise<AsrQueryResult> {
  const response = await fetch(`${API_BASE_PATH}/asr-query`, {
    method: 'POST',
    headers: await getFunctionHeaders(),
    body: JSON.stringify({ requestId }),
    signal,
  })

  const text = await response.text().catch(() => '')
  if (!response.ok) throw new Error(parseResponseText(text, 'ASR query failed'))
  return text ? JSON.parse(text) : { ok: false, status: 'failed', error: 'Empty response' }
}

export async function listSystemConfigs() {
  const { data, error } = await supabase
    .from('system_configs')
    .select('key, label, value, category, description, is_secret, updated_at, updated_by, created_at')
    .order('category', { ascending: true })
    .order('key', { ascending: true })

  if (error) throw error
  return (data || []) as SystemConfigRecord[]
}

export async function upsertSystemConfig(input: SystemConfigInput) {
  const payload = {
    key: input.key.trim(),
    label: input.label.trim(),
    value: input.value,
    category: input.category.trim() || 'general',
    description: input.description.trim() || null,
    is_secret: input.is_secret,
    updated_at: new Date().toISOString(),
    updated_by: input.updated_by || null,
  }

  const { data, error } = await supabase
    .from('system_configs')
    .upsert(payload, { onConflict: 'key' })
    .select('key, label, value, category, description, is_secret, updated_at, updated_by, created_at')
    .single()

  if (error) throw error
  return data as SystemConfigRecord
}

export async function deleteSystemConfig(key: string) {
  const { error } = await supabase.from('system_configs').delete().eq('key', key)
  if (error) throw error
}

export async function listActivationCodes() {
  const { data, error } = await supabase
    .from('activation_codes')
    .select('id, code, description, is_active, created_at, updated_at, used_at, used_by')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ActivationCodeRecord[]
}

export async function createActivationCodes(quantity: number, description: string) {
  const rows = buildActivationCodes(quantity).map((code) => ({
    code,
    description: description.trim() || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('activation_codes')
    .insert(rows)
    .select('id, code, description, is_active, created_at, updated_at, used_at, used_by')

  if (error) throw error
  return (data || []) as ActivationCodeRecord[]
}

export async function updateActivationCode(id: string, patch: Partial<Pick<ActivationCodeRecord, 'description' | 'is_active'>>) {
  const payload = {
    ...(patch.description !== undefined
      ? { description: typeof patch.description === 'string' ? patch.description.trim() || null : null }
      : {}),
    ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('activation_codes')
    .update(payload)
    .eq('id', id)
    .select('id, code, description, is_active, created_at, updated_at, used_at, used_by')
    .single()

  if (error) throw error
  return data as ActivationCodeRecord
}

export async function deleteActivationCode(id: string) {
  const { error } = await supabase.from('activation_codes').delete().eq('id', id)
  if (error) throw error
}
