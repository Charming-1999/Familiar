import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ShortcutConfig, DEFAULT_SHORTCUTS, parseShortcut } from '../lib/shortcuts'

interface ShortcutState {
  shortcuts: ShortcutConfig[]
  
  // Actions
  updateShortcut: (name: string, key: string) => void
  resetShortcut: (name: string) => void
  resetAllShortcuts: () => void
  getShortcutKey: (name: string) => string
  getShortcutChecker: (name: string) => ((e: KeyboardEvent) => boolean) | null
  getShortcutsByCategory: (category: 'global' | 'editor' | 'navigation') => ShortcutConfig[]
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      shortcuts: DEFAULT_SHORTCUTS,

      updateShortcut: (name: string, key: string) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((shortcut) =>
            shortcut.name === name ? { ...shortcut, currentKey: key } : shortcut
          ),
        }))
      },

      resetShortcut: (name: string) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((shortcut) =>
            shortcut.name === name 
              ? { ...shortcut, currentKey: shortcut.defaultKey } 
              : shortcut
          ),
        }))
      },

      resetAllShortcuts: () => {
        set((state) => ({
          shortcuts: state.shortcuts.map((shortcut) => ({
            ...shortcut,
            currentKey: shortcut.defaultKey,
          })),
        }))
      },

      getShortcutKey: (name: string) => {
        const shortcut = get().shortcuts.find((s) => s.name === name)
        return shortcut?.currentKey || ''
      },

      getShortcutChecker: (name: string) => {
        const shortcut = get().shortcuts.find((s) => s.name === name)
        if (!shortcut) return null
        return parseShortcut(shortcut.currentKey)
      },

      getShortcutsByCategory: (category: 'global' | 'editor' | 'navigation') => {
        return get().shortcuts.filter((s) => s.category === category)
      },
    }),
    {
      name: 'shortcuts-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)