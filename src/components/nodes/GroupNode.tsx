import { memo, useCallback, useRef, useEffect } from 'react'
import { NodeResizeControl, NodeToolbar, type NodeProps } from 'reactflow'
import { Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { GroupNodeData } from '../../types/workflow'

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 200
const PLACEHOLDER = '📝 输入你的注释...'

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeData>) {
  const { updateNodeData, removeNode } = useWorkflowStore(
    useShallow((s) => ({
      updateNodeData: s.updateNodeData,
      removeNode: s.removeNode,
    }))
  )
  const label = (data && data.label) != null ? String(data.label) : ''
  const isPlaceholder = label.trim() === ''
  const inputRef = useRef<HTMLInputElement>(null)

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { label: e.target.value })
    },
    [id, updateNodeData]
  )

  const handleFocus = useCallback(() => {
    if (isPlaceholder && inputRef.current) {
      inputRef.current.select()
    }
  }, [isPlaceholder])

  return (
    <>
      <NodeToolbar isVisible={selected} position="top">
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={() => removeNode(id)}
            className="rounded-sm p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
            title="删除分组框"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </NodeToolbar>
      <div
        className="nopan rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/50 transition-colors hover:border-slate-400"
        style={{
          width: '100%',
          height: '100%',
          minWidth: 120,
          minHeight: 80,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={handleLabelChange}
          onFocus={handleFocus}
          placeholder={PLACEHOLDER}
          className="nodrag nopan absolute left-3 top-3 right-3 z-10 min-w-0 rounded bg-transparent px-1 py-0.5 text-sm font-medium text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
        />
        <NodeResizeControl
          nodeId={id}
          position="bottom-right"
          minWidth={120}
          minHeight={80}
          className="!border-slate-300 !bg-slate-200/80 hover:!bg-indigo-400/30"
          style={{ width: 12, height: 12, borderRadius: 2 }}
        >
          <span className="absolute bottom-0.5 right-0.5 text-slate-500" style={{ fontSize: 8 }}>▢</span>
        </NodeResizeControl>
      </div>
    </>
  )
}

export const GroupNode = memo(GroupNodeComponent)
