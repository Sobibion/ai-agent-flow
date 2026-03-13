import { memo, useCallback } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { Code, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { CodeNodeData } from '../../types/workflow'
import { runSingleNode, WorkflowExecutionError } from '../../utils/executor'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'

export const CODE_NODE_DEFAULT_TEMPLATE = `function main(args) {
  // args 包含了所有的输入变量
  return { result: args.input };
}`

function CodeNodeComponent({ id, data, selected }: NodeProps<CodeNodeData>) {
  const {
    nodes,
    edges,
    updateNodeData,
    updateNodeStatus,
    updateEdgeAnimation,
    setStreamingPayload,
    globalVariables,
    setSelectedNodeForDebug,
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
      removeNode: s.removeNode,
    }))
  )
  const code = (data && data.code) != null ? data.code : CODE_NODE_DEFAULT_TEMPLATE
  const status = getNodeStatus(data as unknown)
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { code: e.target.value })
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
      const message = e instanceof WorkflowExecutionError ? e.message : (e instanceof Error ? e.message : '单步运行失败')
      toast.error(message)
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
        style={{ minWidth: 280 }}
      >
        <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-purple-50 px-4 py-3 text-purple-700 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold">代码节点</span>
          </div>
          <NodeStatusIndicator
            status={status}
            nodeId={id}
            onOpenDebug={setSelectedNodeForDebug}
            runnable
            onRunSingle={handleRunSingle}
          />
        </div>
        <div className="p-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
            代码（main(args) 返回对象将作为本节点输出）
          </label>
          <textarea
            value={code}
            onChange={handleCodeChange}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={CODE_NODE_DEFAULT_TEMPLATE}
            rows={10}
            className="nodrag nopan nowheel w-full resize-y rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 font-mono text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
            spellCheck={false}
          />
        </div>
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
        />
      </div>
    </>
  )
}

export const CodeNode = memo(CodeNodeComponent)
