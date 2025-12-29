import React, { useState, useEffect } from 'react'
import { X, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export const FocusModeWidget: React.FC = () => {
  const [isActive, setIsActive] = useState(false)
  const [time, setTime] = useState(25 * 60) // 25分钟默认
  const [initialTime, setInitialTime] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => {
    let interval: number | undefined

    if (isRunning && time > 0) {
      interval = window.setInterval(() => {
        setTime((t) => t - 1)
      }, 1000)
    } else if (time === 0 && isRunning) {
      setIsRunning(false)
      // 播放提示音或通知
      if (soundEnabled) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizkIG2m87+mjUBANUqnl87lpHAU7k9n0z3wsBSl+zPLaizsIHGq88OyrUhAOU6rn9L1vHgU+ltr10IAuBSuBzvLZizkIG2m87+mjUBANUqnl87lpHAU7k9n0z3wsBSl+zPLaizsIHGq88OyrUhAOU6rn9L1vHgU+ltr10IAuBQ==')
        audio.play().catch(() => {})
      }
      alert('专注时间结束！休息一下吧 🎉')
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, time, soundEnabled])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => setIsRunning(true)
  const handlePause = () => setIsRunning(false)
  const handleReset = () => {
    setIsRunning(false)
    setTime(initialTime)
  }

  const presets = [
    { label: '15分钟', value: 15 * 60 },
    { label: '25分钟', value: 25 * 60 },
    { label: '45分钟', value: 45 * 60 },
    { label: '60分钟', value: 60 * 60 },
  ]

  const progress = ((initialTime - time) / initialTime) * 100

  if (!isActive) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsActive(true)}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="开启专注模式"
      >
        <Play className="w-6 h-6" />
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-md w-full mx-4"
        >
          {/* 关闭按钮 */}
          <button
            onClick={() => {
              if (isRunning) {
                if (!window.confirm('正在专注中，确定要退出吗？')) return
              }
              setIsActive(false)
              setIsRunning(false)
            }}
            className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* 主内容 */}
          <div className="bg-gradient-to-br from-primary/20 to-background/40 backdrop-blur-xl rounded-3xl p-8 border border-primary/20 shadow-2xl">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              专注模式 🎯
            </h2>

            {/* 圆形进度条 */}
            <div className="relative w-64 h-64 mx-auto mb-8">
              <svg className="transform -rotate-90 w-full h-full">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-white/10"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 120}`}
                  strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                  className="text-primary transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-white mb-2">
                    {formatTime(time)}
                  </div>
                  <div className="text-sm text-white/60">
                    {isRunning ? '专注中...' : '暂停'}
                  </div>
                </div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="w-16 h-16 rounded-full bg-primary hover:bg-primary/80 transition-all flex items-center justify-center shadow-lg"
                >
                  <Play className="w-8 h-8 text-white ml-1" />
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="w-16 h-16 rounded-full bg-primary hover:bg-primary/80 transition-all flex items-center justify-center shadow-lg"
                >
                  <Pause className="w-8 h-8 text-white" />
                </button>
              )}
              <button
                onClick={handleReset}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center"
                title="重置"
              >
                <RotateCcw className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center"
                title={soundEnabled ? '关闭声音' : '开启声音'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white" />
                )}
              </button>
            </div>

            {/* 时长预设 */}
            {!isRunning && (
              <div className="space-y-3">
                <div className="text-sm text-white/60 text-center">快速设置时长</div>
                <div className="grid grid-cols-4 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setTime(preset.value)
                        setInitialTime(preset.value)
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        time === preset.value
                          ? 'bg-primary text-white'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 提示文本 */}
            <div className="mt-6 text-center text-xs text-white/40">
              保持专注，远离干扰 💪
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
