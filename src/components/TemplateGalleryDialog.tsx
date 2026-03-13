import { useState, useCallback } from 'react'
import { X, FolderHeart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { WORKFLOW_TEMPLATES } from '../config/templates'
import type { WorkflowTemplate } from '../config/templates'
import type { StoredWorkflowTemplate } from '../store/useWorkflowStore'
import { useWorkflowStore } from '../store/useWorkflowStore'

type TabId = 'builtin' | 'custom'

interface TemplateGalleryDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: WorkflowTemplate) => void
}

function toWorkflowTemplate(stored: StoredWorkflowTemplate): WorkflowTemplate {
  return {
    ...stored,
    icon: stored.icon != null ? stored.icon : FolderHeart,
  }
}

export function TemplateGalleryDialog({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplateGalleryDialogProps) {
  const customTemplates = useWorkflowStore((s) => s.customTemplates)
  const removeCustomTemplate = useWorkflowStore((s) => s.removeCustomTemplate)
  const [activeTab, setActiveTab] = useState<TabId>('builtin')

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const handleRemoveCustom = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      removeCustomTemplate(id)
      toast.success('模板已删除')
    },
    [removeCustomTemplate]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-gallery-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
        onClick={handleBackdropClick}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="template-gallery-title" className="text-lg font-semibold text-slate-800">
              工作流模板库
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              一键应用内置模板或使用你保存的自定义模板
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="shrink-0 px-6">
          <div className="flex gap-4 border-b border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('builtin')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'builtin'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              内置经典
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'custom'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              我的模板
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6 pt-0">
          {activeTab === 'builtin' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WORKFLOW_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onSelectTemplate(template)}
                    className="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-200 group-hover:text-violet-700 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-medium text-slate-800">{template.name}</h3>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                      {template.description}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
          {activeTab === 'custom' && (
            <>
              {customTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-slate-400 text-sm">暂无自定义模板，快去画布中保存一个吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customTemplates.map((stored) => {
                    const template = toWorkflowTemplate(stored)
                    const Icon = template.icon
                    return (
                      <div
                        key={template.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectTemplate(template)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelectTemplate(template)
                          }
                        }}
                        className="group relative flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        <button
                          type="button"
                          onClick={(e) => handleRemoveCustom(e, template.id)}
                          className="absolute top-2 right-2 rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all z-10"
                          aria-label="删除模板"
                          title="删除模板"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-3 font-medium text-slate-800">{template.name}</h3>
                        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                          {template.description || '无描述'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
