/**
 * 跨平台快捷键工具函数
 */

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown'

/**
 * 检测当前平台
 */
export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('mac')) return 'mac'
  if (userAgent.includes('win')) return 'windows' 
  if (userAgent.includes('linux')) return 'linux'
  return 'unknown'
}

/**
 * 检测是否为 Mac 平台
 */
export function isMac(): boolean {
  return getPlatform() === 'mac'
}

/**
 * 获取修饰键的表示字符串
 */
export function getModifierKey(): 'Ctrl' | 'Cmd' {
  return isMac() ? 'Cmd' : 'Ctrl'
}

/**
 * 获取 Alt 键的表示字符串
 */
export function getAltKey(): 'Alt' | 'Option' {
  return isMac() ? 'Option' : 'Alt'
}

/**
 * 根据平台调整快捷键字符串
 */
export function normalizeShortcut(shortcut: string): string {
  return shortcut
    .replace(/\bCtrl\b/g, getModifierKey())
    .replace(/\bCmd\b/g, getModifierKey())
    .replace(/\bAlt\b/g, getAltKey())
    .replace(/\bOption\b/g, getAltKey())
}

/**
 * 解析快捷键字符串为键盘事件判断函数
 */
export function parseShortcut(shortcut: string): (e: KeyboardEvent) => boolean {
  const normalized = normalizeShortcut(shortcut)
  const parts = normalized.toLowerCase().split('+').map(p => p.trim())
  
  return (e: KeyboardEvent): boolean => {
    const modifiers: string[] = []
    
    if (e.ctrlKey) modifiers.push('ctrl')
    if (e.metaKey) modifiers.push('meta')  // Cmd key
    if (e.altKey) modifiers.push('alt')
    if (e.shiftKey) modifiers.push('shift')
    
    const key = e.key.toLowerCase()
    
    // 检查是否匹配
    return parts.every(part => {
      if (part === 'ctrl' || part === 'cmd') return modifiers.includes('ctrl') || modifiers.includes('meta')
      if (part === 'alt' || part === 'option') return modifiers.includes('alt')
      if (part === 'shift') return modifiers.includes('shift')
      if (part === key) return true
      return false
    })
  }
}

/**
 * 常用快捷键常量
 */
export const SHORTCUTS = {
  SAVE: isMac() ? 'Cmd+S' : 'Ctrl+S',
  UNDO: isMac() ? 'Cmd+Z' : 'Ctrl+Z',
  REDO: isMac() ? 'Cmd+Shift+Z' : 'Ctrl+Y',
  COPY: isMac() ? 'Cmd+C' : 'Ctrl+C',
  PASTE: isMac() ? 'Cmd+V' : 'Ctrl+V',
  SELECT_ALL: isMac() ? 'Cmd+A' : 'Ctrl+A',
  FIND: isMac() ? 'Cmd+F' : 'Ctrl+F',
  COMMAND_PALETTE: isMac() ? 'Cmd+K' : 'Ctrl+K',
} as const

/**
 * 快捷键配置接口
 */
export interface ShortcutConfig {
  name: string
  description: string
  defaultKey: string
  currentKey: string
  category: 'global' | 'editor' | 'navigation'
}

/**
 * 默认快捷键配置
 */
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  {
    name: 'commandPalette',
    description: '打开命令面板',
    defaultKey: SHORTCUTS.COMMAND_PALETTE,
    currentKey: SHORTCUTS.COMMAND_PALETTE,
    category: 'global'
  },
  {
    name: 'save',
    description: '保存',
    defaultKey: SHORTCUTS.SAVE,
    currentKey: SHORTCUTS.SAVE,
    category: 'editor'
  },
  {
    name: 'undo',
    description: '撤销',
    defaultKey: SHORTCUTS.UNDO,
    currentKey: SHORTCUTS.UNDO,
    category: 'editor'
  },
  {
    name: 'redo',
    description: '重做',
    defaultKey: SHORTCUTS.REDO,
    currentKey: SHORTCUTS.REDO,
    category: 'editor'
  },
  {
    name: 'find',
    description: '查找',
    defaultKey: SHORTCUTS.FIND,
    currentKey: SHORTCUTS.FIND,
    category: 'editor'
  }
]

/**
 * 生成快捷键显示文本
 */
export function getShortcutDisplayText(shortcut: string): string {
  const symbols = {
    'Ctrl': '⌃',
    'Cmd': '⌘',
    'Alt': '⌥',
    'Option': '⌥',
    'Shift': '⇧',
    'Meta': '⌘',
    'Control': '⌃'
  }
  
  return shortcut
    .split('+')
    .map(key => symbols[key as keyof typeof symbols] || key)
    .join(' ')
}