## 1. Repository Layout

- [x] 1.1 新增 `app/web/` 目录，存放前端代码
- [x] 1.2 新增 `app/service/` 目录，存放轻量本地服务代码
- [x] 1.3 确保 `mappings/` 与 `app/` 明确分离

## 2. Read Flow

- [x] 2.1 实现读取 `mappings/index.json` 的接口
- [x] 2.2 实现按版本读取 `mappings/versions/<version>.json` 的接口
- [x] 2.3 前端完成 OneSDK 版本列表渲染
- [x] 2.4 前端完成单版本详情渲染

## 3. Edit Flow

- [x] 3.1 支持新增 OneSDK 版本
- [x] 3.2 支持新增渠道
- [x] 3.3 支持新增渠道版本条目
- [x] 3.4 支持编辑现有渠道版本条目
- [x] 3.5 保存时同步更新 `index.json` 和目标版本文件

## 4. Validation

- [x] 4.1 前端增加字段级校验
- [x] 4.2 服务端增加 schema 校验
- [x] 4.3 对 `release_note` 做统一数组化处理
- [x] 4.4 保存失败时提供明确错误提示

## 5. UX

- [x] 5.1 页面采用“两栏结构”展示版本与详情
- [x] 5.2 编辑区支持显式保存
- [x] 5.3 提供变更提示或 diff 预览
- [x] 5.4 保存成功后自动刷新当前视图

## 6. Deployment

- [x] 6.1 支持在内部机器上单机启动
- [x] 6.2 前端静态资源由本地服务统一托管
- [x] 6.3 提供最小部署说明
