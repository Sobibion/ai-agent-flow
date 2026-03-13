import { useState, useCallback, useEffect } from 'react'
import { X, Play } from 'lucide-react'
import type { Node } from 'reactflow'
import type { StartNodeData } from '../types/workflow'

export interface RunWorkflowDialogProps {
  open: boolean
  onClose: () => void
  /** 当前画布节点，用于解析 StartNode 的 params keys */
  nodes: Node[]
  /** 用户点击「开始执行」时传入本次填写的入参 */
  onStartExecution: (params: Record<string, string>) => void
}

function getStartParams(nodes: Node[]): Record<string, string> {
  const start = nodes.find((n) => n.type === 'startNode')
  if (!start || !start.data) return {}
  const params = (start.data as StartNodeData).params
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (typeof k === 'string' && k.trim()) out[k.trim()] = typeof v === 'string' ? v : String(v)
  }
  return out
}

export function RunWorkflowDialog({ open, onClose, nodes, onStartExecution }: RunWorkflowDialogProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [paramKeys, setParamKeys] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      const params = getStartParams(nodes)
      const keys = Object.keys(params)
      setParamKeys(keys)
      const initial: Record<string, string> = {}
      keys.forEach((k) => {
        initial[k] = params[k] != null ? String(params[k]) : ''
      })
      setFormValues(initial)
    }
  }, [open, nodes])

  const handleChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleStart = useCallback(() => {
    const payload: Record<string, string> = {}
    paramKeys.forEach((k) => {
      payload[k] = formValues[k] != null ? String(formValues[k]) : ''
    })
    onStartExecution(payload)
    onClose()
  }, [paramKeys, formValues, onStartExecution, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-workflow-dialog-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="run-workflow-dialog-title" className="text-sm font-semibold text-slate-800">
            运行工作流 · 起点入参
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
          {paramKeys.length === 0 ? (
            <p className="text-sm text-slate-500">
              起点节点未定义入参，将使用空对象执行。可在起点节点中「添加入参」后再运行。
            </p>
          ) : (
            <div className="space-y-3">
              {paramKeys.map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{key}</label>
                  <input
                    type="text"
                    value={formValues[key] != null ? formValues[key] : ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={`输入 ${key}`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            开始执行
          </button>
        </div>
      </div>
    </div>
  )
}
