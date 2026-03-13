import { useState, useCallback } from 'react'
import { ClipboardList, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import type { RunLogEntry, RunLogNodeDetail } from '../types/workflow'

function tryStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function StatusBadge({ status }: { status: RunLogEntry['status'] }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        成功
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <AlertCircle className="h-3.5 w-3.5" />
      失败
    </span>
  )
}

function NodeDetailRow({ detail }: { detail: RunLogNodeDetail }) {
  const [open, setOpen] = useState(false)
  const statusColor =
    detail.status === 'success'
      ? 'text-emerald-600'
      : detail.status === 'error'
        ? 'text-red-600'
        : detail.status === 'skipped'
          ? 'text-slate-400'
          : 'text-slate-600'
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 truncate font-mono text-slate-700">{detail.nodeId}</span>
        <span className={`shrink-0 text-xs font-medium ${statusColor}`}>
          {detail.status}
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-slate-50/80 px-4 pb-3 pt-1 text-xs">
          {detail.nodeType != null && (
            <div>
              <span className="font-medium text-slate-500">类型</span>
              <p className="mt-0.5 font-mono text-slate-700">{detail.nodeType}</p>
            </div>
          )}
          {detail.input !== undefined && (
            <div>
              <span className="font-medium text-slate-500">输入</span>
              <pre className="mt-0.5 max-h-32 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-slate-800">
                {tryStringify(detail.input)}
              </pre>
            </div>
          )}
          {detail.output !== undefined && (
            <div>
              <span className="font-medium text-slate-500">输出</span>
              <pre className="mt-0.5 max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-slate-800">
                {tryStringify(detail.output)}
              </pre>
            </div>
          )}
          {detail.error != null && (
            <div>
              <span className="font-medium text-red-600">错误</span>
              <p className="mt-0.5 text-red-700">{detail.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function RunLogPanel() {
  const runLogs = useWorkflowStore((s) => s.runLogs)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const selected = selectedRunId ? runLogs.find((r) => r.runId === selectedRunId) : null

  const handleSelect = useCallback((runId: string) => {
    setSelectedRunId((id) => (id === runId ? null : runId))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ClipboardList className="h-4 w-4 text-slate-500" />
          运行日志
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {runLogs.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">暂无运行记录，点击工具栏「运行」后此处会显示历史。</p>
        ) : (
          <div className="flex flex-col">
            <ul className="space-y-1 p-2">
              {runLogs.map((entry) => (
                <li key={entry.runId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(entry.runId)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedRunId === entry.runId
                        ? 'border-violet-300 bg-violet-50/80'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <StatusBadge status={entry.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">
                      {entry.runId.slice(0, 8)}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatTime(entry.startTime)} · {formatDuration(entry.endTime - entry.startTime)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="border-t border-slate-200 bg-white px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {formatTime(selected.startTime)} — {formatTime(selected.endTime)}
                    {' · '}
                    {formatDuration(selected.endTime - selected.startTime)}
                  </span>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.errorMessage != null && selected.errorMessage !== '' && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50/80 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      错误信息
                    </p>
                    <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-red-800">
                      {selected.errorMessage}
                    </pre>
                  </div>
                )}
                <p className="mb-2 text-xs font-medium text-slate-500">节点详情</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50">
                  {selected.nodeDetails.map((d) => (
                    <NodeDetailRow key={d.nodeId} detail={d} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
