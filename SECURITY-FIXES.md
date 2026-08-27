# DeterminFlow 安全与可靠性修复记录

修复日期：2026-08-27
分支：`security-hardening`（基于 v1.0.10, commit `e92bf76`）
范围：本地部署的默认配置加固 + 源码修复

---

## 一、已修复的安全问题

### 1. 未鉴权读取工作区外任意文件（Critical，已实证）

**问题**：`GET /api/workspace/{session_id}/file` 用 `工作区 / 用户传入路径` 拼接。
路径沙箱默认关闭时，校验函数第一行直接放行，`../` 可逐级逃逸出工作区。
会话 ID 可从无鉴权的 `/api/sessions` 直接列举。

**修复**：
- `src/core/workspace_guard.py` — `validate_path()` / `get_effective_path()` 新增
  `enforce_workspace` 参数，调用方可要求边界校验，不受全局沙箱开关影响。
- `src/web/api_routes.py:1585,1593` — HTTP 读文件接口改用 `enforce_workspace=True`。

**验证**：修复前 `?path=../../../config/settings.json` 返回 HTTP 200 并泄漏文件内容；
修复后返回 HTTP 403「路径穿越检测失败」。

### 2. 未鉴权修改运行时安全开关（Critical，已实证）

**问题**：`PUT /api/config` 无任何鉴权，而 `CODING_CMD_MODE`、`CODING_CMD_WHITELIST`、
`CODING_PATH_SANDBOX_ENABLED` 等提权类配置都在可写白名单内。攻击者可把命令模式改成
`allow_all` 使命令执行不再需要审批，再驱动 Agent 执行任意命令。

**修复**：`src/web/api_routes.py` 新增 `_require_local_access_for_privileged_config()`，
对 6 个提权类配置键要求本机回环访问或 Bearer 管理令牌（复用项目在插件管理接口上
已有的鉴权模式）。普通配置项不受影响，不破坏正常使用。

**验证**：远程 IP 改提权配置返回 403；本机放行；远程改普通配置项仍放行。

### 3. 敏感目录黑名单在 Windows 上完全失效（Critical）

**问题**：路径沙箱关闭时的兜底黑名单是硬编码的 Unix 目录
（`/etc`、`/proc`、`/sys`、`/dev`、`/boot`、`/root`），在 Windows 上一个都拦不住。
即便在 Linux 上也漏掉了 `~/.ssh`、`~/.aws` 等凭据目录。
此外 `workspace_guard` 与 `coding_tools` 两处实现不一致——前者沙箱关闭时连这 6 个
目录都不拦。

**修复**：新增 `src/core/sensitive_paths.py` 作为唯一实现，两处共用：
- Windows 系统目录从环境变量解析（不硬编码盘符）
- 两平台通用的用户凭据目录（`.ssh`、`.aws`、`.gnupg`、`.kube`、`.docker`、`.azure`、`.config/gcloud`）
- 凭据文件名拒绝表（`.env`、`id_rsa`、`credentials`、`models_config.json` 等）
- 按 `realpath` 判定，符号链接无法绕过

### 4. WebSocket 无 Origin 校验（High / CSWSH）

**问题**：浏览器不对 WebSocket 施加同源策略，CORS 中间件也管不到 WS 握手。
任意恶意网页都能连上 `ws://localhost:8020/ws/chat` 驱动本机 Agent。
**这条即使把服务绑定到 127.0.0.1 也依然可被利用。**

**修复**：`src/web/ws_handlers.py` 新增 `_reject_unauthorized_origin()`，
在 `/ws/chat` 与 `/ws/events` 的 `accept()` 之前校验 Origin：
- 与 CORS 使用同一组环境变量（`CORS_ORIGINS` / `CORS_ALLOW_ALL`）
- 额外允许桌面版 WebView 来源（`tauri://localhost` 等）
- 缺失 Origin 时放行（curl、桌面客户端等非浏览器场景不带该头；浏览器一定带）
- 不合法来源以 close code 1008 拒绝

### 5. 命令审批可被绕过（High）

三个独立的绕过路径，全部修复于 `src/core/workspace_guard.py`：

| 绕过方式 | 问题 | 修复 |
|---|---|---|
| 解释器内联 | `python -c "任意代码"` 的命令名是 `python`，命中白名单直接放行 | 新增 `_is_inline_code_execution()`，识别 13 种解释器的内联执行参数并要求审批 |
| 换行与重定向 | 链式检测漏掉 `\n`、`>`、`>>`、`<`、`&`，而底层是 `shell=True` | 补全危险字符表 |
| **黑名单模式链式绕过** | 链式检测**只在 whitelist 模式生效**，而默认模式是 blacklist。`echo hi && rm -rf /` 的黑名单匹配只看首个命令 `echo`，直接放行 | blacklist 分支同样对链式命令要求审批 |

