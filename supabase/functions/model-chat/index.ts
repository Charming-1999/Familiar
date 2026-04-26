import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: '仅支持 POST 请求。' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const authorization = request.headers.get('Authorization') || ''

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Supabase 服务配置缺失。' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) {
    return jsonResponse(401, { error: '请先登录后再使用模型对话。' })
  }

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('is_activated')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile?.is_activated) {
    return jsonResponse(403, { error: '账号未激活，无法调用模型对话。' })
  }

  const body = await request.json().catch(() => ({}))
  const model = typeof body?.model === 'string' ? body.model : 'gemini-3-flash'
  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((item: any) => typeof item?.role === 'string' && typeof item?.content === 'string')
        .map((item: any) => ({ role: item.role, content: item.content }))
    : []

  if (!messages.length) {
    return jsonResponse(400, { error: '消息列表不能为空。' })
  }

  const { data: configRows, error: configError } = await adminClient
    .from('system_configs')
    .select('key, value')
    .in('key', ['model_chat_api_url', 'model_chat_api_key'])

  if (configError) {
    return jsonResponse(500, { error: '读取模型配置失败。' })
  }

  const configMap = Object.fromEntries((configRows || []).map((item) => [item.key, item.value]))
  const apiUrl = typeof configMap.model_chat_api_url === 'string' ? configMap.model_chat_api_url.trim() : ''
  const apiKey = typeof configMap.model_chat_api_key === 'string' ? configMap.model_chat_api_key.trim() : ''

  if (!apiUrl || !apiKey) {
    return jsonResponse(500, { error: '模型代理配置不完整。' })
  }

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
  })

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const text = await upstreamResponse.text().catch(() => '')
    return jsonResponse(upstreamResponse.status || 502, { error: text || '模型上游服务返回异常。' })
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      ...corsHeaders,
      'Content-Type': upstreamResponse.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
})
