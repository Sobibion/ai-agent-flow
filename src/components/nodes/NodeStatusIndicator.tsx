import { memo, useCallback } from 'react'
import { Loader2, Check, X, Circle, Search, SkipForward } from 'lucide-react'
import type { NodeStatus } from '../../types/workflow'

const statusConfig: Record<
  NodeStatus,
  { icon: typeof Loader2; label: string; className: string; pulseRing?: boolean }
> = {
  idle: { icon: Circle, label: '空闲', className: 'bg-slate-100 text-slate-500', pulseRing: false },
  running: {
    icon: Loader2,
    label: '运行中',
    className: 'bg-indigo-100 text-indigo-700',
    pulseRing: true,
  },
  success: { icon: Check, label: '成功', className: 'bg-emerald-100 text-emerald-700', pulseRing: false },
  error: { icon: X, label: '错误', className: 'bg-red-100 text-red-700', pulseRing: false },
  skipped: { icon: SkipForward, label: '跳过', className: 'bg-slate-100 text-slate-500', pulseRing: false },
}

interface NodeStatusIndicatorProps {
  status: NodeStatus
  /** 节点 id，与 onOpenDebug 一起传入时，成功状态下显示「查看结果」按钮 */
  nodeId?: string
  onOpenDebug?: (id: string) => void
  /** 是否为可单步运行节点（LLM / HTTP / Prompt / Condition），为 true 时显示「单步测试」按钮 */
  runnable?: boolean
  /** 点击「单步测试」时回调，传入节点 id */
  onRunSingle?: (id: string) => void
}

function NodeStatusIndicatorComponent({
  status,
  nodeId,
  onOpenDebug,
  runnable,
  onRunSingle,
}: NodeStatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const showDebugButton = status === 'success' && nodeId && onOpenDebug
  const showRunSingleButton = runnable && nodeId && onRunSingle && status !== 'running'
  const handleOpenDebug = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (nodeId && onOpenDebug) onOpenDebug(nodeId)
    },
    [nodeId, onOpenDebug]
  )
  const handleRunSingle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (nodeId && onRunSingle) onRunSingle(nodeId)
    },
    [nodeId, onRunSingle]
  )

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className} ${
          config.pulseRing ? 'animate-pulse ring-2 ring-indigo-300/60 ring-offset-1 ring-offset-white' : ''
        }`}
        title={config.label}
      >
        {status === 'running' ? (
          <Icon className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <Icon className="h-3 w-3 shrink-0" />
        )}
        {config.label}
      </span>
      {showRunSingleButton && (
        <button
          type="button"
          onClick={handleRunSingle}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          title="单步测试"
          aria-label="单步测试"
        >
          <span aria-hidden>⚡</span>
          单步测试
        </button>
      )}
      {showDebugButton && (
        <button
          type="button"
          onClick={handleOpenDebug}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          title="查看执行结果"
          aria-label="查看执行结果"
        >
          <Search className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export const NodeStatusIndicator = memo(NodeStatusIndicatorComponent)

export function getNodeStatus(data: unknown): NodeStatus {
  if (data && typeof data === 'object' && 'status' in data && typeof (data as { status: unknown }).status === 'string') {
    const s = (data as { status: string }).status
    if (s === 'idle' || s === 'running' || s === 'success' || s === 'error' || s === 'skipped') return s as NodeStatus
  }
  if (data && typeof data === 'object' && 'runState' in data && typeof (data as { runState: unknown }).runState === 'string') {
    const r = (data as { runState: string }).runState
    if (r === 'idle' || r === 'running' || r === 'success') return r as NodeStatus
  }
  return 'idle'
}
