import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import { useToolStore } from './stores/useToolStore'
import { useComponentStore } from './stores/useComponentStore'
import { LoginPage } from './pages/LoginPage'
import { ActivatePage } from './pages/ActivatePage'
import { Loader2 } from 'lucide-react'

import { Sidebar } from './components/Sidebar'
import { ThemeGate } from './components/ThemeGate'
import { FocusModeWidget } from './components/FocusModeWidget'
import { CommandPalette } from './components/CommandPalette'

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSubscribed } = useComponentStore()

  return (
    <div className="h-screen w-screen bg-background flex overflow-hidden">
      <ThemeGate />
      <div className="shrink-0 h-full overflow-y-auto border-r border-border">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-h-0 relative">
        <main className="flex-1 min-h-0 bg-background p-8 flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
      {isSubscribed('focus') && <FocusModeWidget />}
      {isSubscribed('search') && <CommandPalette />}
    </div>
  )
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, initialized, initialize } = useAuthStore()
  const { bindUser } = useToolStore()
  const { bindUser: bindComponents } = useComponentStore()
  
  const initRef = useRef(false)

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true
      initialize()
    }
  }, [initialize])

  useEffect(() => {
    bindUser(user?.id || null)
    bindComponents(user?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])


  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && !profile.is_activated) {
    return <Navigate to="/activate" replace />
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

import { DashboardPage } from './pages/DashboardPage'
import { MarketPage } from './pages/MarketPage'
import { ComponentMarketPage } from './pages/ComponentMarketPage'

// ... existing code ...

import { ToolPage } from './pages/ToolPage'

// ... existing code ...

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activate" element={<ActivatePage />} />
        
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/components" element={<ComponentMarketPage />} />
                <Route path="/tool/:id" element={<ToolPage />} />
              </Routes>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App
