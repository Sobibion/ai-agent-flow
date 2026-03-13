import type { Node, Edge } from 'reactflow'
import { toast } from 'sonner'

export type RunState = 'idle' | 'running' | 'success'

export interface DAGResult {
  order: string[]
  hasCycle: boolean
  startNodeId: string | null
}

/**
 * 从 nodes 中找到 Start 节点（type === 'startNode'），取第一个
 */
function findStartNodeId(nodes: Node[]): string | null {
  const start = nodes.find((n) => n.type === 'startNode')
  return start ? start.id : null
}

/**
 * 从 startId 出发 BFS 得到可达节点集合
 */
function getReachableIds(
  startId: string,
  edges: Edge[]
): Set<string> {
  const outEdges = new Map<string, string[]>()
  for (const e of edges) {
    const list = outEdges.get(e.source) || []
    list.push(e.target)
    outEdges.set(e.source, list)
  }
  const reachable = new Set<string>()
  const queue = [startId]
  reachable.add(startId)
  while (queue.length > 0) {
    const cur = queue.shift() as string
    const nexts = outEdges.get(cur) || []
    for (const n of nexts) {
      if (!reachable.has(n)) {
        reachable.add(n)
        queue.push(n)
      }
    }
  }
  return reachable
}

/**
 * 在从 start 可达的子图上做 Kahn 拓扑排序，并检测环。
 * 若拓扑序长度 < 可达节点数，则存在环。
 */
export function getExecutionOrder(
  nodes: Node[],
  edges: Edge[]
): DAGResult {
  const startNodeId = findStartNodeId(nodes)
  if (!startNodeId) {
    return { order: [], hasCycle: false, startNodeId: null }
  }

  const reachable = getReachableIds(startNodeId, edges)
  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()

  for (const id of reachable) {
    inDegree.set(id, 0)
  }
  for (const e of edges) {
    if (!reachable.has(e.source) || !reachable.has(e.target)) continue
    const list = outEdges.get(e.source) || []
    list.push(e.target)
    outEdges.set(e.source, list)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  }

  const queue: string[] = []
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id)
  })
  const order: string[] = []
  while (queue.length > 0) {
    const cur = queue.shift() as string
    order.push(cur)
    const nexts = outEdges.get(cur) || []
    for (const n of nexts) {
      const d = (inDegree.get(n) || 0) - 1
      inDegree.set(n, d)
      if (d === 0) queue.push(n)
    }
  }

  const hasCycle = order.length < reachable.size
  return { order: hasCycle ? [] : order, hasCycle, startNodeId }
}

export interface RunWorkflowOptions {
  nodes: Node[]
  edges: Edge[]
  setNodeRunState: (nodeId: string, state: RunState) => void
  setEdgesAnimated: (edgeIds: string[], animated: boolean) => void
  delayMs?: number
}

/**
 * 按 DAG 顺序模拟执行：每个节点先设为 running，延迟后设为 success。
 * 若存在环则 toast 提示，不执行。
 */
export async function runWorkflow(options: RunWorkflowOptions): Promise<boolean> {
  const {
    nodes,
    edges,
    setNodeRunState,
    setEdgesAnimated,
    delayMs = 1000,
  } = options

  const { order, hasCycle } = getExecutionOrder(nodes, edges)
  if (order.length === 0 && nodes.length > 0) {
    if (hasCycle) {
      toast.error('工作流存在环，无法执行。请检查连线。')
    } else {
      toast.warning('未找到起点节点（Start），或没有可达节点。')
    }
    return false
  }

  const edgeIds = edges.map((e) => e.id)
  setEdgesAnimated(edgeIds, true)

  for (const nodeId of order) {
    setNodeRunState(nodeId, 'running')
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    setNodeRunState(nodeId, 'success')
  }

  setEdgesAnimated(edgeIds, false)
  return true
}
