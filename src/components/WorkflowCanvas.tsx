import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useStore,
  useStoreApi,
  internalsSymbol,
  type Connection,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { DRAG_TYPE } from './Sidebar'
import type { NodeType, WorkflowNode } from '../types/workflow'
import { getDefaultNodeData } from '../utils/getDefaultNodeData'
import { NODE_PALETTE_TEMPLATES } from '../config/nodePalette'

/** 辅助线类型：边缘/中心排版线 + Handle 精准对齐局部红线 */
export interface HelperLinesState {
  horizontalTop?: number
  verticalCenter?: number
  verticalLeft?: number
  /** Handle 之间精准对齐的局部红线（消除拐点） */
  handleLine?: { y: number; x1: number; x2: number }
}

/** 智能辅助线：严格挂载到画布 transform，蓝线排版 + 红线 Handle 局部线 */
const HelperLines = ({ lines }: { lines: HelperLinesState }) => {
  const transform = useStore((state) => state.transform)
  if (!lines || Object.keys(lines).length === 0) return null

  const normalWidth = 1.5 / transform[2]
  const boldWidth = 2 / transform[2]

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
      aria-hidden
    >
      <g transform={`translate(${transform[0]}, ${transform[1]}) scale(${transform[2]})`}>
        {lines.horizontalTop !== undefined && (
          <line
            x1={-100000}
            y1={lines.horizontalTop}
            x2={100000}
            y2={lines.horizontalTop}
            stroke="#6366f1"
            strokeDasharray="5 5"
            strokeWidth={normalWidth}
          />
        )}
        {lines.verticalCenter !== undefined && (
          <line
            x1={lines.verticalCenter}
            y1={-100000}
            x2={lines.verticalCenter}
            y2={100000}
            stroke="#6366f1"
            strokeDasharray="5 5"
            strokeWidth={normalWidth}
          />
        )}
        {lines.verticalLeft !== undefined && (
          <line
            x1={lines.verticalLeft}
            y1={-100000}
            x2={lines.verticalLeft}
            y2={100000}
            stroke="#6366f1"
            strokeDasharray="5 5"
            strokeWidth={normalWidth}
          />
        )}
        {lines.handleLine && (
          <line
            x1={lines.handleLine.x1}
            y1={lines.handleLine.y}
            x2={lines.handleLine.x2}
            y2={lines.handleLine.y}
            stroke="#ef4444"
            strokeWidth={boldWidth}
            strokeDasharray="4 4"
          />
        )}
      </g>
    </svg>
  )
}

interface ContextMenuState {
  clientX: number
  clientY: number
  flowX: number
  flowY: number
}

const canvasPlaceholder = (
  <div className="h-full w-full bg-slate-100 rounded-r-lg" aria-hidden />
)

/** 在 ReactFlow 内部同步 store 到 ref，供 onNodeDrag 使用（useStoreApi 必须在 Provider 内调用） */
function StoreRefSync({ storeRef }: { storeRef: React.MutableRefObject<ReturnType<typeof useStoreApi> | null> }) {
  const store = useStoreApi()
  useEffect(() => {
    storeRef.current = store
    return () => {
      storeRef.current = null
    }
  }, [store, storeRef])
  return null
}

