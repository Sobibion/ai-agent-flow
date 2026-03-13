import { useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { WorkflowTemplate } from '../config/templates'
import { FolderHeart } from 'lucide-react'
import type { Node } from 'reactflow'
import type { Edge } from 'reactflow'

interface SaveTemplateDialogProps {
  open: boolean
  onClose: () => void
}

function cleanNodesForTemplate(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: n.data
      ? { ...n.data, status: undefined, runResult: undefined, runState: undefined }
      : n.data,
  }))
}

function cleanEdgesForTemplate(edges: Edge[]): Edge[] {
  return edges.map((e) => ({ ...e, animated: false }))
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function SaveTemplateDialog({ open, onClose }: SaveTemplateDialogProps) {
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const addCustomTemplate = useWorkflowStore((s) => s.addCustomTemplate)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
    }
  }, [open])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const handleSave = useCallback(() => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      toast.error('请输入模板名称')
      return
    }
    const template: WorkflowTemplate = {
      id: nextId(),
      name: trimmedName,
      description: description.trim(),
      icon: FolderHeart,
      nodes: cleanNodesForTemplate(nodes.map((n) => ({ ...n }))),
      edges: cleanEdgesForTemplate(edges.map((e) => ({ ...e }))),
    }
    addCustomTemplate(template)
    toast.success('模板保存成功！')
    onClose()
  }, [name, description, nodes, edges, addCustomTemplate, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-template-dialog-title"
    >
      <div
        className="flex w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="save-template-dialog-title" className="text-sm font-semibold text-slate-800">
            保存为模板
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <div>
            <label htmlFor="save-template-name" className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="save-template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的小红书文案流"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="save-template-desc" className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              模板描述（可选）
            </label>
            <input
              id="save-template-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述该工作流的用途"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
