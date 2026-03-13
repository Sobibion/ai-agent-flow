import { useCallback } from 'react'
import { X } from 'lucide-react'
import { useWorkflowStore } from '../store/useWorkflowStore'

function tryStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function DebugDrawer() {
  const selectedNodeForDebug = useWorkflowStore((s) => s.selectedNodeForDebug)
  const setSelectedNodeForDebug = useWorkflowStore((s) => s.setSelectedNodeForDebug)
  const nodes = useWorkflowStore((s) => s.nodes)

  const node = selectedNodeForDebug
    ? nodes.find((n) => n.id === selectedNodeForDebug)
    : null
  const runResult = node?.data?.runResult

  const handleClose = useCallback(() => {
    setSelectedNodeForDebug(null)
  }, [setSelectedNodeForDebug])

  if (selectedNodeForDebug === null) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        aria-hidden
        onClick={handleClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[420px]"
        role="dialog"
        aria-label="节点执行结果"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            执行结果 · {node?.id ?? selectedNodeForDebug}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {runResult === undefined ? (
            <p className="text-sm text-slate-500">该节点暂无执行结果数据。</p>
          ) : (
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-left text-sm leading-relaxed text-emerald-300">
              <code>{tryStringify(runResult)}</code>
            </pre>
          )}
        </div>
      </aside>
    </>
  )
}
