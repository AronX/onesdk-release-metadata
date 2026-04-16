# Metadata Visual Admin App

## 目录

- `web/`: 前端静态页面
- `service/`: 轻量本地服务

## 启动方式

```bash
cd app/service
npm start
```

默认访问地址：

```text
http://127.0.0.1:3210
```

## 当前能力

- 读取 `mappings/index.json`
- 读取 `mappings/versions/*.json`
- 展示 OneSDK 版本列表
- 展示单版本渠道映射
- 新增 OneSDK 版本
- 新增渠道
- 新增、编辑、复制、删除渠道版本条目
- 保存时直接写回 metadata 工作区文件
