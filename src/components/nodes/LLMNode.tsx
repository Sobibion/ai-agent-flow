import { memo, useCallback } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { Bot, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { LLMNodeData } from '../../types/workflow'
import { runSingleNode, MissingVariablesError } from '../../utils/executor'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'

const MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'qwen-plus', label: '通义千问 Plus' },
  { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct（硅基流动免费）' },
  { value: 'glm-4', label: 'GLM-4' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
]

const DEFAULT_LLM_MODEL = 'deepseek-chat'

function getDefaultBaseUrlPlaceholder(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
  return (env.VITE_OPENAI_BASE_URL as string) || 'https://api.deepseek.com'
}

function LLMNodeComponent({ id, data, selected }: NodeProps<LLMNodeData>) {
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
  const modelName = (data && data.modelName) ? data.modelName : DEFAULT_LLM_MODEL
  const temperature = typeof (data && data.temperature) === 'number' ? data.temperature : 0.7
  const responseFormat = (data && data.responseFormat) === 'json_object' ? 'json_object' : 'text'
  const apiKey = (data && data.apiKey) != null ? data.apiKey : ''
  const baseURL = (data && data.baseURL) != null ? data.baseURL : ''
  const retryCount = typeof (data && data.retryCount) === 'number' ? data.retryCount : 0
  const retryInterval = typeof (data && data.retryInterval) === 'number' ? data.retryInterval : 1000
  const status = getNodeStatus(data)
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { modelName: e.target.value.trim() })
    },
    [id, updateNodeData]
  )
  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value)
      if (!Number.isNaN(value)) {
        updateNodeData(id, { temperature: value })
      }
    },
    [id, updateNodeData]
  )
  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { apiKey: e.target.value })
    },
    [id, updateNodeData]
  )
  const handleBaseURLChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { baseURL: e.target.value })
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
  const handleJsonModeToggle = useCallback(() => {
    updateNodeData(id, { responseFormat: responseFormat === 'json_object' ? 'text' : 'json_object' })
  }, [id, responseFormat, updateNodeData])

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
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-indigo-50 px-4 py-3 text-indigo-700 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">大模型节点</span>
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
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">模型（可下拉选择或手动输入）</label>
          <input
            type="text"
            value={modelName}
            onChange={handleModelChange}
            onKeyDown={(e) => e.stopPropagation()}
            list={`llm-models-${id}`}
            placeholder="输入或选择模型名称"
            className="nodrag nopan nowheel w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
          <datalist id={`llm-models-${id}`}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value} label={m.label} />
            ))}
          </datalist>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temperature</label>
            <span className="text-xs text-slate-400">{temperature.toFixed(1)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={handleTemperatureChange}
              onKeyDown={(e) => e.stopPropagation()}
              className="nodrag nopan nowheel h-2 w-full cursor-pointer accent-indigo-600"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
          <span className="text-xs font-medium text-slate-600">强制 JSON 输出</span>
          <button
            type="button"
            role="switch"
            aria-checked={responseFormat === 'json_object'}
            onClick={handleJsonModeToggle}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') e.preventDefault() }}
            className={`nodrag nopan nowheel relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 ${
              responseFormat === 'json_object' ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                responseFormat === 'json_object' ? 'translate-x-5' : 'translate-x-0.5'
              }`}
              style={{ marginTop: 1 }}
            />
          </button>
        </div>
        <details className="group/details nodrag nopan">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg py-1.5 pr-1 text-[12px] text-slate-500 hover:bg-slate-100/80 hover:text-slate-600 [&::-webkit-details-marker]:hidden">
            <span>⚙️ 高级设置</span>
            <span className="shrink-0 transition-transform duration-200 group-open/details:rotate-180" aria-hidden>▼</span>
          </summary>
          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">API Key（可选，不填用环境变量）</label>
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="sk-..."
                autoComplete="off"
                className="nodrag nopan nowheel w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Base URL（可选）</label>
              <input
                type="text"
                value={baseURL}
                onChange={handleBaseURLChange}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={getDefaultBaseUrlPlaceholder()}
                className="nodrag nopan nowheel w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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
        {responseFormat === 'json_object' && (
          <p className="text-[10px] text-amber-600/90 leading-tight">
            请确保在 Prompt 中明确指引模型输出 JSON 的结构
          </p>
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

export const LLMNode = memo(LLMNodeComponent)
