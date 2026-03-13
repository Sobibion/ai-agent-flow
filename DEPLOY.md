# 项目部署上线指南

本文档说明前端 + 可选代理后端的部署流程与注意事项。

---

## 零、傻瓜式步骤：从本机到域名访问（Vercel）

按下面顺序做，即可用**默认域名**或**自己的域名**访问项目。

### 第 1 步：确保代码在 Git 仓库里

1. 打开终端，进入项目目录：`D:\个人\draggeAi\ai-agent-flow`（或你的实际路径）。
2. 执行：
   ```bash
   git status
   ```
   若提示 `not a git repository`，先初始化并提交：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. 把代码推到 **GitHub** 或 **GitLab**：
   - 在 GitHub 新建一个仓库（如 `ai-agent-flow`），不要勾选「Add a README」。
   - 在本地执行（把 `你的用户名`、`ai-agent-flow` 换成你的）：
   ```bash
   git remote add origin https://github.com/你的用户名/ai-agent-flow.git
   git branch -M main
   git push -u origin main
   ```
   若已有远程仓库，确保 `git push` 成功即可。

---

### 第 2 步：注册 / 登录 Vercel

1. 打开浏览器访问：**https://vercel.com**
2. 点击 **Sign Up**，用 **GitHub**（或 GitLab / Bitbucket）账号登录并授权。
3. 登录后进入 Vercel 控制台（Dashboard）。

---

### 第 3 步：从 Git 导入项目

1. 在 Vercel 首页点击 **Add New…** → **Project**。
2. 在 **Import Git Repository** 里找到你的仓库（如 `你的用户名/ai-agent-flow`），点击 **Import**。
3. 进入 **Configure Project** 页面，按下面配置（一般默认就对）：
   - **Framework Preset**：选 **Vite**（若没有就选 Other）。
   - **Root Directory**：留空（项目在仓库根目录时）。
   - **Build Command**：`npm run build`（或保持默认）。
   - **Output Directory**：`dist`（必须填，Vite 默认输出到 dist）。
   - **Install Command**：`npm install` 或 `npm ci`。
4. **Environment Variables（环境变量）**：
   - 若暂时不用大模型/API，可**不填**，直接部署。
   - 若要配置（可选），点 **Add**，例如：
     - Name：`VITE_OPENAI_BASE_URL`，Value：`https://api.openai.com/v1`（或你的 LLM 地址）。
     - 不要在这里填 API Key，除非你清楚风险（建议用「环境变量」里的 Production 并保管好）。
5. 点击 **Deploy**，等待 1～3 分钟。

---

### 第 4 步：用默认域名访问

1. 部署成功后，页面会显示 **Congratulations** 和一个链接，形如：
   - `https://ai-agent-flow-xxx.vercel.app`
2. 点击该链接即可在浏览器中打开你的项目。
3. 之后每次 `git push` 到该仓库，Vercel 会自动重新部署；在 **Deployments** 里可查看每次部署状态。

---

### 第 5 步：绑定自己的域名（可选）

1. 在 Vercel 打开你的项目，顶部点 **Settings**。
2. 左侧点 **Domains**。
3. 在 **Domain** 输入框里输入你的域名（例如 `workflow.yourdomain.com` 或 `yourdomain.com`），点 **Add**。
4. 按页面提示在**域名服务商**（阿里云 / 腾讯云 / Cloudflare / 等）添加一条 **CNAME** 记录：
   - **主机记录**：`workflow`（子域名）或 `@`（根域名）。
   - **记录类型**：**CNAME**。
   - **记录值**：Vercel 页面上会显示，形如 `cname.vercel-dns.com`（以你当前页面为准）。
5. 保存 DNS 后等待几分钟到几十分钟，Vercel 会显示 **Valid Configuration**；若提示错误，检查记录值是否复制正确、是否生效（可用 `nslookup workflow.yourdomain.com` 查看）。
6. 配置成功后，用 `https://workflow.yourdomain.com` 即可访问（Vercel 自动提供 HTTPS）。

---

### 小结（检查清单）

| 步骤 | 你做了吗 |
|------|----------|
| 代码在 Git 并推到 GitHub/GitLab | ☐ |
| Vercel 从该仓库 Import 项目 | ☐ |
| Build Command = `npm run build`，Output = `dist` | ☐ |
| 部署成功，能用 `xxx.vercel.app` 打开 | ☐ |
| （可选）在 Domains 里绑定了自己的域名并配好 CNAME | ☐ |

完成以上步骤后，即可通过 **Vercel 默认域名** 或 **你绑定的域名** 访问该项目。

**不想用 Git 的替代方式：** 在项目根目录安装 Vercel CLI（`npm i -g vercel`），在终端执行 `vercel`，按提示登录并选择当前目录部署，会得到一个临时域名；在 Vercel 网站该项目的 **Settings → Domains** 里同样可以绑定自己的域名。

---

## 一、部署架构概览

| 部分 | 说明 | 必须 |
|------|------|------|
| **前端（Vite 静态站）** | React 工作流画布，构建产物在 `dist/` | ✅ 必须 |
| **代理后端（server/）** | 提供 `/api/chat`、`/api/proxy`，解决 CORS、保护 API Key | 使用 LLM/HTTP 节点且需跨域时建议 |

- **仅部署前端**：可正常编辑画布、使用模板、持久化到本地；若大模型/HTTP 请求直连会遇 CORS，需用户自填可直连的 Base URL 或在浏览器可访问的环境下使用。
- **前端 + 代理后端**：推荐生产方案；前端请求发到同域或配置的 `VITE_API_BASE`，由后端转发到 LLM/第三方 API。

---

