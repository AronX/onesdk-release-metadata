# Metadata Visual Admin Design

## 1. Product Positioning

这是一套部署在内部机器上的轻量网页后台，用于管理 OneSDK 与渠道 SDK 的映射关系。

目标用户：

- 团队内 2-3 位维护 metadata 的研发或 SDK 发布负责人

核心原则：

- 使用网页访问，而不是原生 mac 应用
- 不引入复杂后台服务
- 前端承担大部分产品能力
- 后端仅保留最小文件读写接口
- 保存时直接改工作区文件，不额外生成中间文件

## 2. Recommended Architecture

推荐采用“前端 + 极薄本地服务”模式。

```text
Browser
  ├─ 版本列表 / 渠道表格 / 编辑表单 / diff / 校验提示
  └─ 调用本地 HTTP API

Lightweight Local Service
  ├─ 读取 mappings/index.json
  ├─ 读取 mappings/versions/*.json
  ├─ 保存修改后的文件
  └─ 返回 git status / git diff（可选）

OneSDK-Release-Metadata Repo
  ├─ mappings/index.json
  ├─ mappings/versions/*.json
  └─ schemas/*.json
```

不推荐纯静态网页，原因是它不能直接稳定地读写本地仓库文件。  
也不推荐完整后台服务，原因是当前用户规模太小，复杂度不值得。

## 3. Directory Layout

为避免代码与 metadata 文件混放，推荐新增独立目录：

```text
OneSDK-Release-Metadata/
├── app/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── service/
│       ├── src/
│       └── package.json
├── mappings/
│   ├── index.json
│   └── versions/
├── schemas/
├── docs/
└── openspec/
```

其中：

- `app/web/` 只放前端页面代码
- `app/service/` 只放轻量本地服务代码
- `mappings/` 只放真实数据

## 4. Information Architecture

### 4.1 Main View

页面推荐采用两栏结构：

- 左侧：OneSDK 版本列表
- 右侧：当前版本详情

左侧显示：

- OneSDK 版本号
- OneSDK 发布日期
- 渠道数量

右侧显示：

- 顶部：当前 OneSDK 版本基本信息
- 中部：按渠道分组的渠道版本列表
- 右侧或抽屉：新增 / 编辑表单

### 4.2 Core Entities

页面中需要明确区分三层对象：

1. OneSDK 版本
2. 渠道
3. 渠道版本条目

对应数据结构：

- `index.json` 管 OneSDK 版本索引
- `versions/<version>.json` 管单版本下的渠道映射
- 每个渠道下维护多个渠道版本条目

## 5. Core User Flows

### 5.1 Browse Current Metadata

1. 页面启动
2. 调用服务读取 `mappings/index.json`
3. 渲染 OneSDK 版本列表
4. 用户点击某个版本
5. 再读取对应 `mappings/versions/<version>.json`
6. 渲染该版本下所有渠道和渠道版本条目

### 5.2 Create New OneSDK Version

1. 点击“新增 OneSDK 版本”
2. 输入：
   - OneSDK 版本号
   - OneSDK 发布日期
3. 前端检查：
   - 版本号格式是否合法
   - 是否与现有版本重复
4. 服务生成：
   - `mappings/versions/<version>.json`
   - 更新 `mappings/index.json`
5. 保存后刷新版本列表

### 5.3 Edit Channel Entries

1. 打开某个 OneSDK 版本详情
2. 选择渠道
3. 新增或编辑渠道版本条目
4. 校验字段：
   - `version`
   - `zip_url`
   - `md5`
   - `release_date`
   - `release_note`
5. 保存时只更新当前版本文件，不直接改其它版本文件

## 6. Editing Model

推荐采用“内存编辑 + 显式保存”模式，而不是字段一改就立即落盘。

原因：

- 用户可以连续编辑多个字段后一次性保存
- 可以在保存前做完整校验
- 可以展示变更摘要

保存按钮点击后：

1. 前端将当前版本数据提交给服务
2. 服务写回目标 JSON 文件
3. 如果新增了 OneSDK 版本，再同步更新 `index.json`

## 7. Validation Strategy

校验分两层：

### 7.1 Frontend Validation

用于即时反馈：

- 版本号格式
- 必填项是否为空
- URL 格式是否合理
- `md5` 是否为空或长度异常
- `release_note` 是否是字符串数组

### 7.2 Service-side Validation

用于保存前兜底：

- `index.json` 是否符合 `schemas/index.schema.json`
- 版本文件是否符合 `schemas/version.schema.json`
- `index.json` 中的 `file` 是否与真实路径一致
- 目标版本文件名是否与 `version` 一致

## 8. Recommended Field Policy

为了让展示和编辑更稳定，建议在后台内统一采用以下字段规则：

- `release_note` 在 UI 层只用数组编辑
- 旧数据如果还是多行字符串，加载时转换成数组展示
- 保存时统一写回数组格式

这样可以逐步把历史数据收敛到统一形态。

## 9. Lightweight Service Boundary

后端仅保留这些接口即可：

- `GET /api/index`
- `GET /api/version/:version`
- `POST /api/version`
- `PUT /api/version/:version`
- `GET /api/git/status`（可选）
- `GET /api/git/diff/:version`（可选）

不建议一开始加入：

- 用户系统
- 鉴权网关
- 数据库存储
- 异步任务队列

## 10. Deployment Model

推荐部署方式：

- 在内部机器上启动本地服务
- 前端静态资源由同一服务托管
- 团队成员通过浏览器访问该机器地址

这样可以避免额外网关和多服务编排，最适合当前使用规模。

## 11. Future Extensions

后续如果要继续扩展，优先级建议如下：

1. 增加 git diff 预览
2. 增加保存前变更摘要
3. 增加 commit / push
4. 增加 PR 创建
5. 增加权限和操作审计

## 12. Success Criteria

这套后台达到可用状态时，应满足：

- 能清楚看到所有 OneSDK 版本
- 能看到每个版本下有哪些渠道和渠道版本
- 能新增 OneSDK 版本
- 能新增和编辑渠道版本条目
- 保存后直接写回 metadata 仓库文件
- 保存时不会破坏 schema 和文件结构

## 13. Interaction Design

详细交互方案见：

- [`interaction-design.md`](/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/openspec/changes/metadata-visual-admin/interaction-design.md)
