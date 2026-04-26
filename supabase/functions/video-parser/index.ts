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

function normalizeContent(content: any, sourceUrl: string) {
  const imageList = Array.isArray(content?.imageList) ? content.imageList.filter((item: unknown) => typeof item === 'string' && item.trim()) : []
  return {
    type: typeof content?.type === 'string' ? content.type : 'UNKNOWN',
    title: typeof content?.title === 'string' ? content.title : '',
    cover: typeof content?.cover === 'string' ? content.cover : '',
    url: typeof content?.url === 'string' ? content.url : '',
    imageList,
    sourceUrl,
  }
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
    return jsonResponse(401, { error: '请先登录后再使用视频解析。' })
  }

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('is_activated')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile?.is_activated) {
    return jsonResponse(403, { error: '账号未激活，无法调用视频解析服务。' })
  }

  const body = await request.json().catch(() => ({}))
  const link = typeof body?.link === 'string' ? body.link.trim() : ''
  if (!link) {
    return jsonResponse(400, { error: '请输入要解析的链接。' })
  }

  const { data: config, error: configError } = await adminClient
    .from('system_configs')
    .select('value')
    .eq('key', 'video_parser_ak')
    .maybeSingle()

  if (configError || !config?.value?.trim()) {
    return jsonResponse(500, { error: '视频解析密钥未配置。' })
  }

  const upstreamUrl = new URL('https://api.guijianpan.com/waterRemoveDetail/xxmQsyByAk')
  upstreamUrl.searchParams.set('ak', config.value.trim())
  upstreamUrl.searchParams.set('link', link)

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  const payload = await upstreamResponse.json().catch(() => null)
  if (!upstreamResponse.ok || payload?.code !== '10000' || !payload?.content) {
    return jsonResponse(502, { error: payload?.msg || '上游解析服务返回异常。' })
  }

  return jsonResponse(200, {
    ok: true,
    result: normalizeContent(payload.content, link),
  })
})
