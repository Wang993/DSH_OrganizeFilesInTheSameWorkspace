# dsh-workspace-organizer

> DSH（DeepSeek Harness）Web 端**会话整理**插件：标签分类 · 归档 / 恢复 · 已归档浏览。
> Organize your DSH Web sessions: tag-based grouping, archive & restore, and an archived-session browser.

DSH 自带的工作区视图只能按「目录」分组、组内只能排序，会话一多就堆在一起。
本插件为会话区补上一层**自定义分类维度**和**归档管理面板**，并且归档状态与 DSH 原生的
归档体系完全同源——操作后侧边栏会实时联动，没有 hack。

## 功能

- **悬浮按钮**：菱形图标，自动吸附在侧边栏底部「设置」区旁边（侧边栏伸缩 / 窗口变化自动跟随）。
- **整理面板**：
  - 按**标签**分组展示全部会话，未分类会话单列一组；
  - 底部独立「已归档」区，集中查看历史归档；
  - 顶部筛选 chips：`全部` / `未分类` / `已归档` / 各标签。
- **每个会话行**：
  - `标签`：增删标签，每会话最多 8 个，可用按钮一键复用已有标签；
  - `归档`：立即从原生侧边栏列表隐藏（**不删除数据**）；
  - `恢复`：把已归档会话一键放回侧边栏原位置。
- **实时联动**：归档 / 恢复直接走 DSH 内置的 `workspaceRegistry`，原生侧边栏同步更新。
- **主题自适应**：面板与图标使用 DSH 主题变量（`--dsw-*`），明 / 暗主题下都协调。

## 安装

### 方式一：npm（已发布后最省事）

```powershell
dsh plugin --profile web add dsh-workspace-organizer
```

### 方式二：直接从 GitHub 安装（无需等待 npm 发布）

```powershell
dsh plugin --profile web add github:Wang993/DSH_OrganizeFilesInTheSameWorkspace
```

### 方式三：本地 clone + link（开发用）

```powershell
git clone git@github.com:Wang993/DSH_OrganizeFilesInTheSameWorkspace.git
dsh plugin --profile web add link:<克隆下来的目录绝对路径>
```

### 方式四：手动编辑 profile

编辑 `$DSH_HOME/profiles/web/package.json`：

```json
{
  "dsh": { "profile": { "bundles": ["...", "dsh-workspace-organizer"] } },
  "dependencies": { "dsh-workspace-organizer": "link:./dsh-workspace-organizer" }
}
```

把插件目录放到 `$DSH_HOME/profiles/web/dsh-workspace-organizer`，然后在该目录执行 `pnpm install`。

四种方式安装后都需要**重启 `dsh web`** 并刷新页面，即可看到菱形按钮。

## 使用

1. 点击侧边栏设置区右侧的**菱形按钮**打开「会话整理」面板。
2. 点会话行的「标签」给它分类，再点顶部标签 chip 筛选。
3. 点「归档」把不用的会话收起来；在「🗄 已归档」区点「恢复」可随时放回。
4. 面板每 5 秒自动刷新（正在输入标签时不会打断）；也可以点「刷新」手动更新。

数据位置：标签存于 `$DSH_HOME/.dsh-organizer-tags.json`（纯 JSON，可备份、可手工编辑、可纳入版本管理）。

## 实现原理

| 部分 | 说明 |
| --- | --- |
| 宿主插件 `lib/index.js` | 注入 `webServer` / `workspaceRegistry` / `sessionQuery`，注册 `/dsh-organizer/*` 路由，并用 `ctx.webServer.tapIndex()` 向页面注入客户端脚本 |
| 客户端 `lib/organizer.js` | 纯 DOM（无框架、无构建），负责按钮吸附、面板渲染、交互 |
| 会话列表 | `ctx.sessionQuery.listSessions()` 取全部会话，`readTitleSnapshots()` 折叠日志标题 |
| 归档 | `ctx.workspaceRegistry.archiveSession(id)`（官方接口） |
| 恢复 | 读写内置 `archivedSessionIds` 状态集（官方未暴露反归档 RPC） |
| 按钮吸附 | 读取侧边栏设置区元素的屏幕位置，`MutationObserver` + resize + 定时兜底三层跟踪 |

