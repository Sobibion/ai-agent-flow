import * as dagre from 'dagre'
import type { Edge } from 'reactflow'
import type { WorkflowNode } from '../types/workflow'

type Direction = 'TB' | 'LR'

/** 根据节点类型返回兜底宽高，用于 Dagre 布局（无法获取真实测量尺寸时） */
function getNodeFallbackSize(type: string): { width: number; height: number } {
  switch (type) {
    case 'llmNode':
      return { width: 350, height: 400 }
    case 'promptNode':
      return { width: 300, height: 250 }
    case 'httpNode':
      return { width: 350, height: 350 }
    case 'conditionNode':
      return { width: 300, height: 200 }
    case 'startNode':
    case 'endNode':
    default:
      return { width: 200, height: 80 }
  }
}

type NodeWithSize = WorkflowNode & {
  measured?: { width?: number; height?: number }
  width?: number
  height?: number
}

/** 取节点在布局中应使用的宽高：优先 measured，其次 width/height，最后按类型兜底 */
function getNodeSize(node: WorkflowNode): { width: number; height: number } {
  const fallback = getNodeFallbackSize((node.type as string) || '')
  const n = node as NodeWithSize
  const width = (n.measured && n.measured.width != null) ? n.measured.width : (n.width != null ? n.width : fallback.width)
  const height = (n.measured && n.measured.height != null) ? n.measured.height : (n.height != null ? n.height : fallback.height)
  return { width: Number(width), height: Number(height) }
}

export function getLayoutedNodes(
  nodes: WorkflowNode[],
  edges: Edge[],
  direction: Direction = 'TB'
): WorkflowNode[] {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    ranksep: 100,
    nodesep: 80,
  })

  const sizeMap = new Map<string, { width: number; height: number }>()
  nodes.forEach((node) => {
    const { width, height } = getNodeSize(node)
    sizeMap.set(node.id, { width, height })
    g.setNode(node.id, { width, height })
  })
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const isHorizontal = direction === 'LR'
  return nodes.map((node) => {
    const pos = g.node(node.id)
    const { width, height } = sizeMap.get(node.id) || getNodeFallbackSize((node.type as string) || '')
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
    }
  })
}
