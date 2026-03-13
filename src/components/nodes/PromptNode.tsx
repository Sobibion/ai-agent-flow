import { memo, useCallback, useMemo } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { PromptNodeData } from '../../types/workflow'
import { runSingleNode, MissingVariablesError } from '../../utils/executor'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'
import { VariableTextarea } from '../VariableTextarea'

const VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g

function extractVariables(text: string): string[] {
  const names = new Set<string>()
  let match: RegExpExecArray | null = null
  const re = new RegExp(VARIABLE_REGEX.source, 'g')
  while ((match = re.exec(text)) !== null) {
    const name = match[1].trim()
    if (name) names.add(name)
  }
  return Array.from(names)
}

function PromptNodeComponent({ id, data, selected }: NodeProps<PromptNodeData>) {
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
  const template = (data && data.template) ? data.template : ''
  const variables = useMemo(() => extractVariables(template), [template])
  const status = getNodeStatus(data as unknown)
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

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
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-amber-50 px-4 py-3 text-amber-700 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">提示词节点</span>
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
          Prompt（输入 {'{{'} 触发上游变量补全）
        </label>
        <VariableTextarea
          value={template}
          onChange={(v) => {
            const extracted = extractVariables(v)
            updateNodeData(id, { template: v, variables: extracted })
          }}
          placeholder="例如：翻译以下文本: {{input}}"
          nodeId={id}
          rows={3}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variables.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                {'{{' + name + '}}'}
              </span>
            ))}
          </div>
        )}
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

export const PromptNode = memo(PromptNodeComponent)
