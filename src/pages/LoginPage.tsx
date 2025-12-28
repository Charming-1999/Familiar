import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Github, Mail, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, initialized, initialize } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    // Handle Supabase auth errors returned in URL hash (e.g. #error=...)
    if (!window.location.hash) return

    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(raw)
    const errorCode = params.get('error_code')
    const errorDescription = params.get('error_description')

    if (errorCode || errorDescription) {
      const desc = errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : null
      let msg = desc || '登录/验证失败'

      if (errorCode === 'otp_expired') {
        msg = '邮箱验证链接已失效（可能已过期或已使用）。请重新注册/重新发送验证邮件后再尝试。'
      }

      setError(msg)

      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (initialized && user) {
      navigate('/')
    }
  }, [user, initialized, navigate])




  const handleGithubLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        // Try sign up if login fails with credentials error
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (signUpError) setError(signUpError.message)
        else setError('注册成功：请检查邮箱完成验证后再登录（如已验证可直接再次登录）')
      } else {
        setError(error.message)
      }
    } else if (data.user) {
      // Login success -> go to protected area, it will redirect to /activate if needed
      navigate('/')
    }
    setLoading(false)



  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 glass-card p-8 rounded-xl border-primary/20"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold italic tracking-tighter text-primary text-glow font-mono">
            Familiar
          </h1>
          <p className="text-muted-foreground">欢迎使用程序员极简工具箱</p>
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

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="邮箱地址" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted/50 border-border focus:border-primary/50"
              />
              <Input 
                type="password" 
                placeholder="密码" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/50 border-border focus:border-primary/50"
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5 mr-2" />}
              登录 / 注册
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
