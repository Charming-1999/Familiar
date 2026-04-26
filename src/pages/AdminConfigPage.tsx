import React, { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import {
  createActivationCodes,
  deleteActivationCode,
  deleteSystemConfig,
  listActivationCodes,
  listSystemConfigs,
  type ActivationCodeRecord,
  type SystemConfigRecord,
  upsertSystemConfig,
  updateActivationCode,
} from '../lib/runtimeConfig'
import { useAuthStore } from '../stores/useAuthStore'
import { cn } from '../lib/utils'

type TabKey = 'configs' | 'codes'

const emptyForm = {
  key: '',
  label: '',
  value: '',
  category: 'general',
  description: '',
  is_secret: true,
}

export const AdminConfigPage: React.FC = () => {
  const { user, profile } = useAuthStore()
  const [tab, setTab] = useState<TabKey>('configs')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [configs, setConfigs] = useState<SystemConfigRecord[]>([])
  const [codes, setCodes] = useState<ActivationCodeRecord[]>([])
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(emptyForm)
  const [codeCount, setCodeCount] = useState('3')
  const [codeDescription, setCodeDescription] = useState('')
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({})

  const loadAll = async () => {
    if (!profile?.is_super_admin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [configRows, codeRows] = await Promise.all([listSystemConfigs(), listActivationCodes()])
      setConfigs(configRows)
      setCodes(codeRows)
      setCodeDrafts(Object.fromEntries(codeRows.map((item) => [item.id, item.description || ''])))
    } catch (e: any) {
      setError(e.message || '加载配置中心失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [profile?.is_super_admin])

  const filteredConfigs = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return configs
    return configs.filter((item) => `${item.key}\n${item.label}\n${item.category}\n${item.description || ''}`.toLowerCase().includes(keyword))
  }, [configs, search])

  const filteredCodes = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return codes
    return codes.filter((item) => `${item.code}\n${item.description || ''}`.toLowerCase().includes(keyword))
  }, [codes, search])

  const activeCodes = useMemo(() => codes.filter((item) => item.is_active && !item.used_at).length, [codes])
  const usedCodes = useMemo(() => codes.filter((item) => !!item.used_at).length, [codes])

  const resetForm = () => {
    setForm(emptyForm)
    setRevealed({})
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      const saved = await upsertSystemConfig({ ...form, updated_by: user.id })
      setConfigs((prev) => {
        const next = prev.filter((item) => item.key !== saved.key)
        return [saved, ...next].sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
      })
      resetForm()
    } catch (e: any) {
      setError(e.message || '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfig = async (key: string) => {
    if (!window.confirm(`确定删除配置 ${key} 吗？`)) return
    try {
      await deleteSystemConfig(key)
      setConfigs((prev) => prev.filter((item) => item.key !== key))
    } catch (e: any) {
      setError(e.message || '删除配置失败')
    }
  }

  const handleCreateCodes = async () => {
    const quantity = Number(codeCount)
    setSaving(true)
    setError(null)

    try {
      const created = await createActivationCodes(quantity, codeDescription)
      setCodes((prev) => [...created, ...prev])
      setCodeDrafts((prev) => ({ ...Object.fromEntries(created.map((item) => [item.id, item.description || ''])), ...prev }))
      setCodeDescription('')
    } catch (e: any) {
      setError(e.message || '生成激活码失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCode = async (item: ActivationCodeRecord, nextActive = item.is_active) => {
    try {
      const updated = await updateActivationCode(item.id, { description: codeDrafts[item.id] || '', is_active: nextActive })
      setCodes((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setCodeDrafts((prev) => ({ ...prev, [updated.id]: updated.description || '' }))
    } catch (e: any) {
      setError(e.message || '更新激活码失败')
    }
  }

  const handleDeleteCode = async (id: string) => {
    if (!window.confirm('确定删除这个激活码吗？')) return
    try {
      await deleteActivationCode(id)
      setCodes((prev) => prev.filter((item) => item.id !== id))
    } catch (e: any) {
      setError(e.message || '删除激活码失败')
    }
  }

  if (!profile?.is_super_admin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="glass-card max-w-lg w-full rounded-3xl p-8 border border-border text-center space-y-4">
          <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
          <h2 className="text-2xl font-bold text-foreground">仅限超管访问</h2>
          <p className="text-sm text-muted-foreground">这个页面会直接读取数据库中的激活码和系统密钥，普通账号不可查看或操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold italic text-foreground flex items-center gap-3"><ShieldCheck className="w-7 h-7 text-primary" />配置中心</h2>
        </div>
        <Button variant="outline" onClick={() => void loadAll()} disabled={loading} className="space-x-2">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          <span>刷新数据</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[{ label: '运行配置', value: configs.length }, { label: '可用激活码', value: activeCodes }, { label: '已消费激活码', value: usedCodes }].map((item) => (
          <div key={item.label} className="glass-card rounded-2xl border border-border p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground/70">{item.label}</div>
            <div className="text-3xl font-bold text-foreground mt-3">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {(['configs', 'codes'] as TabKey[]).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={cn('h-10 px-4 rounded-xl text-sm transition-all border', tab === item ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30')}>
            {item === 'configs' ? '运行配置' : '激活码'}
          </button>
        ))}
        <div className="flex-1 min-w-[220px]"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索 key、标签、分类或激活码" className="bg-muted/20" /></div>
      </div>

      {error ? <div className="px-4 py-3 rounded-2xl border border-red-400/20 bg-red-500/5 text-sm text-red-300">{error}</div> : null}
      {loading ? <div className="glass-card rounded-2xl border border-border p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin text-primary" />数据加载中…</div> : null}

      {!loading && tab === 'configs' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
          <form onSubmit={handleSaveConfig} className="glass-card rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold"><Sparkles className="w-4 h-4 text-primary" />新增 / 编辑配置</div>
            <Input value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value.trim().toLowerCase() }))} placeholder="配置 key，例如 video_parser_ak" required className="bg-muted/20" />
            <Input value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="显示名称" required className="bg-muted/20" />
            <Input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="分类，例如 video / chat / general" className="bg-muted/20" />
            <textarea value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))} placeholder="配置值" className="w-full min-h-28 rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm focus:outline-none focus:border-primary/50" required />
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="用途说明（可选）" className="w-full min-h-24 rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm focus:outline-none focus:border-primary/50" />
            <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.is_secret} onChange={(e) => setForm((prev) => ({ ...prev, is_secret: e.target.checked }))} />敏感值（默认遮罩）</label>
            <div className="flex gap-3"><Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存配置'}</Button><Button type="button" variant="outline" onClick={resetForm}>重置</Button></div>
          </form>

          <div className="space-y-3">
            {filteredConfigs.map((item) => (
              <div key={item.key} className="glass-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3"><div><div className="text-lg font-semibold text-foreground">{item.label}</div><div className="text-xs text-muted-foreground mt-1 font-mono">{item.key} · {item.category}</div></div><div className="flex items-center gap-2"><span className={cn('text-[11px] px-2 py-1 rounded-full border', item.is_secret ? 'border-amber-400/20 text-amber-300 bg-amber-500/10' : 'border-emerald-400/20 text-emerald-300 bg-emerald-500/10')}>{item.is_secret ? '敏感' : '公开'}</span><Button variant="ghost" size="icon" onClick={() => setRevealed((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}>{revealed[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button></div></div>
                <div className="rounded-xl border border-border bg-black/20 px-3 py-3 text-sm text-foreground font-mono break-all">{item.is_secret && !revealed[item.key] ? '••••••••••••••••••••' : item.value}</div>
                {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                <div className="flex gap-3"><Button variant="outline" onClick={() => setForm({ key: item.key, label: item.label, value: item.value, category: item.category, description: item.description || '', is_secret: item.is_secret })}>编辑</Button><Button variant="ghost" className="text-red-300 hover:text-red-200 hover:bg-red-500/10" onClick={() => void handleDeleteConfig(item.key)}><Trash2 className="w-4 h-4 mr-2" />删除</Button></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && tab === 'codes' ? (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl border border-border p-5 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]"><div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />批量生成激活码</div><Input value={codeDescription} onChange={(e) => setCodeDescription(e.target.value)} placeholder="这一批激活码的备注，例如 内测用户 / VIP 兑换" className="bg-muted/20" /></div>
            <div className="w-28"><Input value={codeCount} onChange={(e) => setCodeCount(e.target.value)} placeholder="数量" className="bg-muted/20" /></div>
            <Button onClick={() => void handleCreateCodes()} disabled={saving}>生成激活码</Button>
          </div>

          <div className="space-y-3">
            {filteredCodes.map((item) => (
              <div key={item.id} className="glass-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap"><div><div className="text-lg font-semibold text-foreground font-mono tracking-[0.2em]">{item.code}</div><div className="text-xs text-muted-foreground mt-1">创建于 {new Date(item.created_at).toLocaleString()}</div></div><div className={cn('text-[11px] px-2 py-1 rounded-full border', item.used_at ? 'border-slate-400/20 text-slate-300 bg-slate-500/10' : item.is_active ? 'border-emerald-400/20 text-emerald-300 bg-emerald-500/10' : 'border-amber-400/20 text-amber-300 bg-amber-500/10')}>{item.used_at ? '已使用' : item.is_active ? '可用' : '已停用'}</div></div>
                <Input value={codeDrafts[item.id] || ''} onChange={(e) => setCodeDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))} placeholder="备注说明" className="bg-muted/20" />
                <div className="text-xs text-muted-foreground">{item.used_at ? `已于 ${new Date(item.used_at).toLocaleString()} 被消费` : '未被消费，可随时停用或补充备注。'}</div>
                <div className="flex gap-3 flex-wrap"><Button variant="outline" onClick={() => void handleSaveCode(item)} disabled={!!item.used_at}>保存备注</Button><Button variant="outline" onClick={() => void handleSaveCode(item, !item.is_active)} disabled={!!item.used_at}>{item.is_active ? '停用' : '重新启用'}</Button><Button variant="ghost" className="text-red-300 hover:text-red-200 hover:bg-red-500/10" onClick={() => void handleDeleteCode(item.id)}><Trash2 className="w-4 h-4 mr-2" />删除</Button></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
