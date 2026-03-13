/**
 * OpenAI 兼容 API 的流式 Chat Completions 调用。
 * 请求走后端 /api/chat 代理，由后端转发至大模型并透传 SSE，解决 CORS 并保护 API Key。
 */

export const DEFAULT_BASE_URL = 'https://api.openai.com'

const env = typeof import.meta !== 'undefined' && import.meta.env
  ? (import.meta.env as Record<string, string | undefined>)
  : {}

/**
 * 代理后端根地址。
 * 开发：空字符串时由 Vite 代理 /api；可配置 VITE_API_BASE 指向本地代理。
 * 生产：空字符串时使用相对路径 /api/chat，由 Vercel Edge Function 处理。
 */
function getProxyBase(): string {
  const base = (env.VITE_API_BASE as string) || ''
  return base.replace(/\/$/, '')
}

export interface StreamChatOptions {
  /** 可选，不传则后端使用 OPENAI_API_KEY */
  apiKey?: string
  baseURL?: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  /** 强制 JSON 输出时为 json_object，会带 response_format 并隐式追加 JSON 指令 */
  responseFormat?: 'text' | 'json_object'
  /** 用于中断请求（停止工作流时 abort） */
  signal?: AbortSignal
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>
}

/**
 * 流式调用 Chat Completions（经后端 /api/chat 代理），每次 yield 当前已累积的 assistant 内容。
 * 请求失败时抛出 Error，message 为可展示的错误信息。
 */
const JSON_MODE_SYSTEM_APPEND = 'You must output the result in valid JSON format.'

/** 当 responseFormat 为 json_object 时，在 messages 中注入/追加 JSON 指令（供后端或直连使用） */
export function injectJsonModeMessages(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  responseFormat: 'text' | 'json_object' | undefined
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  if (responseFormat !== 'json_object') return messages
  const firstSystemIndex = messages.findIndex((m) => m.role === 'system')
  if (firstSystemIndex === -1) {
    return [{ role: 'system', content: JSON_MODE_SYSTEM_APPEND }, ...messages]
  }
  const copy = messages.slice()
  const first = copy[firstSystemIndex]
  copy[firstSystemIndex] = {
    ...first,
    content: first.content.trimEnd() ? `${first.content.trimEnd()}\n\n${JSON_MODE_SYSTEM_APPEND}` : JSON_MODE_SYSTEM_APPEND,
  }
  return copy
}

export async function* streamChatCompletions(
  options: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const { model, messages, temperature = 0.7, responseFormat, signal } = options
  const apiKey = options.apiKey != null ? String(options.apiKey).trim() : ''
  const baseURL = (options.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const url = `${getProxyBase()}/api/chat`
  const finalMessages = injectJsonModeMessages(messages, responseFormat)
  const body: Record<string, unknown> = {
    apiKey: apiKey || undefined,
    baseURL,
    model,
    messages: finalMessages,
    temperature,
    stream: true,
  }
  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = `HTTP ${res.status} ${res.statusText}`
    try {
      const json = JSON.parse(text) as { error?: { message?: string } }
      if (json.error && json.error.message) {
        message = json.error.message
      }
    } catch {
      if (text) message = text.slice(0, 200)
    }
    throw new Error(message)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('响应体不可读')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as StreamChunk
            const content = parsed.choices?.[0]?.delta?.content
            if (typeof content === 'string') {
              accumulated += content
              yield accumulated
            }
          } catch {
            // 忽略单条解析失败
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
