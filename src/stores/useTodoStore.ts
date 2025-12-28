import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TodoItem = {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
  completedAt?: number | null
}

type TodoState = {
  todos: TodoItem[]
  addTodo: (text: string) => void
  toggleTodo: (id: string, completed?: boolean) => void
  deleteTodo: (id: string) => void
  clearCompleted: () => void
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      addTodo: (text) => {
        const t = text.trim().replace(/\s+/g, ' ')
        if (!t) return
        const now = Date.now()
        const item: TodoItem = {
          id: uid(),
          text: t,
          completed: false,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        }
        set({ todos: [item, ...get().todos] })
      },
      toggleTodo: (id, completed) => {
        const now = Date.now()
        set({
          todos: get().todos.map((t) => {
            if (t.id !== id) return t
            const nextCompleted = typeof completed === 'boolean' ? completed : !t.completed
            return {
              ...t,
              completed: nextCompleted,
              updatedAt: now,
              completedAt: nextCompleted ? now : null,
            }
          }),
        })
      },
      deleteTodo: (id) => set({ todos: get().todos.filter((t) => t.id !== id) }),
      clearCompleted: () => set({ todos: get().todos.filter((t) => !t.completed) }),
    }),
    { name: 'geek-toolbox-todos' }
  )
)
