import { useState, useCallback, useEffect, useRef } from 'react'
import { Wrench, Undo2, Redo2, LayoutGrid, Download, Upload, Play, Square, Trash2, Variable, LayoutTemplate, Save, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { getLayoutedNodes } from '../utils/layout'
import { runWorkflowEngine, WorkflowExecutionError } from '../utils/executor'
import type { WorkflowNode } from '../types/workflow'
import type { Edge } from 'reactflow'
import type { RunLogNodeDetail } from '../types/workflow'
import type { WorkflowTemplate } from '../config/templates'
import { GlobalVariablesDialog } from './GlobalVariablesDialog'
import { TemplateGalleryDialog } from './TemplateGalleryDialog'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { RunWorkflowDialog } from './RunWorkflowDialog'

const EXPORT_FILENAME = 'workflow-config.json'

export function Toolbar() {
  const [globalVarsDialogOpen, setGlobalVarsDialogOpen] = useState(false)
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [runWorkflowDialogOpen, setRunWorkflowDialogOpen] = useState(false)
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const setNodes = useWorkflowStore((s) => s.setNodes)
  const setEdges = useWorkflowStore((s) => s.setEdges)
  const updateNodeStatus = useWorkflowStore((s) => s.updateNodeStatus)
  const updateEdgeAnimation = useWorkflowStore((s) => s.updateEdgeAnimation)
  const setStreamingPayload = useWorkflowStore((s) => s.setStreamingPayload)
  const resetExecutionStatus = useWorkflowStore((s) => s.resetExecutionStatus)
  const pushHistory = useWorkflowStore((s) => s.pushHistory)
  const clearCanvas = useWorkflowStore((s) => s.clearCanvas)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const past = useWorkflowStore((s) => s.past)
  const future = useWorkflowStore((s) => s.future)
  const pushRunLog = useWorkflowStore((s) => s.pushRunLog)
  const isExecuting = useWorkflowStore((s) => s.isExecuting)
  const setExecuting = useWorkflowStore((s) => s.setExecuting)
  const setExecutionAbortController = useWorkflowStore((s) => s.setExecutionAbortController)
  const cancelExecution = useWorkflowStore((s) => s.cancelExecution)

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const handleOpenRunDialog = useCallback(() => {
    if (isExecuting || nodes.length === 0) return
    setRunWorkflowDialogOpen(true)
  }, [isExecuting, nodes.length])

  const handleStartExecutionWithParams = useCallback(
    async (startParamsOverrides: Record<string, string>) => {
      setRunWorkflowDialogOpen(false)
      if (isExecuting) return
      const controller = new AbortController()
      setExecutionAbortController(controller)
      setExecuting(true)
      resetExecutionStatus()
      const runId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const startTime = Date.now()
      try {
        const logEntry = await runWorkflowEngine(
          nodes,
          edges,
          { updateNodeStatus, updateEdgeAnimation, setStreamingPayload },
          { runId, startTime, globalVariables, signal: controller.signal, startParamsOverrides }
        )
        if (logEntry) pushRunLog(logEntry)
      } catch (err) {
        const message = err instanceof WorkflowExecutionError ? err.message : (err instanceof Error ? err.message : '工作流执行失败')
        toast.error(message)
        const nodeDetails: RunLogNodeDetail[] = nodes.map((n) => ({
          nodeId: n.id,
          nodeType: n.type as string | undefined,
          status: (n.data?.status as RunLogNodeDetail['status']) || 'idle',
          output: n.data?.runResult,
        }))
        pushRunLog({
          runId,
          startTime,
          endTime: Date.now(),
          status: 'fail',
          nodeDetails,
          errorMessage: err instanceof Error ? (err.stack || err.message) : String(err),
        })
      } finally {
        setExecuting(false)
        setExecutionAbortController(null)
      }
    },
    [
      nodes,
      edges,
      globalVariables,
      updateNodeStatus,
      updateEdgeAnimation,
      setStreamingPayload,
      resetExecutionStatus,
      pushRunLog,
      isExecuting,
      setExecuting,
      setExecutionAbortController,
    ]
  )

  const handleStopWorkflow = useCallback(() => {
    cancelExecution()
  }, [cancelExecution])

  const handleLayout = useCallback(() => {
    if (nodes.length === 0) return
    pushHistory()
    const layouted = getLayoutedNodes(nodes, edges, 'TB')
    setNodes(layouted)
    toast.success('一键整理完成')
  }, [nodes, edges, pushHistory, setNodes])

  const handleClearCanvas = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0) return
    if (!window.confirm('确认清空画布吗？当前操作可撤销。')) return
    clearCanvas()
    toast.success('画布已清空')
  }, [nodes.length, edges.length, clearCanvas])

  const handleExport = useCallback(() => {
    const payload = { nodes, edges, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = EXPORT_FILENAME
    a.click()
    URL.revokeObjectURL(url)
    toast.success('配置已导出')
  }, [nodes, edges])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string
          const data = JSON.parse(text) as { nodes?: WorkflowNode[]; edges?: Edge[] }
          const nextNodes = Array.isArray(data.nodes) ? data.nodes : []
          const nextEdges = Array.isArray(data.edges) ? data.edges : []
          pushHistory()
          setNodes(nextNodes)
          setEdges(nextEdges)
          toast.success('配置已导入')
        } catch {
          toast.error('无法解析配置文件，请选择有效的 JSON 文件')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [pushHistory, setNodes, setEdges])

  const handleLoadTemplate = useCallback(
    (template: WorkflowTemplate) => {
      if (!window.confirm('加载模板将覆盖当前画布，是否继续？（当前操作可撤销）')) return
      pushHistory()
      const layoutedNodes = getLayoutedNodes(
        template.nodes as WorkflowNode[],
        template.edges,
        'TB'
      )
      setNodes(layoutedNodes)
      setEdges(template.edges)
      toast.success('模板加载成功！')
      setIsTemplateGalleryOpen(false)
    },
    [pushHistory, setNodes, setEdges]
  )

  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreMenuOpen])

  return (
    <>
      <GlobalVariablesDialog open={globalVarsDialogOpen} onClose={() => setGlobalVarsDialogOpen(false)} />
      <TemplateGalleryDialog
        isOpen={isTemplateGalleryOpen}
        onClose={() => setIsTemplateGalleryOpen(false)}
        onSelectTemplate={handleLoadTemplate}
      />
      <SaveTemplateDialog open={isSaveTemplateOpen} onClose={() => setIsSaveTemplateOpen(false)} />
      <RunWorkflowDialog
        open={runWorkflowDialogOpen}
        onClose={() => setRunWorkflowDialogOpen(false)}
        nodes={nodes}
        onStartExecution={handleStartExecutionWithParams}
      />
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm">
        <h1 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Wrench className="h-4 w-4 text-slate-500" />
          <span className="hidden sm:inline">AI Agent 工作流</span>
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setGlobalVarsDialogOpen(true)}
            title="环境变量（全局 {{变量}} 回退）"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:gap-2 sm:px-2.5 sm:text-sm"
          >
            <Variable className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">环境变量</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTemplateGalleryOpen(true)}
            title="经典工作流模板"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:gap-2 sm:px-2.5 sm:text-sm"
          >
            <LayoutTemplate className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">模板库</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSaveTemplateOpen(true)}
            title="将当前画布保存为自定义模板"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:gap-2 sm:px-2.5 sm:text-sm"
          >
            <Save className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">保存为模板</span>
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          {isExecuting ? (
            <button
              type="button"
              onClick={handleStopWorkflow}
              title="停止工作流"
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenRunDialog}
              disabled={nodes.length === 0}
              title="运行工作流 (DAG 顺序)"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              运行
            </button>
          )}
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen((o) => !o)}
              title="更多操作"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-expanded={moreMenuOpen}
              aria-haspopup="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    handleLayout()
                    setMoreMenuOpen(false)
                  }}
                  disabled={nodes.length === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  一键整理
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClearCanvas()
                    setMoreMenuOpen(false)
                  }}
                  disabled={nodes.length === 0 && edges.length === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  一键清空
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    handleExport()
                    setMoreMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  导出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleImport()
                    setMoreMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  导入
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
