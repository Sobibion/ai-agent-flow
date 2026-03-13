import { useState, useCallback, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useWorkflowStore } from '../store/useWorkflowStore'

interface GlobalVariablesDialogProps {
  open: boolean
  onClose: () => void
}

export function GlobalVariablesDialog({ open, onClose }: GlobalVariablesDialogProps) {
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const setGlobalVariables = useWorkflowStore((s) => s.setGlobalVariables)

  const [entries, setEntries] = useState<{ key: string; value: string }[]>([])

  useEffect(() => {
    if (open) {
      const list = Object.entries(globalVariables).map(([key, value]) => ({ key, value }))
      setEntries(list.length > 0 ? list : [{ key: '', value: '' }])
    }
  }, [open, globalVariables])

  const handleAdd = useCallback(() => {
    setEntries((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const handleRemove = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleChange = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setEntries((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    const next: Record<string, string> = {}
    for (const { key, value } of entries) {
      const k = key.trim()
      if (k !== '') next[k] = value
    }
    setGlobalVariables(next)
    onClose()
  }, [entries, setGlobalVariables, onClose])

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
      aria-labelledby="global-vars-dialog-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="global-vars-dialog-title" className="text-sm font-semibold text-slate-800">
            环境变量
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
        <p className="shrink-0 px-4 pt-2 text-xs text-slate-500">
          在工作流中可通过 {'{{变量名}}'} 引用；节点未提供时从此处回退读取，本地持久化。
        </p>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 pr-2 text-left font-medium text-slate-600">Key</th>
                <th className="pb-2 pr-2 text-left font-medium text-slate-600">Value</th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => handleChange(index, 'key', e.target.value)}
                      placeholder="例如 baseURL"
                      className="w-full rounded border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => handleChange(index, 'value', e.target.value)}
                      placeholder="值"
                      className="w-full rounded border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-violet-400 hover:bg-violet-50/50 hover:text-violet-700"
          >
            <Plus className="h-4 w-4" />
            添加一行
          </button>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
