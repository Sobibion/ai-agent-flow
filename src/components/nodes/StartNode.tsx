import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeToolbar, type NodeProps } from 'reactflow'
import { Play, Trash2, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { NodeStatusIndicator, getNodeStatus } from './NodeStatusIndicator'
import type { StartNodeData } from '../../types/workflow'

interface KeyValueRow {
  key: string
  value: string
}

function fromParams(params: Record<string, string> | undefined): KeyValueRow[] {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return [{ key: '', value: '' }]
  const entries = Object.entries(params).map(([k, v]) => ({ key: k, value: String(v) }))
  return entries.length > 0 ? entries : [{ key: '', value: '' }]
}

function toParams(rows: KeyValueRow[]): Record<string, string> {
  const obj: Record<string, string> = {}
  rows.forEach(({ key, value }) => {
    const k = key.trim()
    if (k) obj[k] = value
  })
  return obj
}

function StartNodeComponent({ id, data, selected }: NodeProps<StartNodeData>) {
  const status = getNodeStatus(data)
  const { setSelectedNodeForDebug, removeNode, updateNodeData } = useWorkflowStore(
    useShallow((s) => ({
      setSelectedNodeForDebug: s.setSelectedNodeForDebug,
      removeNode: s.removeNode,
      updateNodeData: s.updateNodeData,
    }))
  )
  const runningClass = status === 'running' && selected !== true ? 'ring-2 ring-indigo-500/20' : ''
  const [rows, setRows] = useState<KeyValueRow[]>(() => fromParams(data?.params))

  useEffect(() => {
    setRows(fromParams(data?.params))
  }, [id])

  const prevParamsRef = useRef<Record<string, string> | undefined>(undefined)
  useEffect(() => {
    const next = toParams(rows)
    if (prevParamsRef.current === undefined || JSON.stringify(prevParamsRef.current) !== JSON.stringify(next)) {
      prevParamsRef.current = next
      updateNodeData(id, { params: next })
    }
  }, [id, rows, updateNodeData])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateRow = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }, [])

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
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-emerald-50 px-4 py-3 text-emerald-700 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">起点</span>
        </div>
        <NodeStatusIndicator status={status} nodeId={id} onOpenDebug={setSelectedNodeForDebug} />
      </div>
      <div className="p-3">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
          系统初始入参
        </label>
        <ul className="space-y-2 mb-2">
          {rows.map((row, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={row.key}
                onChange={(e) => updateRow(index, 'key', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="变量名 (Key)"
                className="nodrag nopan nowheel flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-md text-sm px-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateRow(index, 'value', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="值 (Value)"
                className="nodrag nopan nowheel flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-md text-sm px-2 py-1 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="删除该行"
                aria-label="删除该行"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 w-full justify-center px-3 py-1.5 text-sm font-medium text-slate-600 rounded-md border border-dashed border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          添加入参
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full hover:!bg-indigo-500 hover:!border-indigo-500 transition-colors"
      />
    </div>
    </>
  )
}

export const StartNode = memo(StartNodeComponent)
