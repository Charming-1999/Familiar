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
    const hadProfile = !!get().profile
    if (!hadProfile) set({ loading: true })

    const withTimeout = async <T,>(p: PromiseLike<T>, ms: number): Promise<T> => {
      return await Promise.race([
        Promise.resolve(p),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Profile request timeout')), ms)),
      ])
    }


    let retries = 3
    while (retries > 0) {
      try {
        const { data, error } = await withTimeout(
          supabase.from('user_profiles').select('is_activated, email').eq('id', userId).single(),
          8000
        )

        if (error) throw error
        set({ profile: data, loading: false })
        return
      } catch (error) {
        console.error(`Error fetching profile (retries left: ${retries - 1}):`, error)
        retries--
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }

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
      console.log('Auth state change:', event, session?.user?.id)
      if (session?.user) {
        set({ user: session.user, initialized: true })
        await get().fetchProfile(session.user.id)
      } else {
        set({ user: null, profile: null, initialized: true, loading: false })
      }
    })


    set({ initialized: true, loading: false })
  }
}))
