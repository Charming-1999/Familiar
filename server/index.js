import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

loadDotEnv(path.join(rootDir, '.env'))

const defaultPort = process.env.NODE_ENV === 'production' ? 8080 : 8787
const port = Number(process.env.PORT || defaultPort)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return

  const source = readFileSync(filePath, 'utf8')
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 0) continue

    const key = line.slice(0, separator).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readJsonBody(req) {
  const chunks = []
  let total = 0

  for await (const chunk of req) {
    total += chunk.length
    if (total > 1024 * 1024) {
      throw new Error('Payload too large')
    }
    chunks.push(chunk)
  }

  if (!chunks.length) return {}

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

function createSupabaseClients(authorization) {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig()

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Supabase server credentials are incomplete')
  }

  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: authorization || '' },
    },
  })

  const adminClient = createClient(url, serviceRoleKey)
  return { userClient, adminClient }
}

async function requireActivatedUser(authorization) {
  const { userClient, adminClient } = createSupabaseClients(authorization)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) {
    return { status: 401, error: 'Login required' }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('is_activated')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile?.is_activated) {
    return { status: 403, error: 'Account is not activated' }
  }

  return { adminClient, user: authData.user }
}

async function readConfigValue(adminClient, key, fallback = '') {
  const { data, error } = await adminClient
    .from('system_configs')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load config: ${key}`)
  }

  const value = typeof data?.value === 'string' ? data.value.trim() : ''
  return value || fallback
}

async function readConfigValues(adminClient, keys) {
  const { data, error } = await adminClient
    .from('system_configs')
    .select('key, value')
    .in('key', keys)

  if (error) {
    throw new Error('Failed to load model config')
  }

  return Object.fromEntries(
    (data || []).map((item) => [
      item.key,
      typeof item.value === 'string' ? item.value.trim() : '',
    ]),
  )
}

function normalizeVideoResult(content, sourceUrl) {
  const imageList = Array.isArray(content?.imageList)
    ? content.imageList.filter((item) => typeof item === 'string' && item.trim())
    : []

  return {
    type: typeof content?.type === 'string' ? content.type : 'UNKNOWN',
    title: typeof content?.title === 'string' ? content.title : '',
    cover: typeof content?.cover === 'string' ? content.cover : '',
    url: typeof content?.url === 'string' ? content.url : '',
    imageList,
    sourceUrl,
  }
}

async function handleVideoParser(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const auth = await requireActivatedUser(req.headers.authorization || '')
    if ('error' in auth) {
      jsonResponse(res, auth.status, { error: auth.error })
      return
    }

    const body = await readJsonBody(req)
    const link = typeof body?.link === 'string' ? body.link.trim() : ''
    if (!link) {
      jsonResponse(res, 400, { error: 'Link is required' })
      return
    }

    const apiKey = await readConfigValue(
      auth.adminClient,
      'video_parser_ak',
      process.env.VIDEO_PARSER_AK || '',
    )

    if (!apiKey) {
      jsonResponse(res, 500, { error: 'Video parser key is not configured' })
      return
    }

    const upstreamUrl = new URL('https://api.guijianpan.com/waterRemoveDetail/xxmQsyByAk')
    upstreamUrl.searchParams.set('ak', apiKey)
    upstreamUrl.searchParams.set('link', link)

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
    })

    const payload = await upstreamResponse.json().catch(() => null)
    if (!upstreamResponse.ok || payload?.code !== '10000' || !payload?.content) {
      jsonResponse(res, 502, {
        error: payload?.msg || 'Upstream video parser request failed',
      })
      return
    }

    jsonResponse(res, 200, {
      ok: true,
      result: normalizeVideoResult(payload.content, link),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    const status = message === 'Payload too large' ? 413 : 500
    jsonResponse(res, status, { error: message })
  }
}

async function handleModelChat(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const auth = await requireActivatedUser(req.headers.authorization || '')
    if ('error' in auth) {
      jsonResponse(res, auth.status, { error: auth.error })
      return
    }

    const body = await readJsonBody(req)
    const model = typeof body?.model === 'string' ? body.model : 'gemini-3-flash'
    const messages = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (item) =>
              typeof item?.role === 'string' && typeof item?.content === 'string',
          )
          .map((item) => ({ role: item.role, content: item.content }))
      : []

    if (!messages.length) {
      jsonResponse(res, 400, { error: 'Messages are required' })
      return
    }

    const configMap = await readConfigValues(auth.adminClient, [
      'model_chat_api_url',
      'model_chat_api_key',
    ])

    const apiUrl = configMap.model_chat_api_url || process.env.MODEL_CHAT_API_URL || ''
    const apiKey = configMap.model_chat_api_key || process.env.MODEL_CHAT_API_KEY || ''

    console.log('[model-chat] apiUrl:', apiUrl ? `${apiUrl.slice(0, 40)}...` : '(empty)')
    console.log('[model-chat] apiKey:', apiKey ? `${apiKey.slice(0, 6)}...` : '(empty)')
    console.log('[model-chat] model:', model)

    if (!apiUrl || !apiKey) {
      jsonResponse(res, 500, { error: 'Model chat config is not complete' })
      return
    }

    const controller = new AbortController()
    req.on('close', () => controller.abort())

    const upstreamResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
      }),
      signal: controller.signal,
    })

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const text = await upstreamResponse.text().catch(() => '')
      jsonResponse(res, upstreamResponse.status || 502, {
        error: text || 'Upstream model chat request failed',
      })
      return
    }

    res.writeHead(upstreamResponse.status, {
      ...corsHeaders,
      'Cache-Control': 'no-cache',
      'Content-Type':
        upstreamResponse.headers.get('Content-Type') ||
        'text/event-stream; charset=utf-8',
    })

    Readable.fromWeb(upstreamResponse.body).pipe(res)
  } catch (error) {
    console.error('[model-chat] catch error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    const status = message === 'Payload too large' ? 413 : 500
    jsonResponse(res, status, { error: message })
  }
}

async function handleAsrSubmit(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const auth = await requireActivatedUser(req.headers.authorization || '')
    if ('error' in auth) {
      jsonResponse(res, auth.status, { error: auth.error })
      return
    }

    const body = await readJsonBody(req)
    const audioUrl = typeof body?.audioUrl === 'string' ? body.audioUrl.trim() : ''
    const audioFormat = typeof body?.audioFormat === 'string' ? body.audioFormat.trim() : ''

    if (!audioUrl) {
      jsonResponse(res, 400, { error: 'Audio URL is required' })
      return
    }
    if (!audioFormat) {
      jsonResponse(res, 400, { error: 'Audio format is required' })
      return
    }

    const configMap = await readConfigValues(auth.adminClient, [
      'volcengine_asr_app_key',
      'volcengine_asr_access_key',
    ])

    const appKey = configMap.volcengine_asr_app_key || process.env.VOLCENGINE_ASR_APP_KEY || ''
    const accessKey = configMap.volcengine_asr_access_key || process.env.VOLCENGINE_ASR_ACCESS_KEY || ''

    if (!appKey || !accessKey) {
      jsonResponse(res, 500, { error: 'ASR API key is not configured' })
      return
    }

    const requestId = randomUUID()
    const language = typeof body?.language === 'string' ? body.language.trim() : ''
    const options = typeof body?.options === 'object' && body.options !== null ? body.options : {}

    const audioPayload = { format: audioFormat, url: audioUrl }
    if (language) audioPayload.language = language

    const requestPayload = {
      model_name: 'bigmodel',
      enable_itn: options.enableItn ?? true,
      enable_punc: options.enablePunc ?? true,
      show_utterances: options.showUtterances ?? true,
    }
    if (options.enableDdc) requestPayload.enable_ddc = true
    if (options.enableSpeakerInfo) requestPayload.enable_speaker_info = true
    if (options.enableEmotionDetection) requestPayload.enable_emotion_detection = true
    if (options.enableGenderDetection) requestPayload.enable_gender_detection = true
    if (options.enableLid) requestPayload.enable_lid = true
    if (options.showSpeechRate) requestPayload.show_speech_rate = true
    if (options.showVolume) requestPayload.show_volume = true

    const upstreamResponse = await fetch(
      'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-App-Key': appKey,
          'X-Api-Access-Key': accessKey,
          'X-Api-Resource-Id': 'volc.seedasr.auc',
          'X-Api-Request-Id': requestId,
          'X-Api-Sequence': '-1',
        },
        body: JSON.stringify({
          user: { uid: auth.user.id },
          audio: audioPayload,
          request: requestPayload,
        }),
      },
    )

    const statusCode = upstreamResponse.headers.get('X-Api-Status-Code')
    if (statusCode !== '20000000') {
      const msg = upstreamResponse.headers.get('X-Api-Message') || 'ASR submit failed'
      jsonResponse(res, 502, { error: `ASR submit failed: ${msg} (code: ${statusCode})` })
      return
    }

    jsonResponse(res, 200, { ok: true, requestId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    const status = message === 'Payload too large' ? 413 : 500
    jsonResponse(res, status, { error: message })
  }
}

async function handleAsrQuery(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const auth = await requireActivatedUser(req.headers.authorization || '')
    if ('error' in auth) {
      jsonResponse(res, auth.status, { error: auth.error })
      return
    }

    const body = await readJsonBody(req)
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    if (!requestId) {
      jsonResponse(res, 400, { error: 'Request ID is required' })
      return
    }

    const configMap = await readConfigValues(auth.adminClient, [
      'volcengine_asr_app_key',
      'volcengine_asr_access_key',
    ])

    const appKey = configMap.volcengine_asr_app_key || process.env.VOLCENGINE_ASR_APP_KEY || ''
    const accessKey = configMap.volcengine_asr_access_key || process.env.VOLCENGINE_ASR_ACCESS_KEY || ''

    if (!appKey || !accessKey) {
      jsonResponse(res, 500, { error: 'ASR API key is not configured' })
      return
    }

    const upstreamResponse = await fetch(
      'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-App-Key': appKey,
          'X-Api-Access-Key': accessKey,
          'X-Api-Resource-Id': 'volc.seedasr.auc',
          'X-Api-Request-Id': requestId,
          'X-Api-Sequence': '-1',
        },
        body: JSON.stringify({}),
      },
    )

    const statusCode = upstreamResponse.headers.get('X-Api-Status-Code')
    const responseBody = await upstreamResponse.json().catch(() => null)

    if (statusCode === '20000000') {
      jsonResponse(res, 200, { ok: true, status: 'completed', result: responseBody })
      return
    }

    if (statusCode === '20000001' || statusCode === '20000002') {
      jsonResponse(res, 200, { ok: true, status: 'running' })
      return
    }

    const msg = upstreamResponse.headers.get('X-Api-Message') || 'ASR query failed'
    jsonResponse(res, 200, { ok: false, status: 'failed', error: `${msg} (code: ${statusCode})` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    const status = message === 'Payload too large' ? 413 : 500
    jsonResponse(res, status, { error: message })
  }
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    jsonResponse(res, 405, { error: 'Method not allowed' })
    return
  }

  if (!existsSync(distDir)) {
    jsonResponse(res, 503, { error: 'Frontend build output not found' })
    return
  }

  const safePath = pathname === '/' ? '/index.html' : pathname
  const targetPath = path.resolve(distDir, `.${safePath}`)
  if (!targetPath.startsWith(distDir)) {
    jsonResponse(res, 403, { error: 'Forbidden' })
    return
  }

  const targetExists = await fileExists(targetPath)
  const targetIsHtmlRoute = !path.extname(targetPath)
  const filePath = targetExists
    ? targetPath
    : targetIsHtmlRoute
      ? path.join(distDir, 'index.html')
      : null

  if (!filePath || !(await fileExists(filePath))) {
    jsonResponse(res, 404, { error: 'Not found' })
    return
  }

  const extension = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[extension] || 'application/octet-stream'

  res.writeHead(200, { 'Content-Type': contentType })
  if (req.method === 'HEAD') {
    res.end()
    return
  }

  createReadStream(filePath).pipe(res)
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/video-parser') {
    await handleVideoParser(req, res)
    return
  }

  if (url.pathname === '/api/model-chat') {
    await handleModelChat(req, res)
    return
  }

  if (url.pathname === '/api/asr-submit') {
    await handleAsrSubmit(req, res)
    return
  }

  if (url.pathname === '/api/asr-query') {
    await handleAsrQuery(req, res)
    return
  }

  await serveStatic(req, res, url.pathname)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`server listening on http://0.0.0.0:${port}`)
})
