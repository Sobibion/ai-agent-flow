import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageSquare, ChevronRight, ChevronLeft, Sparkles, Copy, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkflowStore } from '../store/useWorkflowStore'

const DISPLAY_DEBOUNCE_MS = 80

interface PreviewPanelProps {
  /** 嵌入到右侧 Tab 时使用，不渲染外层 aside 与收起按钮 */
  embedded?: boolean
}

export function PreviewPanel({ embedded = false }: PreviewPanelProps) {
  const streamingPayload = useWorkflowStore((s) => s.streamingPayload)
  const setStreamingPayload = useWorkflowStore((s) => s.setStreamingPayload)
  const isExecuting = useWorkflowStore((s) => s.isExecuting)
  const [collapsed, setCollapsed] = useState(false)
  const [displayedContent, setDisplayedContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const latestContentRef = useRef('')
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flushToDisplay = useCallback(() => {
    setDisplayedContent(latestContentRef.current)
  }, [])

  // 仅用 streamingPayload + 80ms 防抖驱动展示：来自 executor 或演示按钮的 setStreamingPayload 都会走这里
  useEffect(() => {
    if (streamingPayload === null) {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current)
        flushIntervalRef.current = null
      }
      flushToDisplay()
      setIsStreaming(false)
      return
    }
    latestContentRef.current = streamingPayload
    setIsStreaming(true)
    if (!flushIntervalRef.current) {
      flushIntervalRef.current = setInterval(flushToDisplay, DISPLAY_DEBOUNCE_MS)
    }
  }, [streamingPayload, flushToDisplay])

  useEffect(() => {
    return () => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current)
    }
  }, [])

  const textToCopy = streamingPayload != null ? streamingPayload : displayedContent
  const hasContent = textToCopy.trim().length > 0
  const isLoading = isStreaming || isExecuting

  const handleCopy = useCallback(() => {
    if (!hasContent) return
    navigator.clipboard.writeText(textToCopy).then(
      () => toast.success('已复制到剪贴板'),
      () => toast.error('复制失败')
    )
  }, [textToCopy, hasContent])

  const handleClear = useCallback(() => {
    setStreamingPayload(null)
    setDisplayedContent('')
    latestContentRef.current = ''
  }, [setStreamingPayload])

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            AI 预览
            {isLoading && <Loader2 className="h-3 w-3 text-indigo-500 animate-spin" aria-hidden />}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasContent}
              title="复制到剪贴板"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="复制到剪贴板"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="清空预览"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              aria-label="清空预览"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="收起预览面板"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            AI 预览
            {isLoading && <Loader2 className="h-3 w-3 text-indigo-500 animate-spin" aria-hidden />}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasContent}
              title="复制到剪贴板"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="复制到剪贴板"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="清空预览"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              aria-label="清空预览"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {displayedContent || isStreaming ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-4 mx-4">
            <div className="prose prose-slate max-w-none prose-p:my-2 prose-headings:my-3 prose-pre:my-2 prose-table:my-2 text-sm text-slate-700 leading-relaxed prose-p:text-slate-700 prose-headings:text-slate-800 prose-li:text-slate-700 prose-code:text-slate-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayedContent}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-1 animate-pulse align-middle" aria-hidden />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[200px] px-6 text-center">
            <Sparkles className="h-10 w-10 text-slate-300 mb-3" aria-hidden />
            <p className="text-slate-400 text-sm">从顶部工具栏运行工作流，见证 AI 的魔法</p>
          </div>
        )}
      </div>
    </>
  )

  if (!embedded && collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex h-full w-10 shrink-0 flex-col items-center justify-center border-l border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="展开预览面板"
      >
        <MessageSquare className="h-5 w-5" />
        <ChevronLeft className="mt-1 h-4 w-4" />
      </button>
    )
  }

  if (!embedded) {
    return (
      <aside
        className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white"
        style={{ width: '380px' }}
      >
        {content}
      </aside>
    )
  }

  return <div className="flex h-full flex-col overflow-hidden">{content}</div>
}
