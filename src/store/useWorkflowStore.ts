import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
} from 'reactflow'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkflowNode, NodeStatus, RunLogEntry, NodeType } from '../types/workflow'
import type { WorkflowTemplate } from '../config/templates'
import { getDefaultNodeData } from '../utils/getDefaultNodeData'

const STORAGE_KEY = 'ai-agent-workflow-storage'

/** 持久化后 icon 会丢失，故 store 中允许 icon 可选；使用处需补默认 icon */
export type StoredWorkflowTemplate = Omit<WorkflowTemplate, 'icon'> & { icon?: WorkflowTemplate['icon'] }

const MAX_HISTORY = 50
const MAX_RUN_LOGS = 50

interface HistorySnapshot {
  nodes: WorkflowNode[]
  edges: Edge[]
}

/** 剪贴板：选中的节点及其内部连线（深拷贝用） */
export interface ClipboardSnapshot {
  nodes: WorkflowNode[]
  edges: Edge[]
}

interface WorkflowStore {
  nodes: WorkflowNode[]
  edges: Edge[]
  /** 由执行引擎设置，供 PreviewPanel 流式展示 */
  streamingPayload: string | null
  /** 复制粘贴用，不持久化 */
  clipboard: ClipboardSnapshot | null
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  /** 仅用于客户端：persist 是否已完成 rehydrate，避免 hydration 与初始渲染冲突 */
  _hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  /** 调试抽屉：当前选中要查看执行结果的节点 id，null 表示关闭 */
  selectedNodeForDebug: string | null
  setSelectedNodeForDebug: (id: string | null) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: WorkflowNode) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  updateNodeData: (id: string, data: Partial<WorkflowNode['data']>) => void
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: Edge[]) => void
  setEdgeAnimated: (edgeId: string, animated: boolean) => void
  setEdgesAnimated: (edgeIds: string[], animated: boolean) => void
  updateEdgeAnimation: (edgeId: string, animated: boolean) => void
  setNodeRunState: (nodeId: string, state: 'idle' | 'running' | 'success') => void
  setAllNodesRunState: (state: 'idle' | 'running' | 'success') => void
  updateNodeStatus: (id: string, status: NodeStatus, result?: unknown) => void
  resetExecutionStatus: () => void
  setStreamingPayload: (payload: string | null) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  /** 一键清空画布（先入栈历史，支持撤销） */
  clearCanvas: () => void
  /** 将当前选中的节点及内部连线写入剪贴板 */
  copySelection: () => void
  /** 从剪贴板粘贴：新 UUID、偏移 (30,30)、先 pushHistory，粘贴后选中新节点 */
  pasteFromClipboard: () => boolean
  /** 运行历史日志（不持久化），用于调试 */
  runLogs: RunLogEntry[]
  pushRunLog: (entry: RunLogEntry) => void
  /** 全局变量（Key-Value），用于 {{变量}} 回退注入，持久化 */
  globalVariables: Record<string, string>
  setGlobalVariables: (vars: Record<string, string>) => void
  setGlobalVariable: (key: string, value: string) => void
  removeGlobalVariable: (key: string) => void
  /** 用户保存的自定义模板，持久化（rehydrate 后无 icon，使用处需补默认 icon） */
  customTemplates: StoredWorkflowTemplate[]
  addCustomTemplate: (template: WorkflowTemplate) => void
  removeCustomTemplate: (id: string) => void
  /** 工作流是否正在执行（不持久化） */
  isExecuting: boolean
  setExecuting: (v: boolean) => void
  /** 当前执行的 AbortController，由调用方在开始时注入，取消时调用 abort（不持久化） */
  executionAbortController: AbortController | null
  setExecutionAbortController: (ac: AbortController | null) => void
  /** 中断/取消当前执行 */
  cancelExecution: () => void
  /** 单步测试时若缺变量，弹窗收集 Mock 值（nodeId + 缺失变量名列表），不持久化 */
  mockDialog: { nodeId: string; missing: string[] } | null
  setMockDialog: (v: { nodeId: string; missing: string[] } | null) => void
  /** 基于 edges 计算并返回指定节点的所有前驱节点（用于变量自动补全等） */
  getUpstreamNodes: (nodeId: string) => WorkflowNode[]
  /** 在指定连线中点插入新节点：删除原边，新增节点与上下两截边 */
  insertNodeBetween: (edgeId: string, nodeType: string, position: { x: number; y: number }) => void
}

