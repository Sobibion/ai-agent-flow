import { memo, useState, useCallback, useEffect, useRef } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow'
import { Plus, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { NodeType } from '../../types/workflow'

/** 连线中点可插入的节点类型（不含起点/终点） */
const INSERTABLE_NODE_TYPES: { type: NodeType; label: string }[] = [
  { type: 'llmNode', label: '大模型' },
  { type: 'promptNode', label: '提示词' },
  { type: 'codeNode', label: '代码节点' },
  { type: 'httpNode', label: 'HTTP 请求' },
  { type: 'conditionNode', label: '条件判断' },
]

function AnimatedEdgeComponent({
  id,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  animated = false,
  style,
  markerEnd,
  markerStart,
  pathOptions,
  interactionWidth,
}: EdgeProps) {
  const removeEdge = useWorkflowStore(useShallow((s) => s.removeEdge))
  const insertNodeBetween = useWorkflowStore(useShallow((s) => s.insertNodeBetween))
  const [hovered, setHovered] = useState(false)
  /** 延迟隐藏，避免从边移向加号时加号先消失再出现导致闪烁 */
  const [displayHovered, setDisplayHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
      setDisplayHovered(true)
    } else {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => setDisplayHovered(false), 120)
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [hovered])

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: pathOptions?.borderRadius ?? 8,
    offset: pathOptions?.offset,
  })
  const labelX = (sourceX + targetX) / 2
  const labelY = (sourceY + targetY) / 2

  const showPlusButton = displayHovered && !menuOpen
  /** 选中即显示删除；与加号同时出现时删除在左、加号在右，不互相替换 */
  const showDeleteButton = selected && !menuOpen

  const handlePlusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen((prev) => !prev)
  }, [])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const handleInsertNode = useCallback(
    (nodeType: string) => {
      insertNodeBetween(id, nodeType, { x: labelX - 150, y: labelY - 50 })
      closeMenu()
    },
    [id, insertNodeBetween, labelX, labelY, closeMenu]
  )

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen, closeMenu])

  return (
    <>
      <g
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          if (!menuOpen) setMenuOpen(false)
        }}
      >
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          markerStart={markerStart}
          style={style}
          interactionWidth={interactionWidth}
        />
        {animated && (
          <>
            <path
              className="react-flow__edge-animated-stroke"
              d={path}
              fill="none"
              stroke={`url(#animatedEdgeGradient-${id})`}
              strokeWidth={2.5}
              strokeDasharray="8 6"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 2px rgba(34, 197, 94, 0.6))' }}
            />
            <defs>
              <linearGradient id={`animatedEdgeGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#4ade80" stopOpacity="1" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </>
        )}
      </g>
      <EdgeLabelRenderer>
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 50,
            minWidth: 56,
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {showDeleteButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeEdge(id)
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
              title="删除连线"
              aria-label="删除连线"
            >
              <X size={14} />
            </button>
          )}
          {showPlusButton && (
            <button
              type="button"
              onClick={handlePlusClick}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-all hover:scale-110 hover:border-indigo-600 hover:text-indigo-600"
              title="在连线中插入节点"
              aria-label="在连线中插入节点"
            >
              <Plus size={14} />
            </button>
          )}
          {menuOpen && (
            <div
              className="absolute left-1/2 top-0 z-50 mt-2 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white shadow-lg"
              style={{ pointerEvents: 'all' }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-xs font-medium text-slate-500">插入节点</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeMenu()
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="关闭"
                  aria-label="关闭"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="py-1">
                {INSERTABLE_NODE_TYPES.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleInsertNode(type)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const AnimatedEdge = memo(AnimatedEdgeComponent)
