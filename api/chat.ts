export const config = {
  runtime: 'edge', // 必须使用 edge runtime 以完美支持流式传输
}

export default async function handler(req: Request) {
  // 处理跨域预检请求 (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body = await req.json()
    const { apiKey, baseURL, model, messages, temperature, stream, response_format } = body

    // 默认回退到 openai 标准接口
    const targetURL = baseURL
      ? `${String(baseURL).replace(/\/$/, '')}/chat/completions`
      : 'https://api.openai.com/v1/chat/completions'

    const upstreamBody: Record<string, unknown> = {
      model,
      messages,
      temperature,
      stream,
    }
    if (response_format != null) {
      upstreamBody.response_format = response_format
    }

    // 向上游大模型发起真实的请求
    const response = await fetch(targetURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    })

    // 将上游的响应（包含流 Stream）原封不动地代理回给前端
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
