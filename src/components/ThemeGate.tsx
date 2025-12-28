import React, { useEffect } from 'react'

import { useComponentStore } from '../stores/useComponentStore'
import { useThemeStore } from '../stores/useThemeStore'

export const ThemeGate: React.FC = () => {
  const theme = useThemeStore((s) => s.theme)
  const subscribed = useComponentStore((s) => s.subscriptions.theme)

  useEffect(() => {
    const effective = subscribed ? theme : 'dark'
    const normalized = effective === 'cartoon' ? 'pixel' : effective
    document.documentElement.dataset.theme = normalized
  }, [subscribed, theme])

  return null
}
