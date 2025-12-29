import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  profile: {
    is_activated: boolean
    email: string | null
  } | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => {
    set({ user })
    if (user) {
      get().fetchProfile(user.id)
    } else {
      set({ profile: null, loading: false })
    }
  },

  fetchProfile: async (userId) => {
    console.log('[fetchProfile] START', { userId, timestamp: Date.now() })
    const hadProfile = !!get().profile
    if (!hadProfile) set({ loading: true })

    const fetchOnce = async () => {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 8000)
      try {
        console.log('[fetchProfile] Sending request...', Date.now())
        const q: any = supabase.from('user_profiles').select('is_activated, email').eq('id', userId).single()
        const { data, error } = await (typeof q.abortSignal === 'function' ? q.abortSignal(controller.signal) : q)
        console.log('[fetchProfile] Response received', { data, error, timestamp: Date.now() })
        if (error) throw error
        set({ profile: data, loading: false })
        return true
      } finally {
        window.clearTimeout(timer)
      }
    }

    let retries = 3
    while (retries > 0) {
      try {
        const ok = await fetchOnce()
        if (ok) {
          console.log('[fetchProfile] SUCCESS', Date.now())
          return
        }
      } catch (error) {
        console.error(`[fetchProfile] Error (retries left: ${retries - 1}):`, error)
        retries--
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }

    console.log('[fetchProfile] FAILED after retries', Date.now())
    set({ loading: false })
  },




  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  initialize: async () => {
    if (get().initialized) return

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user })
      await get().fetchProfile(session.user.id)
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[onAuthStateChange]', { 
        event, 
        userId: session?.user?.id, 
        hasProfile: !!get().profile,
        timestamp: Date.now() 
      })
      if (session?.user) {
        const prevUserId = get().user?.id
        set({ user: session.user, initialized: true })

        // CRITICAL: Skip fetchProfile on tab focus recovery to avoid blocking other requests
        // Only fetch profile on true auth changes (initial load, user change, explicit update)
        const shouldFetch =
          (event === 'INITIAL_SESSION' && !get().profile) ||
          event === 'USER_UPDATED' ||
          (prevUserId && prevUserId !== session.user.id)

        console.log('[onAuthStateChange] shouldFetch?', shouldFetch, { event, hasProfile: !!get().profile })
        
        if (shouldFetch) {
          await get().fetchProfile(session.user.id)
        }
      } else {
        set({ user: null, profile: null, initialized: true, loading: false })
      }
    })

    set({ initialized: true, loading: false })
  }
}))

