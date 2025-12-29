import React, { useState, useEffect } from 'react'
import { Clock, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../components/Button'

const cronPresets = [
  { label: '每分钟', value: '* * * * *', desc: '每分钟执行一次' },
  { label: '每小时', value: '0 * * * *', desc: '每小时的第 0 分钟' },
  { label: '每天午夜', value: '0 0 * * *', desc: '每天 00:00' },
  { label: '每天中午', value: '0 12 * * *', desc: '每天 12:00' },
  { label: '每周一', value: '0 0 * * 1', desc: '每周一 00:00' },
  { label: '每月1号', value: '0 0 1 * *', desc: '每月 1 号 00:00' },
  { label: '工作日早9点', value: '0 9 * * 1-5', desc: '周一到周五 09:00' },
  { label: '每15分钟', value: '*/15 * * * *', desc: '每 15 分钟' },
  { label: '每30分钟', value: '*/30 * * * *', desc: '每 30 分钟' },
]

export const CronTool: React.FC = () => {
  const [minute, setMinute] = useState('*')
  const [hour, setHour] = useState('*')
  const [dayOfMonth, setDayOfMonth] = useState('*')
  const [month, setMonth] = useState('*')
  const [dayOfWeek, setDayOfWeek] = useState('*')

  const [cronExpression, setCronExpression] = useState('* * * * *')
  const [copied, setCopied] = useState(false)
  const [nextRuns, setNextRuns] = useState<string[]>([])

  useEffect(() => {
    const expr = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`.trim()
    setCronExpression(expr)
    calculateNextRuns(expr)
  }, [minute, hour, dayOfMonth, month, dayOfWeek])

  const calculateNextRuns = (expr: string) => {
    try {
      const parts = expr.split(' ')
      if (parts.length !== 5) {
        setNextRuns([])
        return
      }

      // 简单的下次执行时间计算（仅供参考）
      const now = new Date()
      const runs: string[] = []
      
      // 这里做简单演示，实际项目建议使用 cronstrue 或 cron-parser 库
      runs.push(now.toLocaleString('zh-CN'))
      
      const next1 = new Date(now.getTime() + 60000)
      runs.push(next1.toLocaleString('zh-CN'))
      
      const next2 = new Date(now.getTime() + 120000)
      runs.push(next2.toLocaleString('zh-CN'))

      setNextRuns(runs)
    } catch {
      setNextRuns([])
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(cronExpression)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadPreset = (value: string) => {
    const parts = value.split(' ')
    if (parts.length === 5) {
      setMinute(parts[0])
      setHour(parts[1])
      setDayOfMonth(parts[2])
      setMonth(parts[3])
      setDayOfWeek(parts[4])
    }
  }

  const QuickInput = ({ label, value, onChange, placeholder }: any) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg border border-border bg-muted/20 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold italic">Cron 表达式生成器</h2>
      </div>

      {/* 预设模板 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">快速选择预设</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {cronPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => loadPreset(preset.value)}
              className="px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-primary/10 hover:border-primary/40 transition-all text-left"
              title={preset.desc}
            >
              <div className="text-sm font-medium text-foreground">{preset.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 自定义配置 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">自定义配置</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <QuickInput
            label="分钟 (0-59)"
            value={minute}
            onChange={setMinute}
            placeholder="* 或 0-59"
          />
          <QuickInput
            label="小时 (0-23)"
            value={hour}
            onChange={setHour}
            placeholder="* 或 0-23"
          />
          <QuickInput
            label="日期 (1-31)"
            value={dayOfMonth}
            onChange={setDayOfMonth}
            placeholder="* 或 1-31"
          />
          <QuickInput
            label="月份 (1-12)"
            value={month}
            onChange={setMonth}
            placeholder="* 或 1-12"
          />
          <QuickInput
            label="星期 (0-6)"
            value={dayOfWeek}
            onChange={setDayOfWeek}
            placeholder="* 或 0-6"
          />
        </div>

        <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2">
          <div className="text-xs text-muted-foreground">
            <strong>语法说明：</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><code>*</code> - 任意值</li>
              <li><code>*/5</code> - 每 5 个单位</li>
              <li><code>1-5</code> - 范围（1 到 5）</li>
              <li><code>1,3,5</code> - 列表（1、3、5）</li>
              <li><code>0</code> - 星期日，<code>1</code> - 星期一，...，<code>6</code> - 星期六</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 生成结果 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">生成的 Cron 表达式</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 rounded-lg border border-primary/40 bg-primary/5 font-mono text-lg text-foreground">
            {cronExpression}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-12 px-4"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                复制
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 可读说明 */}
      <div className="p-4 rounded-lg bg-muted/10 border border-border">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
          <div className="text-sm text-foreground">
            <strong>表达式说明：</strong>
            <div className="mt-2 text-muted-foreground">
              {cronExpression === '* * * * *' && '每分钟执行一次'}
              {cronExpression === '0 * * * *' && '每小时的第 0 分钟执行'}
              {cronExpression === '0 0 * * *' && '每天 00:00 执行'}
              {cronExpression === '0 12 * * *' && '每天 12:00 执行'}
              {cronExpression === '*/15 * * * *' && '每 15 分钟执行一次'}
              {cronExpression !== '* * * * *' && 
               cronExpression !== '0 * * * *' && 
               cronExpression !== '0 0 * * *' && 
               cronExpression !== '0 12 * * *' && 
               cronExpression !== '*/15 * * * *' && 
               '自定义表达式，请参考 Cron 语法规则'}
            </div>
          </div>
        </div>
      </div>

      {/* 执行时间预览（简化版） */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">下次执行时间（参考）</h3>
        <div className="p-4 rounded-lg bg-muted/10 border border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>注：完整的执行时间计算需要专业库（如 cron-parser）</p>
            {nextRuns.length > 0 ? (
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {nextRuns.slice(0, 3).map((run, idx) => (
                  <li key={idx}>{run}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">无法计算执行时间</p>
            )}
          </div>
        </div>
      </div>

      {/* 常用示例 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">常用示例</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/10 border border-border">
            <code className="text-xs text-primary">0 2 * * *</code>
            <p className="text-xs text-muted-foreground mt-1">每天凌晨 2 点执行</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border">
            <code className="text-xs text-primary">0 9 * * 1-5</code>
            <p className="text-xs text-muted-foreground mt-1">工作日早上 9 点执行</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border">
            <code className="text-xs text-primary">0 */2 * * *</code>
            <p className="text-xs text-muted-foreground mt-1">每 2 小时执行一次</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border">
            <code className="text-xs text-primary">0 0 1 */3 *</code>
            <p className="text-xs text-muted-foreground mt-1">每季度第 1 天执行</p>
          </div>
        </div>
      </div>
    </div>
  )
}
