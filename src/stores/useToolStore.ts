import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

interface ToolState {
  favorites: string[] // ordered
  userId: string | null

  bindUser: (userId: string | null) => Promise<void>
  toggleFavorite: (id: string) => void
  moveFavorite: (sourceId: string, targetId: string) => void
  pinToTop: (id: string) => void
  isFavorite: (id: string) => boolean
}

type PrefRow = {
  user_id: string
  favorites: any
  updated_at: string
}

function normalizeFavorites(raw: any): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    if (!out.includes(v)) out.push(v)
  }
  return out
}

export const useToolStore = create<ToolState>()(
  persist(
    (set, get) => {
      let saveTimer: number | null = null

      const scheduleCloudSave = () => {
        const { userId, favorites } = get()
        if (!userId) return

        if (saveTimer != null) window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(async () => {
          saveTimer = null
          try {
            await supabase
              .from('user_tool_preferences')
              .upsert({
                user_id: userId,
                favorites,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' })
          } catch (e) {
            console.warn('Failed to save tool preferences to cloud:', e)
          }
        }, 600)
      }

      const setFavorites = (next: string[]) => {
        set({ favorites: next })
        scheduleCloudSave()
      }

      return {
        favorites: [],
        userId: null,

        bindUser: async (userId) => {
          set({ userId })
          if (!userId) return

          try {
            const { data, error } = await supabase
              .from('user_tool_preferences')
              .select('user_id,favorites,updated_at')
              .eq('user_id', userId)
              .maybeSingle()

            if (error) throw error

            const local = get().favorites
            const cloud = data ? normalizeFavorites((data as PrefRow).favorites) : []

            // merge: cloud order first, then local additions
            const merged = [...cloud]
            for (const id of local) {
              if (!merged.includes(id)) merged.push(id)
            }

            set({ favorites: merged })

            // if cloud missing row or differs, persist back
            if (!data || JSON.stringify(cloud) !== JSON.stringify(merged)) {
              scheduleCloudSave()
            }
          } catch (e) {
            console.warn('Failed to load tool preferences from cloud:', e)
          }
        },

        toggleFavorite: (id) => {
          const { favorites } = get()
          if (favorites.includes(id)) {
            setFavorites(favorites.filter((fid) => fid !== id))
          } else {
            setFavorites([...favorites, id])
          }
        },

        moveFavorite: (sourceId, targetId) => {
          const { favorites } = get()
          if (sourceId === targetId) return
          const from = favorites.indexOf(sourceId)
          const to = favorites.indexOf(targetId)
          if (from < 0 || to < 0) return

          const next = [...favorites]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          setFavorites(next)
        },

        pinToTop: (id) => {
          const { favorites } = get()
          if (!favorites.includes(id)) return
          const next = [id, ...favorites.filter((fid) => fid !== id)]
          setFavorites(next)
        },

        isFavorite: (id) => get().favorites.includes(id),
      }
    },
    {
      name: 'geek-toolbox-tools',
      partialize: (state) => ({ favorites: state.favorites }),
    }
  )
)