**无构建步骤**：没有打包器、没有依赖，插件就是几个 ESM / 浏览器脚本文件。

## 已知限制

- 需要一个包含 `dsh-base` + `dsh-web-app` 的 Web profile（DSH 默认的 `web` 模板即是）。
- 会话的**工作区归属仍由工作目录决定**（DSH 架构限制），本插件不改变归属，只额外提供标签维度与归档管理。
- 按钮吸附依赖 DSH 侧边栏的哈希类名 `.hHd-Xa_settingsArea`。DSH 升级若改掉该类名，按钮会自动回退到左下角固定位置，功能不受影响。
- 归档沿用 DSH 的全局归档集合：归档只隐藏、不删除，会话日志仍在 `$DSH_HOME/sessions` 下。

## 开发

```powershell
node --check lib/index.js       # 宿主插件语法校验
node --check lib/organizer.js   # 客户端脚本语法校验
```

- 改 `lib/organizer.js`：**刷新页面**即生效（脚本每次请求都从磁盘实时读取，无需重启）。
- 改 `lib/index.js`：需要**重启 `dsh web`**（宿主插件只在启动时加载）。

## 发布（Release）

本仓库自带 `.github/workflows/publish.yml`：**推送 `v*` 标签即自动发布到 npm**。

1. 改 `package.json` 的 `version`（例如 `1.0.1`）；
2. commit 并 push 到 `main`；
3. 打标签并推送（标签必须与版本号一致，workflow 会强校验）：

   ```powershell
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. GitHub Actions 会依次执行：语法闸门 → 标签/版本一致性校验 → 同版本重复发布检测 → `npm publish`。

### 认证：Trusted Publishing (OIDC)，无需任何密钥

本包已在 npm 侧配置 **Trusted Publisher**（包页面 → Settings → Publishing access → Trusted Publisher）：

| 字段 | 值 |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `Wang993` |
| Repository | `DSH_OrganizeFilesInTheSameWorkspace` |
| Workflow filename | `publish.yml` |
| Environment name | （留空） |

workflow 在有 `id-token: write` 且**未设置** `NPM_TOKEN` 时自动走 OIDC，因此 CI 里不需要任何长期密钥。
从公开仓库经 OIDC 发布时，npm 还会**自动生成 provenance 证明**（无需 `--provenance` 参数）。

### ⚠️ 已知坑：bypass-2FA token 不能直接发布

npm 自 [2026-07-31](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/) 起收紧了两类凭据，配置时务必避开：

- **勾选了 “Bypass 2FA” 的 Granular Access Token**：只能发到**暂存区**（staging），直接 `npm publish` 会报
  `E403 ... E_STAGE_REQUIRED`；CI 里用它会失败。
- 对新包而言，暂存流程还要求包已存在，所以**新包的首次发布必须用「可直达」的方式 bootstrap 一次**：
  本地 `npm login --registry https://registry.npmjs.org` 后发布，或走 `npm stage publish` + `npm stage approve`
  （后者需要维护者用 2FA 审批）。
- 首次发布成功后，后续版本**全部交给 OIDC** 即可；仓库里不要再配 `NPM_TOKEN`，
  否则 workflow 会退回 token 路径从而继续撞上 `E_STAGE_REQUIRED`。

据此，本仓库的推荐配置是：**只保留 Trusted Publisher + 在包设置里勾选
“Require two-factor authentication and disallow tokens”**，不需要任何 token secret。


## 卸载

1. 从 `profiles/web/package.json` 的 `dsh.profile.bundles` 与 `dependencies` 移除本包；
2. 在该目录执行 `pnpm install`；
3. 重启 `dsh web`；
4. （可选）删除 `$DSH_HOME/.dsh-organizer-tags.json`。

## License

MIT
