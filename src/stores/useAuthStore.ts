import { create } from 'zustand'
import { type AuthChangeEvent, type User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export type UserProfile = {
  email: string | null
  is_activated: boolean
  is_super_admin: boolean
  activated_at: string | null
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  profileStatus: ProfileStatus
  profileError: string | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => Promise<void>
  fetchProfile: (userId: string) => Promise<UserProfile | null>
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

let initializePromise: Promise<void> | null = null
let authSubscription: { unsubscribe: () => void } | null = null

function normalizeProfile(row: any): UserProfile {
  return {
    email: typeof row?.email === 'string' ? row.email : null,
    is_activated: !!row?.is_activated,
    is_super_admin: !!row?.is_super_admin,
    activated_at: typeof row?.activated_at === 'string' ? row.activated_at : null,
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const applyUser = async (user: User | null) => {
    if (!user) {
      set({
        user: null,
        profile: null,
        profileStatus: 'idle',
        profileError: null,
        loading: false,
        initialized: true,
      })
      return
    }

    set({ user, loading: true, profileError: null })
    await get().fetchProfile(user.id)
    set({ user, initialized: true })
  }

  const handleAuthChange = async (event: AuthChangeEvent, user: User | null) => {
    if (!user) {
      await applyUser(null)
      return
    }

    const state = get()
    const sameUser = user.id === state.user?.id
    const hasReadyProfile =
      sameUser &&
      state.profileStatus === 'ready' &&
      state.profile != null

    // Supabase may emit auth events again when a tab regains focus or a token
    // is refreshed. Keep the cached profile for the same user to avoid turning
    // the whole app back into a loading state.
    if (hasReadyProfile) {
      set({
        user,
        profileError: null,
        loading: false,
        initialized: true,
      })
      return
    }

    if (
      event === 'INITIAL_SESSION' &&
      state.initialized &&
      sameUser &&
      state.profileStatus === 'ready'
    ) {
      return
    }

    await applyUser(user)
  }

  return {
    user: null,
    profile: null,
    profileStatus: 'idle',
    profileError: null,
    loading: true,
    initialized: false,

    setUser: applyUser,

    fetchProfile: async (userId) => {
      set({ profileStatus: 'loading', profileError: null, loading: true })

      const { data, error } = await supabase
        .from('user_profiles')
        .select('email, is_activated, is_super_admin, activated_at')
        .eq('id', userId)
        .maybeSingle()

      if (get().user?.id !== userId) {
        return null
      }

      if (error) {
        console.error('[useAuthStore] fetchProfile failed:', error)
        set({
          profile: null,
          profileStatus: 'error',
          profileError: error.message || '账户资料加载失败',
          loading: false,
        })
        return null
      }

      if (!data) {
        set({
          profile: null,
          profileStatus: 'missing',
          profileError: '账户资料未就绪，请联系管理员检查账户配置。',
          loading: false,
        })
        return null
      }

      const profile = normalizeProfile(data)
      set({
        profile,
        profileStatus: 'ready',
        profileError: null,
        loading: false,
      })
      return profile
    },

    refreshProfile: async () => {
      const user = get().user
      if (!user) {
        set({
          profile: null,
          profileStatus: 'idle',
          profileError: null,
          loading: false,
        })
        return
      }

      await get().fetchProfile(user.id)
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[useAuthStore] signOut failed:', error)
      }

      set({
        user: null,
        profile: null,
        profileStatus: 'idle',
        profileError: null,
        loading: false,
        initialized: true,
      })
    },

    initialize: async () => {
      if (get().initialized && authSubscription) {
        return
      }

      if (initializePromise) {
        return initializePromise
      }

      initializePromise = (async () => {
        set({ loading: true })

        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('[useAuthStore] getSession failed:', error)
        }

        await applyUser(data.session?.user ?? null)

        if (!authSubscription) {
          const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
            void handleAuthChange(event, session?.user ?? null)
          })
          authSubscription = authData.subscription
        }

        set({ initialized: true, loading: false })
      })().finally(() => {
        initializePromise = null
      })

      return initializePromise
    },
  }
})
