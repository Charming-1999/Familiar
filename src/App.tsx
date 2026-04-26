import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'

import { useAuthStore } from './stores/useAuthStore'
import { useToolStore } from './stores/useToolStore'
import { useComponentStore } from './stores/useComponentStore'
import { LoginPage } from './pages/LoginPage'
import { ActivatePage } from './pages/ActivatePage'
import { Sidebar } from './components/Sidebar'
import { ThemeGate } from './components/ThemeGate'
import { FocusModeWidget } from './components/FocusModeWidget'
import { CommandPalette } from './components/CommandPalette'
import { Button } from './components/Button'
import { DashboardPage } from './pages/DashboardPage'
import { MarketPage } from './pages/MarketPage'
import { ComponentMarketPage } from './pages/ComponentMarketPage'
import { ToolPage } from './pages/ToolPage'
import { AdminConfigPage } from './pages/AdminConfigPage'

const FullPageLoader = ({ label = '正在校验账户状态…' }: { label?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="glass-card rounded-2xl border border-border px-8 py-7 text-center space-y-3">
      <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  </div>
)

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

const ProfileBlockedState = () => {
  const { profileStatus, profileError, refreshProfile, signOut } = useAuthStore()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="glass-card w-full max-w-lg rounded-3xl border border-border p-8 space-y-5 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-300">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">账户尚未完成校验</h2>
          <p className="text-sm text-muted-foreground">
            {profileStatus === 'missing'
              ? '当前账号缺少资料记录，系统已阻止继续访问受保护内容。'
              : '账户资料加载失败，系统已默认拒绝访问受保护内容。'}
          </p>
          {profileError ? <p className="text-xs text-red-300">{profileError}</p> : null}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => void refreshProfile()}>
            重新加载
          </Button>
          <Button variant="ghost" className="text-red-300 hover:text-red-200 hover:bg-red-500/10" onClick={() => void signOut()}>
            退出当前账号
          </Button>
        </div>
      </div>
    </div>
  )
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, profileStatus, initialized, loading, initialize } = useAuthStore()
  const { bindUser } = useToolStore()
  const { bindUser: bindComponents } = useComponentStore()
  const initRef = useRef(false)

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true
      void initialize()
    }
  }, [initialize])

  useEffect(() => {
    void bindUser(user?.id || null)
    void bindComponents(user?.id || null)
  }, [bindComponents, bindUser, user?.id])

  if (!initialized || (user && (loading || profileStatus === 'loading' || profileStatus === 'idle'))) {
    return <FullPageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileStatus !== 'ready' || !profile) {
    return <ProfileBlockedState />
  }

  if (!profile.is_activated) {
    return <Navigate to="/activate" replace />
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

const ActivationRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, profileStatus, initialized, loading, initialize } = useAuthStore()
  const initRef = useRef(false)

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true
      void initialize()
    }
  }, [initialize])

  if (!initialized || (user && (loading || profileStatus === 'loading'))) {
    return <FullPageLoader label="正在准备激活页面…" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileStatus === 'ready' && profile?.is_activated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/activate"
          element={
            <ActivationRoute>
              <ActivatePage />
            </ActivationRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/components" element={<ComponentMarketPage />} />
                <Route path="/tool/:id" element={<ToolPage />} />
                <Route path="/admin/config" element={<AdminConfigPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
