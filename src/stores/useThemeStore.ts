import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeId = 'dark' | 'light' | 'pixel' | 'transparent' | 'neon' | 'minimal' | 'green' | 'deepsea' | 'cartoon'

type ThemeState = {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}

function normalizeThemeId(t: any): ThemeId {
  if (t === 'cartoon') return 'pixel'
  if (t === 'dark' || t === 'light' || t === 'pixel' || t === 'transparent' || t === 'neon' || t === 'minimal' || t === 'green' || t === 'deepsea') {
    return t
  }
  return 'dark'
}

function applyThemeToDom(t: ThemeId) {
  document.documentElement.dataset.theme = normalizeThemeId(t)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (t) => {
        const nt = normalizeThemeId(t)
        applyThemeToDom(nt)
        set({ theme: nt })
      },
    }),
    {
      name: 'geek-toolbox-theme',
      onRehydrateStorage: () => (state) => {
        const nt = normalizeThemeId(state?.theme ?? 'dark')
        if (state?.theme !== nt) {
          state?.setTheme(nt)
          return
        }
        applyThemeToDom(nt)
      },
    }
  )
)
