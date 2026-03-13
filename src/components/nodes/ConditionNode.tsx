import { memo, useCallback } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { GitBranch, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { ConditionNodeData, ConditionOperator } from '../../types/workflow'
import { runSingleNode, MissingVariablesError } from '../../utils/executor'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '等于' },
  { value: '!=', label: '不等于' },
  { value: 'contains', label: '包含' },
]

const COMMON_VARIABLES = [
  { value: 'input', label: 'input' },
  { value: 'prompt', label: 'prompt' },
  { value: 'response', label: 'response' },
]

function ConditionNodeComponent({ id, data, selected }: NodeProps<ConditionNodeData>) {
  const {
    nodes,
    edges,
    updateNodeData,
    updateNodeStatus,
    updateEdgeAnimation,
    setStreamingPayload,
    globalVariables,
    setSelectedNodeForDebug,
    setMockDialog,
    removeNode,
  } = useWorkflowStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      updateNodeData: s.updateNodeData,
      updateNodeStatus: s.updateNodeStatus,
      updateEdgeAnimation: s.updateEdgeAnimation,
      setStreamingPayload: s.setStreamingPayload,
      globalVariables: s.globalVariables,
      setSelectedNodeForDebug: s.setSelectedNodeForDebug,
      setMockDialog: s.setMockDialog,
      removeNode: s.removeNode,
    }))
  )
  const variable = (data && data.variable) ? data.variable : 'input'
  const operator = (data && data.operator) ? data.operator : 'contains'
  const value = (data && data.value) != null ? data.value : ''
  const status = getNodeStatus(data as unknown)
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

  const handleVariableChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { variable: e.target.value })
    },
    [id, updateNodeData]
  )
  const handleOperatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { operator: e.target.value as ConditionOperator })
    },
    [id, updateNodeData]
  )
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { value: e.target.value })
    },
    [id, updateNodeData]
  )

  const handleRunSingle = useCallback(async () => {
    const storeActions = { updateNodeStatus, updateEdgeAnimation, setStreamingPayload }
    try {
      await runSingleNode(nodes, edges, id, storeActions, { globalVariables })
      setSelectedNodeForDebug(id)
      toast.success('单步运行成功')
    } catch (e) {
      if (e instanceof MissingVariablesError) {
        setMockDialog({ nodeId: id, missing: e.missing })
      } else {
        toast.error(e instanceof Error ? e.message : '单步运行失败')
      }
    }
  }, [
    nodes,
    edges,
    id,
    updateNodeStatus,
    updateEdgeAnimation,
    setStreamingPayload,
    globalVariables,
    setSelectedNodeForDebug,
    setMockDialog,
  ])

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
        style={{ minWidth: 220 }}
      >
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-blue-50 px-4 py-3 text-blue-700 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">条件判断</span>
        </div>
        <NodeStatusIndicator
          status={status}
          nodeId={id}
          onOpenDebug={setSelectedNodeForDebug}
          runnable
          onRunSingle={handleRunSingle}
        />
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
          <select
            value={variable}
            onChange={handleVariableChange}
            onKeyDown={(e) => e.stopPropagation()}
            className="nodrag nopan nowheel bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            title="变量名"
          >
            {COMMON_VARIABLES.map((v) => (
              <option key={v.value} value={v.value}>
                {'{{' + v.label + '}}'}
              </option>
            ))}
          </select>
          <select
            value={operator}
            onChange={handleOperatorChange}
            onKeyDown={(e) => e.stopPropagation()}
            className="nodrag nopan nowheel w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            title="运算符"
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={value}
            onChange={handleValueChange}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="对比值"
            className="nodrag nopan nowheel bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
      />
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-2">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[10px] font-medium text-emerald-600">True</span>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[10px] font-medium text-rose-600">False</span>
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
          />
        </div>
      </div>
      </div>
    </>
  )
}

export const ConditionNode = memo(ConditionNodeComponent)
