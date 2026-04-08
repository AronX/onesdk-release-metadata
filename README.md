# OneSDK Release Metadata

OneSDK 与渠道 SDK 版本映射关系仓库。

## 访问路径

### GitHub（海外）

```
https://raw.githubusercontent.com/{owner}/onesdk-release-metadata/main/mappings/onesdk.json
```

### Gitee（国内）

```
https://gitee.com/{owner}/onesdk-release-metadata/raw/main/mappings/onesdk.json
```

## 数据格式

```json
{
  "1.36.0": {
    "release_date": "2026-04-01",
    "channels": {
      "bilibili": {
        "version": "4.4.0",
        "zip_url": "https://xc-1253504421.cos.ap-shanghai.myqcloud.com/bilibili/Bilibili_iOS_SDK_v4.4.0.zip",
        "size_bytes": 721705052
      }
    }
  }
}
```

## 目录结构

```
├── mappings/
│   └── onesdk.json          # OneSDK 版本 -> 渠道版本映射
└── schemas/
    └── mapping.schema.json   # JSON Schema 验证
```

## 更新流程

渠道 SDK 发布时，更新 `mappings/onesdk.json` 并提交 PR。

## 双仓库同步

- 主仓库：GitHub
- 镜像仓库：Gitee（通过 Webhook 自动同步）