function snapshot(nodes: WorkflowNode[], edges: Edge[]): HistorySnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
  }
}

function cleanNodesForPersist(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n) => ({
    ...n,
    data: n.data
      ? { ...n.data, status: undefined, runResult: undefined, runState: undefined }
      : n.data,
  }))
}

function cleanEdgesForPersist(edges: Edge[]): Edge[] {
  return edges.map((e) => ({ ...e, animated: false }))
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
  nodes: [],
  edges: [],
  streamingPayload: null,
  clipboard: null,
  runLogs: [],
  globalVariables: {},
  customTemplates: [],
  isExecuting: false,
  executionAbortController: null,
  setExecuting: (v) => set({ isExecuting: v }),
  setExecutionAbortController: (ac) => set({ executionAbortController: ac }),
  cancelExecution: () => {
    const ac = get().executionAbortController
    if (ac) ac.abort()
  },
  mockDialog: null,
  setMockDialog: (v) => set({ mockDialog: v }),
  getUpstreamNodes: (nodeId) => {
    const { nodes, edges } = get()
    const sourceIds = new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source))
    return nodes.filter((n) => sourceIds.has(n.id))
  },

  insertNodeBetween: (edgeId, nodeType, position) => {
    const { nodes, edges, pushHistory, setNodes, setEdges } = get()
    const oldEdge = edges.find((e) => e.id === edgeId)
    if (!oldEdge) return
    const nextId = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
    const newNodeId = nextId()
    const newNode: WorkflowNode = {
      id: newNodeId,
      type: nodeType as WorkflowNode['type'],
      position: { x: position.x, y: position.y },
      data: getDefaultNodeData(nodeType as NodeType),
    }
    const newEdges: Edge[] = [
      {
        id: nextId(),
        source: oldEdge.source,
        sourceHandle: oldEdge.sourceHandle ?? undefined,
        target: newNodeId,
      },
      {
        id: nextId(),
        source: newNodeId,
        target: oldEdge.target,
        targetHandle: oldEdge.targetHandle ?? undefined,
      },
    ]
    pushHistory()
    setNodes([...nodes, newNode])
    setEdges([...edges.filter((e) => e.id !== edgeId), ...newEdges])
  },

  addCustomTemplate: (template) =>
    set((state) => ({ customTemplates: [...state.customTemplates, template] })),
  removeCustomTemplate: (id) =>
    set((state) => ({ customTemplates: state.customTemplates.filter((t) => t.id !== id) })),
  past: [],
  future: [],
  _hasHydrated: false,
  setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),
  selectedNodeForDebug: null,
  setSelectedNodeForDebug: (id: string | null) => set({ selectedNodeForDebug: id }),

  pushHistory: () => {
    const { nodes, edges, past } = get()
    const nextPast = [...past, snapshot(nodes, edges)].slice(-MAX_HISTORY)
    set({ past: nextPast, future: [] })
  },

  clearCanvas: () => {
    get().pushHistory()
    set({ nodes: [], edges: [] })
  },

  copySelection: () => {
    const { nodes, edges } = get()
    const selected = nodes.filter((n) => n.selected)
    if (selected.length === 0) return
    const idSet = new Set(selected.map((n) => n.id))
    const internalEdges = edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    )
    set({
      clipboard: {
        nodes: selected.map((n) => ({ ...n })),
        edges: internalEdges.map((e) => ({ ...e })),
      },
    })
  },

  pushRunLog: (entry) => {
    set({
      runLogs: [entry, ...get().runLogs].slice(0, MAX_RUN_LOGS),
    })
  },

  setGlobalVariables: (vars) => set({ globalVariables: vars }),
  setGlobalVariable: (key, value) => {
    set({
      globalVariables: { ...get().globalVariables, [key]: value },
    })
  },
  removeGlobalVariable: (key) => {
    const next = { ...get().globalVariables }
    delete next[key]
    set({ globalVariables: next })
  },

  pasteFromClipboard: () => {
    const { clipboard, nodes, edges, pushHistory, setNodes, setEdges } = get()
    if (!clipboard || clipboard.nodes.length === 0) return false
    pushHistory()
    const nextId = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
    const idMap = new Map<string, string>()
    clipboard.nodes.forEach((n) => idMap.set(n.id, nextId()))
    const newNodes: WorkflowNode[] = clipboard.nodes.map((n) => {
      const newId = idMap.get(n.id) as string
      return {
        ...n,
        id: newId,
        position: {
          x: n.position.x + 30,
          y: n.position.y + 30,
        },
        selected: true,
        data: n.data ? { ...n.data } : {},
      }
    })
    const newEdges: Edge[] = clipboard.edges.map((e) => ({
      ...e,
      id: nextId(),
      source: idMap.get(e.source) as string,
      target: idMap.get(e.target) as string,
    }))
    const existingNodesDeselected = nodes.map((n) => ({ ...n, selected: false }))
    setNodes([...existingNodesDeselected, ...newNodes])
    setEdges([...edges, ...newEdges])
    return true
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setEdgeAnimated: (edgeId, animated) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, animated } : e
      ),
    })
  },
  setEdgesAnimated: (edgeIds, animated) => {
    const ids = new Set(edgeIds)
    set({
      edges: get().edges.map((e) =>
        ids.has(e.id) ? { ...e, animated } : e
      ),
    })
  },
  updateEdgeAnimation: (edgeId, animated) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, animated } : e
      ),
    })
  },

  setNodeRunState: (nodeId, state) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, runState: state } } : n
      ),
    })
  },
  setAllNodesRunState: (state) => {
    set({
      nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, runState: state } })),
    })
  },

  updateNodeStatus: (id, status, result) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                status,
                runResult: result !== undefined ? result : n.data?.runResult,
                runState:
                  status === 'running' ? 'running' : status === 'success' ? 'success' : status === 'skipped' ? 'idle' : 'idle',
              },
            }
          : n
      ),
    })
  },

  resetExecutionStatus: () => {
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: 'idle' as const, runResult: undefined, runState: 'idle' as const },
      })),
      edges: get().edges.map((e) => ({ ...e, animated: false })),
      streamingPayload: null,
    })
  },

  setStreamingPayload: (payload) => set({ streamingPayload: payload }),

  undo: () => {
    const { past, nodes, edges, future } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    const nextPast = past.slice(0, -1)
    const nextFuture = [snapshot(nodes, edges), ...future]
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: nextPast,
      future: nextFuture.slice(0, MAX_HISTORY),
    })
  },

  redo: () => {
    const { future, nodes, edges, past } = get()
    if (future.length === 0) return
    const next = future[0]
    const nextFuture = future.slice(1)
    const nextPast = [...past, snapshot(nodes, edges)].slice(-MAX_HISTORY)
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: nextPast,
      future: nextFuture,
    })
  },

  onNodesChange: (changes: NodeChange[]) => {
    if (changes.length === 0) return
    const { nodes, pushHistory } = get()
    const hasRemove = changes.some((c) => (c as { type?: string }).type === 'remove')
    if (hasRemove) pushHistory()
    set({
      nodes: applyNodeChanges(changes, nodes),
    })
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    if (changes.length === 0) return
    const { edges, pushHistory } = get()
    const hasRemove = changes.some((c) => (c as { type?: string }).type === 'remove')
    if (hasRemove) pushHistory()
    set({
      edges: applyEdgeChanges(changes, edges),
    })
  },

  onConnect: (connection: Connection) => {
    const { edges, pushHistory } = get()
    pushHistory()
    set({
      edges: addEdge(connection, edges),
    })
  },

  addNode: (node: WorkflowNode) => {
    const { nodes, pushHistory } = get()
    pushHistory()
    set({
      nodes: [...nodes, node],
    })
  },

  removeNode: (id: string) => {
    get().pushHistory()
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    })
  },

  removeEdge: (id: string) => {
    get().pushHistory()
    set({ edges: get().edges.filter((e) => e.id !== id) })
  },

  // 仅对目标节点创建新引用，其余节点保持 n 不变，便于 React.memo 与 React Flow 避免多余重渲染
  updateNodeData: (id: string, data: Partial<WorkflowNode['data']>) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })
  },
}),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        nodes: cleanNodesForPersist(state.nodes),
        edges: cleanEdgesForPersist(state.edges),
        globalVariables: state.globalVariables,
        customTemplates: state.customTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          nodes: t.nodes,
          edges: t.edges,
        })),
      }),
      onRehydrateStorage: () => () => {
        useWorkflowStore.getState().setHasHydrated(true)
      },
    }
  )
)
