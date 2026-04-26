import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Github, Loader2, LogIn, Mail, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'

type AuthMode = 'login' | 'register'

function mapAuthMessage(message: string) {
  if (message.includes('Invalid login credentials')) return '邮箱或密码不正确。'
  if (message.includes('Email not confirmed')) return '邮箱尚未完成验证，请先去邮箱完成确认。'
  if (message.includes('User already registered')) return '该邮箱已注册，请直接登录。'
  if (message.includes('Password should be at least')) return '密码至少需要 6 位。'
  return message
}

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { user, profile, profileStatus, initialized, initialize } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (!window.location.hash) return

    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(raw)
    const errorCode = params.get('error_code')
    const errorDescription = params.get('error_description')

    if (!errorCode && !errorDescription) return

    const decoded = errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : ''
    setError(errorCode === 'otp_expired' ? '邮箱验证链接已失效，请重新注册或重新发送验证邮件。' : decoded || '登录/验证失败')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  useEffect(() => {
    if (!initialized || !user) return

    if (profileStatus === 'ready' && profile && !profile.is_activated) {
      navigate('/activate', { replace: true })
      return
    }

    if (profileStatus === 'ready' || profileStatus === 'missing' || profileStatus === 'error') {
      navigate('/', { replace: true })
    }
  }, [initialized, navigate, profile, profileStatus, user])

  const submitLabel = useMemo(() => {
    if (loading) return mode === 'login' ? '登录中…' : '注册中…'
    return mode === 'login' ? '登录账号' : '创建账号'
  }, [loading, mode])

  const handleGithubLogin = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(mapAuthMessage(error.message))
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致。')
      setLoading(false)
      return
    }

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        setError(mapAuthMessage(error.message))
        setLoading(false)
        return
      }

      setSuccess('注册成功，请先去邮箱完成验证，再回来登录并激活账号。')
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(mapAuthMessage(error.message))
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 glass-card p-8 rounded-3xl border-primary/20"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold italic tracking-tighter text-primary text-glow font-mono">
            Familiar
          </h1>
          <p className="text-muted-foreground">更可靠的登录与激活流程，默认拒绝未完成校验的账号。</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/20 p-1">
          {(['login', 'register'] as AuthMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item)
                setError(null)
                setSuccess(null)
              }}
              className={cn(
                'h-11 rounded-xl text-sm font-medium transition-all',
                mode === item ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-12 space-x-2 border-primary/20 hover:border-primary/50"
            onClick={handleGithubLogin}
            disabled={loading}
          >
            <Github className="w-5 h-5" />
            <span>GitHub 快捷登录</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或者使用邮箱</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="请输入登录邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                required
                className="bg-muted/50 border-border h-12 focus:border-primary/50"
              />
              <Input
                type="password"
                placeholder={mode === 'login' ? '请输入密码' : '请输入至少 6 位密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/50 border-border h-12 focus:border-primary/50"
              />
              {mode === 'register' ? (
                <Input
                  type="password"
                  placeholder="请再次确认密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-muted/50 border-border h-12 focus:border-primary/50"
                />
              ) : null}
            </div>

            {error ? <p className="text-red-400 text-xs leading-5">{error}</p> : null}
            {success ? <p className="text-emerald-400 text-xs leading-5">{success}</p> : null}

            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  {submitLabel}
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  {submitLabel}
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground leading-5">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <Mail className="w-4 h-4 text-primary" />
            <span>{mode === 'login' ? '登录后会自动校验激活状态' : '注册后需先完成邮箱验证'}</span>
          </div>
          <p>
            未激活账号会被自动引导到激活页，无法再直接进入受保护内容。
          </p>
        </div>
      </motion.div>
    </div>
  )
}