export function WorkflowCanvas() {
  const storeRef = useRef<ReturnType<typeof useStoreApi> | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [contextMenuFilter, setContextMenuFilter] = useState('')
  const [helperLines, setHelperLines] = useState<HelperLinesState>({})
  const snapPositionRef = useRef<{ x?: number; y?: number } | null>(null)
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, removeNode, removeEdge, copySelection, pasteFromClipboard, setNodes } =
    useWorkflowStore(
      useShallow((s) => ({
        nodes: s.nodes,
        edges: s.edges,
        onNodesChange: s.onNodesChange,
        onEdgesChange: s.onEdgesChange,
        onConnect: s.onConnect,
        addNode: s.addNode,
        removeNode: s.removeNode,
        removeEdge: s.removeEdge,
        copySelection: s.copySelection,
        pasteFromClipboard: s.pasteFromClipboard,
        setNodes: s.setNodes,
      }))
    )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
        return
      }
      const activeElement = document.activeElement
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && (
          activeElement.closest('.nodrag') != null ||
          activeElement.isContentEditable
        ))
      if (isInputFocused) {
        return
      }

      const isCopy = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c'
      const isPaste = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v'
      if (isCopy) {
        copySelection()
        return
      }
      if (isPaste) {
        e.preventDefault()
        if (pasteFromClipboard()) {
          toast.success('粘贴成功')
        }
        return
      }

      const isDelete = e.key === 'Backspace' || e.key === 'Delete'
      if (isDelete) {
        const selectedEdges = edges.filter((ed) => ed.selected === true)
        const selectedNodes = nodes.filter((n) => n.selected === true)
        if (selectedEdges.length > 0 || selectedNodes.length > 0) {
          e.preventDefault()
          selectedEdges.forEach((ed) => removeEdge(ed.id))
          selectedNodes.forEach((n) => removeNode(n.id))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [copySelection, pasteFromClipboard, edges, nodes, removeEdge, removeNode])

  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as HTMLElement)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => onNodesChange(changes),
    [onNodesChange]
  )
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => onEdgesChange(changes),
    [onEdgesChange]
  )
  const handleConnect: OnConnect = useCallback(
    (connection) => onConnect(connection),
    [onConnect]
  )

  const connectionRejectedRef = useRef<'cycle' | null>(null)

  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      if (connection.source === connection.target) return false

      const target = nodes.find((n) => n.id === connection.target)
      if (!target) return false

      const hasCycle = (node: Node, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) return false
        visited.add(node.id)
        const outEdges = edges.filter((e) => e.source === node.id)
        for (const edge of outEdges) {
          if (edge.target === connection.source) return true
          const outgoer = nodes.find((n) => n.id === edge.target)
          if (outgoer && hasCycle(outgoer, visited)) return true
        }
        return false
      }

      if (hasCycle(target)) {
        connectionRejectedRef.current = 'cycle'
        return false
      }
      connectionRejectedRef.current = null
      return true
    },
    [nodes, edges]
  )

  const onConnectError = useCallback(() => {
    if (connectionRejectedRef.current === 'cycle') {
      toast.error('禁止连线：此连接会导致工作流陷入死循环！', {
        id: 'cycle-connection-error',
        duration: 3000,
      })
      connectionRejectedRef.current = null
    }
  }, [])

  const handleConnectEnd = useCallback(
    (_: MouseEvent | TouchEvent) => {
      onConnectError()
    },
    [onConnectError]
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(DRAG_TYPE) as NodeType | ''
      if (!type || !reactFlowRef.current) return
      const position = reactFlowRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      const node: Record<string, unknown> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultNodeData(type),
      }
      if (type === 'groupNode') {
        node.style = { width: 400, height: 200, zIndex: -1 }
      }
      addNode(node as WorkflowNode)
    },
    [addNode]
  )

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!reactFlowRef.current) return
      const position = reactFlowRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      setContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        flowX: position.x,
        flowY: position.y,
      })
      setContextMenuFilter('')
    },
    []
  )

  const handlePaneClick = useCallback(() => {
    setContextMenu(null)
  }, [])

  const addNodeAtContextMenu = useCallback(
    (type: NodeType) => {
      if (!contextMenu) return
      const node: Record<string, unknown> = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: contextMenu.flowX, y: contextMenu.flowY },
        data: getDefaultNodeData(type),
      }
      if (type === 'groupNode') {
        node.style = { width: 400, height: 200, zIndex: -1 }
      }
      addNode(node as WorkflowNode)
      setContextMenu(null)
    },
    [contextMenu, addNode]
  )

  const filteredPalette = contextMenuFilter.trim() === ''
    ? NODE_PALETTE_TEMPLATES
    : NODE_PALETTE_TEMPLATES.filter((item) => {
        const q = contextMenuFilter.toLowerCase()
        return item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
      })

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      const store = storeRef.current
      if (!store) return
      snapPositionRef.current = null
      const { nodeInternals } = store.getState()
      const newLines: HelperLinesState = {}
      const snapThreshold = 15

      const draggedInternal = nodeInternals.get(draggedNode.id)
      const dragBounds = draggedInternal?.[internalsSymbol]?.handleBounds

      const dragHandles: { x: number; y: number }[] = []
      if (dragBounds) {
        const pushHandles = (list: Array<{ x: number; y: number; width?: number; height?: number }> | null) => {
          if (!list) return
          list.forEach((h) => {
            dragHandles.push({
              x: draggedNode.position.x + h.x + (h.width != null ? h.width / 2 : 0),
              y: draggedNode.position.y + h.y + (h.height != null ? h.height / 2 : 0),
            })
          })
        }
        pushHandles(dragBounds.source)
        pushHandles(dragBounds.target)
      }

      const dragX = draggedNode.position.x
      const dragY = draggedNode.position.y
      const dragW = ((draggedNode as Node & { measured?: { width?: number } }).measured?.width) || 200
      const dragCenterX = dragX + dragW / 2

      nodeInternals.forEach((targetInternal, targetId) => {
        if (targetId === draggedNode.id) return

        const targetX = targetInternal.position.x
        const targetY = targetInternal.position.y
        const targetW = ((targetInternal as Node & { measured?: { width?: number } }).measured?.width) || 200
        const targetCenterX = targetX + targetW / 2

        if (Math.abs(dragCenterX - targetCenterX) < snapThreshold) {
          newLines.verticalCenter = targetCenterX
          const perfectX = targetCenterX - dragW / 2
          snapPositionRef.current = { ...snapPositionRef.current, x: perfectX }
        } else if (Math.abs(dragX - targetX) < snapThreshold) {
          newLines.verticalLeft = targetX
          snapPositionRef.current = { ...snapPositionRef.current, x: targetX }
        }
        if (Math.abs(dragY - targetY) < snapThreshold) {
          newLines.horizontalTop = targetY
          snapPositionRef.current = { ...snapPositionRef.current, y: targetY }
        }

        const targetBounds = targetInternal[internalsSymbol]?.handleBounds
        if (targetBounds) {
          const checkHandles = (list: Array<{ x: number; y: number; width?: number; height?: number }> | null) => {
            if (!list) return
            list.forEach((h) => {
              const targetHandleX = targetX + h.x + (h.width != null ? h.width / 2 : 0)
              const targetHandleY = targetY + h.y + (h.height != null ? h.height / 2 : 0)
              dragHandles.forEach((dh) => {
                if (Math.abs(dh.y - targetHandleY) < snapThreshold) {
                  newLines.handleLine = {
                    y: targetHandleY,
                    x1: Math.min(dh.x, targetHandleX),
                    x2: Math.max(dh.x, targetHandleX),
                  }
                  const dragHandleOffsetY = dh.y - draggedNode.position.y
                  const perfectNodeY = targetHandleY - dragHandleOffsetY
                  snapPositionRef.current = { ...snapPositionRef.current, y: perfectNodeY }
                }
              })
            })
          }
          checkHandles(targetBounds.source)
          checkHandles(targetBounds.target)
        }
      })

      setHelperLines(newLines)
    },
    []
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      setHelperLines({})
      if (snapPositionRef.current) {
        const { x, y } = snapPositionRef.current
        const nextNodes = nodes.map((n) => {
          if (n.id === draggedNode.id) {
            return {
              ...n,
              position: {
                x: x !== undefined ? x : n.position.x,
                y: y !== undefined ? y : n.position.y,
              },
            }
          }
          return n
        })
        setNodes(nextNodes)
      }
      snapPositionRef.current = null
    },
    [nodes, setNodes]
  )

  if (!mounted) {
    return canvasPlaceholder
  }

  return (
    <div
      className="relative h-full w-full bg-slate-100"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={handlePaneClick}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={null}
        fitView
        className="rounded-r-lg"
      >
        <StoreRefSync storeRef={storeRef} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#94a3b8" />
        <HelperLines lines={helperLines} />
        <Controls
          className="!border-slate-200 !bg-white !shadow-md"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-slate-100 !border-slate-200"
          nodeColor="#cbd5e1"
          maskColor="rgb(241 245 249 / 0.8)"
        />
      </ReactFlow>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-xl"
          style={{
            left: Math.min(contextMenu.clientX + 8, window.innerWidth - 224),
            top: Math.min(contextMenu.clientY + 8, window.innerHeight - 320),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-100 px-2 pb-2">
            <input
              type="text"
              value={contextMenuFilter}
              onChange={(e) => setContextMenuFilter(e.target.value)}
              placeholder="搜索节点，如 llm、提示词..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              autoFocus
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filteredPalette.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">无匹配节点</li>
            ) : (
              filteredPalette.map(({ type, label, icon: Icon, color }) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => addNodeAtContextMenu(type)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span>{label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
