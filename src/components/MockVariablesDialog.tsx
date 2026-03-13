import { useState, useCallback, useEffect } from 'react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { runSingleNode, WorkflowExecutionError } from '../utils/executor'
import { toast } from 'sonner'

export function MockVariablesDialog() {
  const mockDialog = useWorkflowStore((s) => s.mockDialog)
  const setMockDialog = useWorkflowStore((s) => s.setMockDialog)
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const updateNodeStatus = useWorkflowStore((s) => s.updateNodeStatus)
  const updateEdgeAnimation = useWorkflowStore((s) => s.updateEdgeAnimation)
  const setStreamingPayload = useWorkflowStore((s) => s.setStreamingPayload)
  const setSelectedNodeForDebug = useWorkflowStore((s) => s.setSelectedNodeForDebug)

  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mockDialog) {
      const initial: Record<string, string> = {}
      mockDialog.missing.forEach((k) => {
        initial[k] = ''
      })
      setValues(initial)
    }
  }, [mockDialog])

  const handleClose = useCallback(() => {
    setMockDialog(null)
  }, [setMockDialog])

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!mockDialog) return
    const { nodeId, missing } = mockDialog
    const mockVariables: Record<string, string> = {}
    missing.forEach((k) => {
      mockVariables[k] = values[k] != null ? String(values[k]).trim() : ''
    })
    setSubmitting(true)
    const storeActions = {
      updateNodeStatus,
      updateEdgeAnimation,
      setStreamingPayload,
    }
    try {
      await runSingleNode(nodes, edges, nodeId, storeActions, {
        globalVariables,
        mockVariables,
      })
      setSelectedNodeForDebug(nodeId)
      setMockDialog(null)
      toast.success('单步运行成功，已打开执行结果')
    } catch (err) {
      const message =
        err instanceof WorkflowExecutionError
          ? err.message
          : err instanceof Error
            ? err.message
            : '单步运行失败'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [
    mockDialog,
    values,
    nodes,
    edges,
    globalVariables,
    updateNodeStatus,
    updateEdgeAnimation,
    setStreamingPayload,
    setSelectedNodeForDebug,
    setMockDialog,
  ])

  if (!mockDialog) return null

  const { missing } = mockDialog

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden
        onClick={handleClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-label="填写 Mock 变量"
      >
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          单步测试 · 填写缺失变量
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          上游无执行结果，请为以下变量输入 Mock 值后运行。
        </p>
        <div className="space-y-2">
          {missing.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {key}
              </label>
              <input
                type="text"
                value={values[key] != null ? values[key] : ''}
                onChange={(e) => handleChange(key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                className="nodrag nopan w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder={`{{${key}}}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? '运行中…' : '运行'}
          </button>
        </div>
      </div>
    </>
  )
}
