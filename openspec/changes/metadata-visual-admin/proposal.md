# Metadata Visual Admin

## Why

当前 OneSDK metadata 已经切换到：

- `mappings/index.json`
- `mappings/versions/<onesdk_version>.json`

这套结构比单文件模式更适合长期维护，但人工直接编辑 JSON 仍然有几个明显问题：

- 需要同时理解索引文件和版本文件，编辑心智负担较重
- 版本、渠道、渠道版本条目较多后，人工浏览效率低
- `release_note`、`zip_url`、`md5` 等字段容易漏填或格式不一致
- 团队内部虽然只有 2-3 人使用，但仍然需要一个统一、低门槛的可视化入口

## What

新增一个面向内部机器部署的轻量网页后台，用于：

- 可视化展示当前 metadata 仓库中的 OneSDK 版本和渠道映射关系
- 直接编辑 `index.json` 和 `versions/*.json`
- 对保存内容做 schema 和结构校验
- 将前端代码和 metadata 文件明确分目录存放，避免混在一起

## Scope

本次 change 只定义产品方案和技术边界，不要求立即实现完整后台。

目标形态为：

- 浏览器访问
- 极薄后端，仅负责本地文件读写
- 前端承担主要展示、编辑、校验、diff 逻辑
- 保存时直接修改 metadata 仓库工作区文件

不包含：

- 登录权限系统
- 自动 commit / PR
- 审批流
- 多环境部署
