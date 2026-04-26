import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Key, Loader2, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

export const ActivatePage: React.FC = () => {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { user, profile, profileStatus, initialized, loading, initialize, refreshProfile, signOut } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (!initialized || loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (profileStatus === 'ready' && profile?.is_activated) {
      navigate('/', { replace: true })
    }
  }, [initialized, loading, navigate, profile, profileStatus, user])

  const helperText = useMemo(() => {
    if (profileStatus === 'missing') return '当前账号资料将会在激活时自动补齐。'
    if (profileStatus === 'error') return '账户资料暂时无法读取，但你仍可尝试安全激活。'
    return '输入有效激活码后，系统会原子校验并一次性消费该激活码。'
  }, [profileStatus])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
      setError('请输入激活码。')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const { data, error } = await supabase.rpc('activate_account', {
      input_code: normalizedCode,
    })

    if (error) {
      setError(error.message || '激活失败')
      setSubmitting(false)
      return
    }

    const result = (data || {}) as { success?: boolean; message?: string }
    if (!result.success) {
      setError(result.message || '激活失败')
      setSubmitting(false)
      return
    }

    setSuccess(result.message || '激活成功')
    await refreshProfile()
    setSubmitting(false)
    window.setTimeout(() => navigate('/', { replace: true }), 1200)
  }

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 glass-card p-8 rounded-3xl border-primary/20"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary">
            <Key className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">账户激活</h1>
            <p className="text-muted-foreground mt-2">{helperText}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground leading-5">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>当前账号：{user?.email || '未知邮箱'}</span>
          </div>
          <p>如果切错账号，请先退出再重新登录，避免把激活码用到错误账户上。</p>
        </div>

        {success ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 py-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <p className="text-xl font-medium text-emerald-400">{success}</p>
              <p className="text-muted-foreground mt-2">正在返回工作台…</p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-6">
            <div className="space-y-2">
              <Input
                placeholder="请输入激活码"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="bg-muted/50 border-border text-center text-lg tracking-[0.3em] h-14 focus:border-primary/50"
              />
              {error ? <p className="text-red-400 text-sm text-center">{error}</p> : null}
            </div>

            <Button type="submit" className="w-full h-12 text-lg" disabled={submitting}>
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即激活'}
            </Button>

            <div className="flex items-center justify-center gap-3">
              <Button type="button" variant="ghost" onClick={() => void refreshProfile()}>
                刷新状态
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
                onClick={() => void signOut()}
              >
                切换账号
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
