# 代理后端

提供 `/api/chat`（LLM 流式转发）和 `/api/proxy`（HTTP 请求转发），解决前端 CORS 并保护 API Key。

## 使用

1. 复制 `server/.env.example` 为 `server/.env`，填写 `OPENAI_API_KEY`（当前端未传 Key 时使用）。
2. 安装依赖并启动：
   ```bash
   cd server && npm install && npm run dev
   ```
   或项目根目录执行：`npm run dev:server`
3. 前端开发时先启动本服务（默认 3001 端口），再运行 `npm run dev`；Vite 会将 `/api` 代理到本服务。

## 接口

- **POST /api/chat**  
  Body: `{ apiKey?, baseURL?, model, messages, temperature?, stream? }`  
  转发到 OpenAI 兼容接口，流式透传 SSE。`apiKey` 不传时使用服务端 `OPENAI_API_KEY`。

- **POST /api/proxy**  
  Body: `{ method, url, headers?, body? }`  
  由服务端发起 HTTP 请求，返回 `{ status, statusText, contentType, data }`。
