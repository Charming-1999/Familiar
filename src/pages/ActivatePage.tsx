import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Key, Loader2, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/useAuthStore'

export const ActivatePage: React.FC = () => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { user, fetchProfile } = useAuthStore()

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      // Check if code is valid
      const { data, error: codeError } = await supabase
        .from('activation_codes')
        .select('id')
        .eq('code', code.trim())
        .eq('is_active', true)
        .single()

      if (codeError || !data) {
        throw new Error('无效的激活码')
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          is_activated: true,
          activated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess(true)
      await fetchProfile(user.id)
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 glass-card p-8 rounded-xl border-primary/20"
      >
        <div className="text-center space-y-2">
          <Key className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">账户激活</h1>
          <p className="text-muted-foreground italic">输入激活码以解锁所有功能</p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
            <p className="text-xl font-medium text-primary">激活成功！</p>
            <p className="text-muted-foreground">正在为您跳转至工作台...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-6">
            <div className="space-y-2">
              <Input 
                placeholder="请输入 8 位激活码" 
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="bg-muted/50 border-border text-center text-lg tracking-widest h-14 focus:border-primary/50"
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            </div>

            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即激活'}
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                还没有激活码？请联系管理员获取
              </p>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
