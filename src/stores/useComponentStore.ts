import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export type ComponentId = 'time' | 'weather' | 'theme' | 'sticky' | 'quote'

export type ComponentSubscriptions = Record<ComponentId, boolean>

interface ComponentState {
  subscriptions: ComponentSubscriptions
  userId: string | null

  bindUser: (userId: string | null) => Promise<void>
  setSubscribed: (id: ComponentId, subscribed: boolean) => void
  toggleSubscribed: (id: ComponentId) => void
  isSubscribed: (id: ComponentId) => boolean
}

type Row = {
  user_id: string
  subscriptions: any
  updated_at: string
}

const DEFAULT_SUBS: ComponentSubscriptions = {
  time: false,
  weather: false,
  theme: false,
  sticky: false,
  quote: false,
}

function normalizeSubscriptions(raw: any): ComponentSubscriptions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SUBS }
  return {
    time: typeof raw.time === 'boolean' ? raw.time : DEFAULT_SUBS.time,
    weather: typeof raw.weather === 'boolean' ? raw.weather : DEFAULT_SUBS.weather,
    theme: typeof raw.theme === 'boolean' ? raw.theme : DEFAULT_SUBS.theme,
    sticky: typeof raw.sticky === 'boolean' ? raw.sticky : DEFAULT_SUBS.sticky,
    quote: typeof raw.quote === 'boolean' ? raw.quote : DEFAULT_SUBS.quote,
  }
}

export const useComponentStore = create<ComponentState>()(
  persist(
    (set, get) => {
      let saveTimer: number | null = null

      const scheduleCloudSave = () => {
        const { userId, subscriptions } = get()
        if (!userId) return

        if (saveTimer != null) window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(async () => {
          saveTimer = null
          try {
            await supabase
              .from('user_component_subscriptions')
              .upsert(
                {
                  user_id: userId,
                  subscriptions,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
              )
          } catch (e) {
            console.warn('Failed to save component subscriptions to cloud:', e)
          }
        }, 600)
      }

      const setSubscriptions = (next: ComponentSubscriptions) => {
        set({ subscriptions: next })
        scheduleCloudSave()
      }

      return {
        subscriptions: { ...DEFAULT_SUBS },
        userId: null,

        bindUser: async (userId) => {
          set({ userId })
          if (!userId) return

          try {
            const { data, error } = await supabase
              .from('user_component_subscriptions')
              .select('user_id,subscriptions,updated_at')
              .eq('user_id', userId)
              .maybeSingle()

            if (error) throw error

            const local = get().subscriptions
            const cloud = data ? normalizeSubscriptions((data as Row).subscriptions) : null

            const merged: ComponentSubscriptions = cloud ? { ...local, ...cloud } : { ...local }
            set({ subscriptions: merged })

            if (!data || JSON.stringify(cloud) !== JSON.stringify(merged)) {
              scheduleCloudSave()
            }
          } catch (e) {
            console.warn('Failed to load component subscriptions from cloud:', e)
          }
        },

        setSubscribed: (id, subscribed) => {
          const next = { ...get().subscriptions, [id]: subscribed }
          setSubscriptions(next)
        },

        toggleSubscribed: (id) => {
          const curr = get().subscriptions[id]
          const next = { ...get().subscriptions, [id]: !curr }
          setSubscriptions(next)
        },

        isSubscribed: (id) => get().subscriptions[id],
      }
    },
    {
      name: 'geek-toolbox-components',
      partialize: (state) => ({ subscriptions: state.subscriptions }),
    }
  )
)
