import React, { useMemo, useState } from 'react'
import { ListTodo, Plus, Trash2, Check } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cn } from '../lib/utils'
import { useTodoStore } from '../stores/useTodoStore'

export const TodoListTool: React.FC = () => {
  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } = useTodoStore()
  const [text, setText] = useState('')

  const { pending, completed } = useMemo(() => {
    const p: typeof todos = []
    const c: typeof todos = []
    for (const t of todos) (t.completed ? c : p).push(t)
    p.sort((a, b) => b.updatedAt - a.updatedAt)
    c.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    return { pending: p, completed: c }
  }, [todos])

  const submit = () => {
    const v = text
    if (!v.trim()) return
    addTodo(v)
    setText('')
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <ListTodo className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold italic">TodoList</h2>
        </div>
        <div className="text-xs text-muted-foreground">未完成 {pending.length} / 总计 {todos.length}</div>
      </div>

      <div className="glass-card p-4 rounded-xl space-y-3">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="添加一个待办..."
            className="bg-muted/10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          <Button onClick={submit} disabled={!text.trim()} className="space-x-1">
            <Plus className="w-4 h-4" />
            <span>添加</span>
          </Button>
        </div>

        <div className="space-y-2">
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">暂无未完成待办</div>
          ) : (
            pending.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/20 px-3 py-2"
              >
                <button
                  className={cn(
                    'mt-0.5 w-5 h-5 rounded border border-border flex items-center justify-center transition-colors',
                    'hover:border-primary/50',
                    t.completed ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-muted/10'
                  )}
                  onClick={() => toggleTodo(t.id, true)}
                  title="完成"
                >
                  <Check className={cn('w-3.5 h-3.5', t.completed ? 'opacity-100' : 'opacity-0')} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground whitespace-pre-wrap break-words">{t.text}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  className="text-xs text-red-400 hover:text-red-500"
                  onClick={() => deleteTodo(t.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {completed.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">已完成（{completed.length}）</summary>
            <div className="mt-3 space-y-2">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={clearCompleted} className="text-xs">
                  清除已完成
                </Button>
              </div>
              {completed.slice(0, 50).map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/10 px-3 py-2 opacity-80"
                >
                  <button
                    className="mt-0.5 w-5 h-5 rounded border border-border bg-primary/30 flex items-center justify-center"
                    onClick={() => toggleTodo(t.id, false)}
                    title="取消完成"
                  >
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground line-through whitespace-pre-wrap break-words">{t.text}</div>
                  </div>

                  <button
                    className="text-xs text-red-400 hover:text-red-500"
                    onClick={() => deleteTodo(t.id)}
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
