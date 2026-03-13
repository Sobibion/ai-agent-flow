import { memo } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { Square, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'

function EndNodeComponent({ id, data, selected }: NodeProps) {
  const status = getNodeStatus(data)
  const { setSelectedNodeForDebug, removeNode } = useWorkflowStore(
    useShallow((s) => ({ setSelectedNodeForDebug: s.setSelectedNodeForDebug, removeNode: s.removeNode }))
  )
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={() => removeNode(id)}
            className="rounded-sm p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
            title="删除节点"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </NodeToolbar>
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md ${
        selected ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''
      } ${runningClass}`}
      style={{ minWidth: 140 }}
    >
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-rose-50 px-4 py-3 text-rose-700 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Square className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">终点</span>
        </div>
        <NodeStatusIndicator status={status} nodeId={id} onOpenDebug={setSelectedNodeForDebug} />
      </div>
      <div className="px-4 py-3 text-xs text-slate-500">输出结果</div>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
      />
    </div>
    </>
  )
}

export const EndNode = memo(EndNodeComponent)
