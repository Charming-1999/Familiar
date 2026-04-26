export type PathSeg = string | number

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type TreeNode = {
  keyLabel: string
  path: PathSeg[]
  type: JsonNodeType
  preview: string
  depth: number
  hasChildren: boolean
}

export function typeOfJson(value: any): JsonNodeType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'object'
}

function previewOfJson(value: any) {
  const type = typeOfJson(value)
  if (type === 'object') return `{${Object.keys(value || {}).length}}`
  if (type === 'array') return `[${(value || []).length}]`
  if (type === 'string') return value.length > 28 ? JSON.stringify(value.slice(0, 28) + '…') : JSON.stringify(value)
  if (type === 'number') return String(value)
  if (type === 'boolean') return value ? 'true' : 'false'
  return 'null'
}

export function getAtPath(root: any, path: PathSeg[]) {
  let current = root
  for (const segment of path) {
    if (current == null) return undefined
    current = current[segment as any]
  }
  return current
}

function cloneShallow(value: any) {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return { ...value }
  return value
}

export function setAtPath(root: any, path: PathSeg[], nextValue: any) {
  if (path.length === 0) return nextValue
  const nextRoot = cloneShallow(root)
  let current = nextRoot

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    const nextChild = cloneShallow(current[segment as any])
    current[segment as any] = nextChild
    current = nextChild
  }

  current[path[path.length - 1] as any] = nextValue
  return nextRoot
}

export function deleteAtPath(root: any, path: PathSeg[]) {
  if (path.length === 0) return root
  const parentPath = path.slice(0, -1)
  const nextRoot = cloneShallow(root)
  let current = nextRoot

  for (const segment of parentPath) {
    const nextChild = cloneShallow(current[segment as any])
    current[segment as any] = nextChild
    current = nextChild
  }

  const last = path[path.length - 1]
  if (Array.isArray(current) && typeof last === 'number') current.splice(last, 1)
  if (current && typeof current === 'object' && !Array.isArray(current)) delete current[last as any]
  return nextRoot
}

export function renameKey(root: any, path: PathSeg[], nextKey: string) {
  if (path.length === 0) return root
  const last = path[path.length - 1]
  if (typeof last !== 'string') return root

  const parentPath = path.slice(0, -1)
  const parent = getAtPath(root, parentPath)
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return root
  if (Object.prototype.hasOwnProperty.call(parent, nextKey) && nextKey !== last) {
    throw new Error('目标 key 已存在')
  }

  const nextRoot = cloneShallow(root)
  let current = nextRoot

  for (const segment of parentPath) {
    const nextChild = cloneShallow(current[segment as any])
    current[segment as any] = nextChild
    current = nextChild
  }

  current[nextKey] = current[last]
  delete current[last]
  return nextRoot
}

export function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error: any) {
    return { ok: false, error: error?.message || 'JSON 解析失败' }
  }
}

export function buildTree(root: any) {
  const output: TreeNode[] = []

  const walk = (value: any, path: PathSeg[], depth: number, keyLabel: string) => {
    const type = typeOfJson(value)
    const hasChildren =
      (type === 'object' && Object.keys(value || {}).length > 0) ||
      (type === 'array' && (value || []).length > 0)

    output.push({
      keyLabel,
      path,
      type,
      preview: previewOfJson(value),
      depth,
      hasChildren,
    })

    if (type === 'object') {
      for (const key of Object.keys(value || {}).sort((left, right) => left.localeCompare(right))) {
        walk(value[key], [...path, key], depth + 1, key)
      }
    }

    if (type === 'array') {
      for (let index = 0; index < (value || []).length; index += 1) {
        walk(value[index], [...path, index], depth + 1, String(index))
      }
    }
  }

  walk(root, [], 0, '(root)')
  return output
}

export function pathToString(path: PathSeg[]) {
  if (path.length === 0) return '(root)'
  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : `.${String(segment).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}`))
    .join('')
    .replace(/^\./, '')
}

export function remapExpandedKeysForRename(expanded: Record<string, boolean>, oldPath: PathSeg[], nextKey: string) {
  const oldId = pathToString(oldPath)
  const nextId = pathToString([...oldPath.slice(0, -1), nextKey])
  if (oldId === nextId) return expanded

  const output: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(expanded)) {
    if (key === oldId || key.startsWith(oldId + '.') || key.startsWith(oldId + '[')) {
      output[nextId + key.slice(oldId.length)] = value
    } else {
      output[key] = value
    }
  }

  return output
}
