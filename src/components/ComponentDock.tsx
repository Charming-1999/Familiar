import React, { useMemo } from 'react'

import { useComponentStore } from '../stores/useComponentStore'
import { TimeWidget } from './TimeWidget'
import { WeatherWidget } from './WeatherWidget'

export const ComponentDock: React.FC = () => {
  const subs = useComponentStore((s) => s.subscriptions)

  const hasAny = useMemo(() => Object.values(subs).some(Boolean), [subs])
  if (!hasAny) return null

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {subs.time ? <TimeWidget /> : null}
      {subs.weather ? <WeatherWidget /> : null}
    </div>
  )
}