> 第三条是本次修复中新发现的问题，原审计未覆盖。它影响**默认配置**，实际危害高于前两条。

### 6. 模型发现接口 SSRF（Medium）

**问题**：`POST /api/model-providers/models/discover` 的 `base_url` 用户可控，
只校验协议，无内网/回环/云元数据地址限制，且会回显部分响应。

**修复**：新增 `_reject_internal_network_target()`，解析主机名后拒绝私有、回环、
链路本地、保留、组播地址，并显式拒绝云元数据域名。

### 7. 插件镜像一致性校验静默降级（Medium）— **有意不修复**

**问题**：`src/plugin_system/source_selection.py` 本应以主源 commit 为权威、只接受
一致的镜像，但主源不可达时整段过滤被跳过，退化为信任任意可达镜像。

**结论：保留原行为，只补充告警日志。**

最初改为 fail-closed 后，`test_uses_mirror_when_primary_is_unavailable` 失败——
说明"主源不可达时用镜像"是上游**有意的可用性取舍**，有专门测试覆盖。
考虑到本机所处网络环境中 GitHub 常年不可达、Gitee 镜像是实际可用的唯一路径，
fail-closed 会直接导致插件无法安装。

利用该问题需要**同时满足**「镜像被攻陷」与「主源宕机」两个条件，安全收益远小于
可用性代价，因此撤销该修改，仅在降级时记录 warning 日志便于事后审计。

---

## 二、已修复的可靠性问题

### 8. 执行器启动失败无法诊断（High，部署时实际遇到）

**问题**：`asyncio.create_subprocess_exec` 未传 `stderr=`，子进程异常堆栈写入
无人接收的句柄（Windows 上还叠加 `CREATE_NO_WINDOW`）。父进程只能报告
`Workflow Executor exited during startup: 1`，真实原因完全丢失。

**修复**：`src/workflow/executor_supervisor.py`
- 子进程 stdout/stderr 重定向到运行目录下的 `executor.stderr`
- 新增 `_read_startup_output()` / `_with_startup_output()`，启动失败时把输出末尾
  4000 字符附加到异常信息中
- 两个启动失败分支都已接入

**验证**：当前运行的 4 个执行器进程均已生成 `executor.stderr` 文件。

### 9. 多进程共写同一日志文件（Medium）

**问题**：Controller 与 4 个 Executor 都对同一个 `logs/{日期}-web.log` 打开
`RotatingFileHandler`（非多进程安全）。Windows 上轮转需要 rename，文件被占用时
静默失败，导致日志丢失或交错——这直接放大了问题 8 的诊断难度。

**修复**：`src/web_server.py:setup_logging()` 按 `DETERMINFLOW_RUNTIME_ROLE`
和 PID 分文件。

**验证**：现在生成 `2026-08-27-web.log` 与 4 个
`2026-08-27-workflow-executor-{pid}.log`。

### 10. fire-and-forget 任务被 GC（High / Medium）

**问题**：多处 `create_task(emit_event(...))` 不保存任务引用。代码注释称
"emit_event 内部无 await 所以安全"，但**该前提在执行器进程中不成立**——事件要经
loopback 转发回主进程，是真实的异步网络 IO（已核实 `executor_events.py` 中有
`async with lock` + `await drain()`）。事件循环对任务只持弱引用，任务可能在完成前
被回收，导致状态事件丢失或乱序。

其中 `nodes/agent.py` 的审批任务后果最严重：它负责驱动 `completion_event`，
被回收会让节点**永久等待**而非报错。

**修复**：新增 `src/core/background_tasks.py` 提供 `spawn_background_task()`
（持有强引用 + 完成回调清理 + 异常记录），应用于 8 处调用点：
`engine.py`、`manager.py`、`nodes/base.py`、`nodes/subprocess.py`、`nodes/agent.py`、
`session_manager.py`、`session_lifecycle.py`、`approval_manager.py`。
同时修正了 `engine.py` 中那段已失效的注释。

### 11. 会话落盘临时文件名固定（Medium）

**问题**：`session.py` 用固定的 `.tmp` 后缀，而拆分执行器模式下 Controller 与
Executor 可能写向同一个 session 文件，固定后缀毫无隔离作用。项目在
`executor_pool` 和 `executor_transport` 中都正确使用了 `.tmp-{pid}`，唯独会话是例外。

**修复**：临时文件名加 PID 后缀，并在替换失败时清理残留临时文件。

### 12. 关停时遍历字典期间 await（Low）

**问题**：`session_lifecycle.py:938` 在 `for session in self.sessions.values()`
循环体内多次 await，期间若有协程增删 session 会抛
`RuntimeError: dictionary changed size during iteration`。

