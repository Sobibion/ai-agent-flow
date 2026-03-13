import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { WorkflowNode } from '../types/workflow'

const NODE_TYPE_LABELS: Record<string, string> = {
  startNode: '起点节点',
  promptNode: '提示词节点',
  llmNode: '大模型节点',
  httpNode: 'HTTP 请求',
  conditionNode: '条件判断',
  codeNode: '代码节点',
  endNode: '终点节点',
}

function getNodeDisplayName(node: WorkflowNode): string {
  const type = (node.type as string) || ''
  const label = NODE_TYPE_LABELS[type] || type || '节点'
  const shortId = node.id ? node.id.slice(-6) : ''
  return shortId ? `${label}-${shortId}` : label
}

/** 根据节点类型与 data 返回该节点输出字段（path + 展示 label） */
function getNodeOutputFields(node: WorkflowNode): Array<{ path: string; label: string }> {
  const type = (node.type as string) || ''
  const data = node.data as Record<string, unknown> | undefined
  if (type === 'startNode') {
    const params = data && data.params && typeof data.params === 'object' && !Array.isArray(data.params)
      ? (data.params as Record<string, string>)
      : {}
    return Object.keys(params).filter(Boolean).map((k) => ({ path: k, label: k }))
  }
  if (type === 'promptNode') return [{ path: 'prompt', label: 'prompt' }]
  if (type === 'llmNode') return [{ path: 'response', label: 'response' }]
  if (type === 'httpNode') return [{ path: 'response', label: 'response' }, { path: 'status', label: 'status' }]
  if (type === 'conditionNode') return [{ path: 'branch', label: 'branch' }]
  if (type === 'codeNode') return [{ path: 'result', label: 'result' }]
  if (type === 'endNode') return [{ path: 'output', label: 'output' }]
  return []
}

export interface VariableOption {
  type: 'global' | 'node'
  insertText: string
  label: string
  groupLabel: string
}

function buildVariableOptions(
  upstreamNodes: WorkflowNode[],
  globalVarKeys: string[]
): VariableOption[] {
  const options: VariableOption[] = []
  if (globalVarKeys.length > 0) {
    globalVarKeys.forEach((key) => {
      options.push({
        type: 'global',
        insertText: `{{${key}}}`,
        label: key,
        groupLabel: '全局变量',
      })
    })
  }
  upstreamNodes.forEach((node) => {
    const groupLabel = getNodeDisplayName(node)
    const fields = getNodeOutputFields(node)
    fields.forEach(({ path, label }) => {
      options.push({
        type: 'node',
        insertText: `{{${node.id}.${path}}}`,
        label,
        groupLabel,
      })
    })
  })
  return options
}

export interface VariableTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 当前节点 id，用于计算上游并展示变量列表 */
  nodeId: string
  rows?: number
  className?: string
  /** 为 true 时渲染为 input，否则为 textarea */
  singleLine?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function VariableTextarea({
  value,
  onChange,
  placeholder,
  nodeId,
  rows = 3,
  className = '',
  singleLine = false,
  onKeyDown: onKeyDownProp,
}: VariableTextareaProps) {
  const getUpstreamNodes = useWorkflowStore((s) => s.getUpstreamNodes)
  const globalVariables = useWorkflowStore((s) => s.globalVariables)
  const [showPopover, setShowPopover] = useState(false)
  const [triggerStart, setTriggerStart] = useState(0)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  const upstreamNodes = useMemo(() => getUpstreamNodes(nodeId), [getUpstreamNodes, nodeId])
  const globalVarKeys = useMemo(
    () => (globalVariables && typeof globalVariables === 'object' ? Object.keys(globalVariables).filter(Boolean) : []),
    [globalVariables]
  )
  const options = useMemo(
    () => buildVariableOptions(upstreamNodes, globalVarKeys),
    [upstreamNodes, globalVarKeys]
  )

  const openPopoverAt = useCallback((startIndex: number) => {
    setTriggerStart(startIndex)
    setHighlightIndex(0)
    setShowPopover(true)
  }, [])

  const closePopover = useCallback(() => {
    setShowPopover(false)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement & HTMLInputElement>) => {
      const v = e.target.value
      const selStart = e.target.selectionStart != null ? e.target.selectionStart : 0
      onChange(v)
      if (v.slice(Math.max(0, selStart - 2), selStart) === '{{') {
        openPopoverAt(selStart - 2)
      } else {
        closePopover()
      }
    },
    [onChange, openPopoverAt, closePopover]
  )

  const handleSelectOption = useCallback(
    (opt: VariableOption) => {
      const before = value.slice(0, triggerStart)
      const after = value.slice(triggerStart + 2)
      onChange(before + opt.insertText + after)
      closePopover()
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          const newPos = triggerStart + opt.insertText.length
          el.focus()
          el.setSelectionRange(newPos, newPos)
        }
      })
    },
    [value, triggerStart, onChange, closePopover]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showPopover && options.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setHighlightIndex((i) => (i + 1) % options.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setHighlightIndex((i) => (i - 1 + options.length) % options.length)
          return
        }
        if (e.key === 'Enter' && options[highlightIndex]) {
          e.preventDefault()
          handleSelectOption(options[highlightIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closePopover()
          return
        }
      }
      onKeyDownProp?.(e)
    },
    [showPopover, options, highlightIndex, handleSelectOption, closePopover, onKeyDownProp]
  )

  useEffect(() => {
    if (!showPopover) return
    const onDocClick = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        closePopover()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showPopover, closePopover])

  const popoverContent = showPopover && options.length > 0 && (
    <div
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      role="listbox"
    >
      {options.map((opt, i) => (
        <button
          key={`${opt.groupLabel}-${opt.label}-${opt.insertText}`}
          type="button"
          role="option"
          aria-selected={i === highlightIndex}
          className={`flex w-full flex-col items-start gap-0 px-3 py-2 text-left text-sm transition-colors ${
            i === highlightIndex ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
          }`}
          onMouseDown={(e) => {
            e.preventDefault()
            handleSelectOption(opt)
          }}
        >
          <span className="text-xs text-slate-500">{opt.groupLabel}</span>
          <span className="font-medium">{opt.insertText}</span>
        </button>
      ))}
    </div>
  )

  const baseClass =
    'nodrag nopan nowheel w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all'
  const resolvedClass = className ? `${baseClass} ${className}` : baseClass

  return (
    <div ref={containerRef} className="relative">
      {singleLine ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={resolvedClass}
        />
      ) : (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={`resize-y ${resolvedClass}`}
        />
      )}
      {popoverContent}
    </div>
  )
}
