# Metadata Publish Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 metadata 可视化后台补齐发布主线：查看 git 状态、查看 diff 摘要、提交 commit、执行 push。

**Architecture:** 在现有极薄 Node 服务上补充 git 只读与写操作接口，前端新增发布确认面板和线性状态流。继续保持“保存写工作区”和“发布提交远端”分离，先在 UI 上串成一条连续主线。

**Tech Stack:** Node.js 内置 `http`/`child_process`、原生 HTML/CSS/JavaScript、git CLI

---

### Task 1: 扩展服务端 Git 接口

**Files:**
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/service/src/server.js`

- [ ] **Step 1: 增加 git 执行辅助函数**

目标：
- 在服务端统一执行 git 命令
- 固定工作目录为 metadata 仓库根目录
- 捕获 stdout/stderr，并在失败时返回明确错误

- [ ] **Step 2: 实现只读接口**

新增接口：
- `GET /api/git/status`
- `GET /api/git/diff`

返回内容至少包括：
- 当前工作区是否干净
- 已修改文件列表
- diff 文本摘要

- [ ] **Step 3: 实现发布写接口**

新增接口：
- `POST /api/git/commit`
- `POST /api/git/push`

规则：
- `commit` 要求 commit message 非空
- `push` 默认推送当前分支
- 如果 git 执行失败，返回 400 和明确错误信息

- [ ] **Step 4: 做最小语法验证**

Run:
```bash
node --check /Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/service/src/server.js
```

Expected:
- 无输出，退出码 0

### Task 2: 前端补发布确认面板

**Files:**
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/web/index.html`
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/web/styles.css`
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/web/app.js`

- [ ] **Step 1: 增加顶部流程状态和发布入口**

目标：
- 页面顶部显示线性步骤条
- 保存成功后给出“进入发布”动作

- [ ] **Step 2: 增加发布确认面板**

面板要展示：
- 当前变更摘要
- git status 摘要
- diff 预览
- commit message 输入框
- 按钮：
  - 返回继续编辑
  - 提交 commit
  - 提交并推送

- [ ] **Step 3: 接入 commit / push**

行为：
- commit 成功后刷新 git 状态
- push 成功后给出成功提示
- commit 成功但 push 失败时，明确提示是半成功状态

- [ ] **Step 4: 优化状态反馈**

需要展示：
- 发布执行中
- commit 成功
- push 成功
- push 失败

### Task 3: 文档与回归验证

**Files:**
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/README.md`
- Modify: `/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/openspec/changes/metadata-visual-admin/tasks.md`

- [ ] **Step 1: 更新启动与发布说明**

补充：
- 新增 git 发布能力
- 如何在页面中 commit / push

- [ ] **Step 2: 更新 OpenSpec 任务状态**

把新增发布流相关任务同步到 `tasks.md`

- [ ] **Step 3: 本地回归**

Run:
```bash
node --check /Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/service/src/server.js
node --check /Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/web/app.js
node /Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/app/service/src/server.js
```

再验证：
- `GET /api/git/status`
- `GET /api/git/diff`
- 页面能打开
- 发布面板能显示

- [ ] **Step 4: 收尾检查**

确认：
- 服务端没有破坏现有读取/保存能力
- 前端没有丢失新增版本和编辑条目的现有能力