**修复**：改为先 `list()` 快照再遍历。

---

## 三、配置加固

| 文件 | 配置项 | 改动 | 理由 |
|---|---|---|---|
| `.env` | `WEB_HOST` | `0.0.0.0` → `127.0.0.1` | 核心 API 无身份认证，不应监听全部网卡 |
| `config/settings.json` | `CODING_PATH_SANDBOX_ENABLED` | `false` → `true` | 让 Agent 文件工具真正受工作区约束 |
| `config/settings.json` | `CODING_CMD_WHITELIST` | 移除 `node,python,pip` | 解释器在白名单中等同于任意代码执行 |

> 注意：默认命令模式是 `blacklist`，此时白名单不参与判定。白名单改动在切换到
> `whitelist` 模式后生效；而问题 5 的三项代码修复在两种模式下都生效。

---

## 四、未修复项（属上游设计决策）

- **核心 API 完全无身份认证**：`src/web/api_routes.py` 全文 `Depends(` 出现 0 次。
  为整个 API 层引入统一鉴权会改变产品形态，超出本次加固范围。当前通过绑定
  127.0.0.1 + 提权配置项本机限制来缓解。
- **MCP `command` 字段无限制**：`config/mcp_servers.json` 可指定任意可执行文件，
  结合任意文件写入可构成持久化后门。收紧需要定义受信目录策略。
- **插件继承 Core 全部环境变量**：`processes.py` 用 `os.environ.copy()`，
  而 `lifecycle.py` 用白名单，两处策略不一致。属最小权限硬化项。

建议把问题 4（WebSocket CSWSH）通过 `SECURITY.md` 的私密渠道报告给上游——
它即使绑定本机也可被利用，影响所有用户。

---

## 五、验证情况

### 回归测试

| | 失败 | 通过 |
|---|---:|---:|
| 修复前基线 | 79 | 735 |
| 修复后 | **78** | **736** |

失败分布按文件与基线**完全一致**，零新增回归。这些失败均为 Windows 平台的测试
基建问题（盘符被 `urlsplit` 当作 URL scheme、创建符号链接需管理员权限
`WinError 1314`、真实子进程执行器测试），与产品代码无关。

修复过程中曾引入 4 处回归，均已定位并解决：

| 回归 | 原因 | 处理 |
|---|---|---|
| `test_ui_settings_config` | 测试用 `SimpleNamespace` 作请求替身，无 `client` 属性 | 守卫函数改用 `getattr` 防御式取值 |
| `test_chat_session_guardrails`、`test_content_safety_diagnostic_protocol`（2） | 测试用 `_FakeWebSocket`，无 `headers` 属性 | Origin 校验同样改为防御式取值 |
| `test_plugin_source_selection` | fail-closed 与上游有意行为冲突 | 撤销该修改（见问题 7） |

### 功能验证

- 所有修改模块导入正常
- 两个实证漏洞复测：路径遍历返回 **HTTP 403**（修复前 200 并泄漏内容）、
  远程改提权配置返回 **403**、本机与普通配置项不受影响
- 命令守卫在 blacklist（默认）与 whitelist 两种模式下均按预期拦截，
  正常命令（`git status`、`ls`、`cat a.txt`）仍放行
- 沙箱开启后工作区内文件正常读写，`../` 与绝对路径被拒
- WebSocket Origin 白名单正确区分合法来源与恶意来源，桌面版来源已放行
- 服务正常启动，bishu-novel 插件 running，7 条工作流完好
- 端口确认只监听 `127.0.0.1`（原 `0.0.0.0`）
- stderr 捕获生效：4 个执行器进程均生成 `executor.stderr`；日志已按角色分文件

---

## 六、附记：本机存在解释器级随机崩溃

修复验证期间，服务启动失败了一次，退出码 `3221225477`（`0xC0000005`
访问违例／段错误）。这是 Python 解释器的硬崩溃，不是 Python 异常，重试即成功。

同类现象在本次工作中已出现 **4 次**，每次报错都不同：

- `pip` 安装时 `SystemError: dictobject.c:2828: bad argument to internal function`
- `pip` 安装时 `AttributeError: 'str' object has no attribute '_url'`
- 首次启动时 `TypeError: unsupported operand type(s) for +: 'list_iterator' and 'int'`（`re` 模块内部）
- 执行器子进程 `0xC0000005` 访问违例

这些错误位置各不相同且无法复现，指向**运行环境层面的内存问题**——常见原因是
杀毒软件进程注入或内存条不稳定，与本项目代码无关。建议跑一次 Windows 内存诊断。

值得一提的是：正是问题 8 的 stderr 捕获修复，让这次崩溃第一次显示出了子进程的
真实输出和崩溃位置，否则仍旧只能看到一个孤零零的退出码。