## 二、前端部署（静态站点）

### 2.1 构建

```bash
# 安装依赖
npm ci

# 类型检查 + 构建（产物在 dist/）
npm run build
```

构建前请配置好**构建时**环境变量（见下文）。

### 2.2 部署到 Vercel（当前配置）

项目根目录已有 `vercel.json`，做 SPA 回退（所有路由到 `index.html`）：

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**操作流程：**

1. 将仓库连接 Vercel 项目（Git 集成或 `vercel` CLI）。
2. **Build and Output Settings**：
   - **Build Command**：`npm run build` 或 `tsc -b && vite build`
   - **Output Directory**：`dist`
   - **Install Command**：`npm ci` 或 `npm install`
3. 在 Vercel 项目 **Settings → Environment Variables** 中配置环境变量（见下一节）。
4. 推送代码或手动 Deploy。

**注意：** 若项目不在仓库根目录，在 Vercel 中设置 **Root Directory** 为项目所在目录。

### 2.3 部署到其他静态托管

- 将 `dist/` 目录整体上传到任意静态托管（Nginx、OSS、Netlify、Cloudflare Pages 等）。
- 若部署在**子路径**（如 `https://example.com/app/`），需在 `vite.config.ts` 中设置 `base: '/app/'` 后重新构建。
- 确保所有路由回退到 `index.html`（与当前 `vercel.json` 的 rewrites 效果一致），否则刷新非根路径会 404。

---

## 三、环境变量（重要）

### 3.1 Vite 前端环境变量（构建时注入）

以下变量在 **build 时** 被写入前端产物，**修改后必须重新构建**才会生效。

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_OPENAI_API_KEY` | 默认 API Key（回退用，可选） | `sk-xxx` |
| `VITE_OPENAI_BASE_URL` | 默认 LLM Base URL（回退用） | `https://api.openai.com/v1` |
| `VITE_API_BASE` | **生产环境**代理后端根地址 | `https://your-api.example.com` 或留空（同域时） |

- **开发环境**：在项目根目录 `.env.local` 中配置；不要提交到 Git。
- **生产/Vercel**：在托管平台的环境变量中配置，并为 **Production**（及可选 Preview）勾选生效。

**优先级说明（LLM 节点）：**  
节点表单 API Key/Base URL → 全局变量 `openaiApiKey` → 环境变量 `VITE_OPENAI_API_KEY` / `VITE_OPENAI_BASE_URL`。  
生产若走代理，应配置 `VITE_API_BASE` 指向代理服务地址（无尾部斜杠）。

### 3.2 代理后端环境变量（server/）

仅当部署 `server/` 时需要：

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | 前端未传 Key 时，代理使用的默认 Key |
| `PORT` | 服务端口，默认 3001 |

将 `server/.env.example` 复制为 `server/.env` 并填写，不要提交 `server/.env`。

---

## 四、代理后端部署（可选）

前端请求会优先使用 `VITE_API_BASE`；若生产环境与前端同域，可把代理和前端部署在同一域名下，则 `VITE_API_BASE` 留空即可。

### 4.1 单独部署 Node 服务

```bash
cd server
cp .env.example .env
# 编辑 .env 填写 OPENAI_API_KEY 等
npm ci
npm run start
```

用 PM2、Docker 或云厂商 Node 运行时托管，保证 `/api/chat`、`/api/proxy` 可访问。  
前端构建时设置 `VITE_API_BASE=https://你的代理域名`（无末尾 `/`）。

### 4.2 与前端同站（如 Vercel Serverless）

若希望前后端同域，可将 `server` 转为 Vercel Serverless 或其它平台的函数，将 `/api` 路由到该服务；然后前端**不配** `VITE_API_BASE` 或配为当前站点根地址。具体需按所选平台文档配置 API 路由。

---

## 五、部署前检查清单

- [ ] **依赖**：`npm ci` 或 `npm install` 无报错。
- [ ] **构建**：`npm run build` 成功，无 TypeScript/ESLint 报错。
- [ ] **环境变量**：生产所需 `VITE_*` 已在托管平台或构建环境中配置；修改后已重新构建。
- [ ] **敏感信息**：未将 `.env.local`、`server/.env` 或含 Key 的配置提交到 Git。
- [ ] **路由**：静态托管已配置 SPA 回退（所有路径 → `index.html`）。
- [ ] **子路径**：若站点不在根路径，已设置 Vite `base` 并重新构建。
- [ ] **代理（若用）**：代理服务已部署并可访问；`VITE_API_BASE` 与真实地址一致且无多余尾部斜杠。

---

## 六、常见问题

**Q：上线后点击运行报 CORS 或网络错误？**  
- 若 LLM/HTTP 节点直连第三方 API，浏览器会受 CORS 限制。  
- 解决：部署并配置 `server` 代理，前端设置 `VITE_API_BASE` 指向该代理；或使用支持 CORS 的 API 并在节点内填好 Base URL。

**Q：修改了环境变量但页面没变？**  
- Vite 的 `VITE_*` 在**构建时**注入，改环境变量后必须重新执行 `npm run build` 并重新部署。

**Q：刷新非首页路由出现 404？**  
- 未配置 SPA 回退。静态托管需把任意路径都指向 `index.html`（如 Vercel 的 `vercel.json` rewrites）。

**Q：本地正常，上线后白屏？**  
- 看浏览器控制台是否有资源 404（如 `base` 配错导致 JS/CSS 路径错误）。  
- 若部署在子路径，确认 `vite.config.ts` 中 `base` 与部署路径一致。

---

以上为当前项目的部署流程与注意事项；按需部署前端或「前端 + 代理」即可上线。
