/**
 * 轻量代理后端：/api/chat 转发 LLM 流式请求，/api/proxy 转发 HTTP 请求，解决 CORS 并保护 API Key。
 * 开发时由 Vite 将 /api 代理到本服务；生产可同机部署或配置 CORS。
 */
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

/** 从环境变量读取默认 LLM API Key（前端不传时使用） */
function getDefaultApiKey() {
  return process.env.OPENAI_API_KEY || ''
}

/**
 * POST /api/chat
 * Body: { apiKey?, baseURL?, model, messages, temperature?, stream? }
 * 转发到 OpenAI 兼容接口，流式透传 SSE。
 */
app.post('/api/chat', async (req, res) => {
  const { apiKey, baseURL, model, messages, temperature = 0.7, stream = true, response_format } = req.body || {}
  const key = (apiKey && String(apiKey).trim()) || getDefaultApiKey()
  if (!key) {
    res.status(400).json({ error: { message: '缺少 API Key（请在节点填写或配置服务端 OPENAI_API_KEY）' } })
    return
  }
  const base = (baseURL && String(baseURL).trim())
    ? String(baseURL).replace(/\/$/, '')
    : 'https://api.openai.com'
  const url = `${base}/chat/completions`

  const payload = {
    model: model || 'gpt-3.5-turbo',
    messages: Array.isArray(messages) ? messages : [],
    temperature: Number(temperature),
    stream: Boolean(stream),
  }
  if (response_format && typeof response_format === 'object' && response_format.type === 'json_object') {
    payload.response_format = { type: 'json_object' }
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      let msg = `HTTP ${upstream.status} ${upstream.statusText}`
      try {
        const j = JSON.parse(text)
        if (j.error && j.error.message) msg = j.error.message
      } catch {
        if (text) msg = text.slice(0, 300)
      }
      res.status(upstream.status).json({ error: { message: msg } })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const reader = upstream.body?.getReader()
    if (!reader) {
      res.status(502).json({ error: { message: '上游响应体不可读' } })
      return
    }
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) {
          res.write(line + '\n')
          if (typeof res.flush === 'function') res.flush()
        }
      }
    }
    if (buffer.trim()) {
      res.write(buffer + '\n')
      if (typeof res.flush === 'function') res.flush()
    }
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: { message } })
  }
})

/**
 * POST /api/proxy
 * Body: { method, url, headers?, body? }
 * 由服务端发起 HTTP 请求，绕过浏览器 CORS，返回 { status, statusText, data, contentType }。
 */
app.post('/api/proxy', async (req, res) => {
  const { method = 'GET', url, headers = {}, body } = req.body || {}
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: '缺少 url' })
    return
  }
  const allowedMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(String(method).toUpperCase())
    ? String(method).toUpperCase()
    : 'GET'
  const headersObj = typeof headers === 'object' && headers !== null ? headers : {}

  try {
    const upstream = await fetch(url, {
      method: allowedMethod,
      headers: headersObj,
      body: body != null && allowedMethod !== 'GET' ? String(body) : undefined,
    })

    const contentType = upstream.headers.get('content-type') || ''
    let data
    if (contentType.indexOf('application/json') !== -1) {
      try {
        data = await upstream.json()
      } catch {
        data = await upstream.text()
      }
    } else {
      data = await upstream.text()
    }

    res.status(200).json({
      status: upstream.status,
      statusText: upstream.statusText,
      contentType,
      data,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message, status: 0 })
  }
})

app.listen(PORT, () => {
  console.log(`[server] Proxy API running at http://localhost:${PORT}`)
})
