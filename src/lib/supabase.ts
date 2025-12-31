import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lmvlkaphndwtucbofhtz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmxrYXBobmR3dHVjYm9maHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Njc5NzAsImV4cCI6MjA4MjQ0Mzk3MH0.tLMOVUsY3l4lcdgK5cd7LHixP1ToxlH_WTA_Md7FN00'


if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Authentication will not work.')
}

const FETCH_TIMEOUT_MS = 60000


const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const signal = init?.signal
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
})


