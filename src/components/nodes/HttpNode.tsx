import { memo, useCallback } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { Globe, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { HttpNodeData, HttpMethod } from '../../types/workflow'
import { runSingleNode, MissingVariablesError } from '../../utils/executor'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'
import { VariableTextarea } from '../VariableTextarea'

const METHODS: { value: HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
]

function HttpNodeComponent({ id, data, selected }: NodeProps<HttpNodeData>) {
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
  const method = (data && data.method) ? data.method : 'GET'
  const url = (data && data.url) != null ? data.url : ''
  const headers = (data && data.headers) != null ? data.headers : '{}'
  const body = (data && data.body) != null ? data.body : ''
  const retryCount = typeof (data && data.retryCount) === 'number' ? data.retryCount : 0
  const retryInterval = typeof (data && data.retryInterval) === 'number' ? data.retryInterval : 1000
  const status = getNodeStatus(data as unknown)
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

  const handleMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { method: e.target.value as HttpMethod })
    },
    [id, updateNodeData]
  )
  const handleHeadersChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { headers: e.target.value })
    },
    [id, updateNodeData]
  )
  const handleRetryCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!Number.isNaN(value) && value >= 0) {
        updateNodeData(id, { retryCount: value })
      }
    },
    [id, updateNodeData]
  )
  const handleRetryIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!Number.isNaN(value) && value >= 0) {
        updateNodeData(id, { retryInterval: value })
      }
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
        style={{ minWidth: 260 }}
      >
        <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-cyan-50 px-4 py-3 text-cyan-700 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold">HTTP 请求</span>
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
          <div className="flex gap-2">
            <div className="w-24 shrink-0">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Method</label>
              <select
                value={method}
                onChange={handleMethodChange}
                onKeyDown={(e) => e.stopPropagation()}
                className="nodrag nopan nowheel w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">URL（输入 {'{{'} 触发变量补全）</label>
              <VariableTextarea
                value={url}
                onChange={(v) => updateNodeData(id, { url: v })}
                placeholder="https://api.example.com/{{path}}"
                nodeId={id}
                singleLine
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          {method === 'POST' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Body（输入 {'{{'} 触发变量补全）</label>
              <VariableTextarea
                value={body}
                onChange={(v) => updateNodeData(id, { body: v })}
                placeholder='{"key": "{{value}}"}'
                nodeId={id}
                rows={3}
                className="font-mono text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <details className="group/details nodrag nopan">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg py-1.5 pr-1 text-[12px] text-slate-500 hover:bg-slate-100/80 hover:text-slate-600 [&::-webkit-details-marker]:hidden">
              <span>⚙️ 高级设置</span>
              <span className="shrink-0 transition-transform duration-200 group-open/details:rotate-180" aria-hidden>▼</span>
            </summary>
            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Headers（JSON）</label>
                <textarea
                  value={headers}
                  onChange={handleHeadersChange}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder='{"Content-Type": "application/json"}'
                  rows={2}
                  className="nodrag nopan nowheel w-full resize-y bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">最大重试次数</label>
                  <input
                    type="number"
                    min={0}
                    value={retryCount}
                    onChange={handleRetryCountChange}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="nodrag nopan nowheel w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">重试间隔(ms)</label>
                  <input
                    type="number"
                    min={0}
                    value={retryInterval}
                    onChange={handleRetryIntervalChange}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="nodrag nopan nowheel w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </details>
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

export const HttpNode = memo(HttpNodeComponent)
