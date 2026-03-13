# AI Agent 工作流

基于 React Flow 的可视化 DAG 工作流编排器：拖拽节点、连线、运行工作流，支持起点/提示词/大模型/条件/HTTP/代码/终点等节点，流式预览与运行日志。

---

## 一键开箱

**环境要求**：Node.js 18+（推荐 20.19+ 或 22+）

```bash
# 1. 克隆
git clone https://github.com/你的用户名/ai-agent-flow.git
cd ai-agent-flow

# 2. 安装依赖
npm install

# 3. 启动前端（浏览器访问 http://localhost:5173）
npm run dev
```

如需使用**大模型节点**调用 OpenAI 兼容 API（并避免浏览器 CORS），可同时启动代理后端：

```bash
# 另开一个终端，启动代理（默认 http://localhost:3001）
npm run dev:server
```

前端开发模式下会将 `/api` 请求代理到该服务，无需额外配置。

---

## 可选配置

在项目根目录新建 `.env.local`（不要提交到 Git），按需填写：

| 变量名 | 说明 |
|--------|------|
| `VITE_OPENAI_API_KEY` | 默认 API Key（节点/全局变量未填时回退） |
| `VITE_OPENAI_BASE_URL` | 默认 LLM 接口地址，如 `https://api.openai.com/v1` |

不配置也可运行：画布、模板、持久化均可用；大模型节点可在界面内填写 API Key 与 Base URL，或通过 Toolbar「环境变量」配置。

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务（默认 5173） |
| `npm run dev:server` | 启动代理后端（默认 3001） |
| `npm run build` | 类型检查 + 生产构建，产物在 `dist/` |
| `npm run preview` | 本地预览构建结果 |
| `npm run lint` | 运行 ESLint |

---

## 文档

- **[FEATURES.md](./FEATURES.md)**：已实现功能清单（节点类型、画布交互、执行引擎、模板与持久化等）
- **[DEPLOY.md](./DEPLOY.md)**：部署上线指南（含 Vercel 傻瓜式步骤与域名绑定）

---

## 技术栈

React 19 + TypeScript + Vite 5 · React Flow · Zustand · Tailwind CSS · Sonner
