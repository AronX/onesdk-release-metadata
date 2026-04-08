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
  "$schema": "./schemas/mapping.schema.json",
  "1.36.0": {
    "release_date": "2026-04-01",
    "channels": {
      "bilibili": [
        {
          "version": "4.4.0",
          "zip_url": "https://xc-1253504421.cos.ap-shanghai.myqcloud.com/bilibili/bilibili_V4.4.0_20260408152235.zip",
          "md5": "cdbfac868e8473942fba640899f8e78c"
        }
      ]
    }
  }
}
```

## 目录结构

```
├── mappings/
│   └── onesdk.json          # OneSDK 版本 -> 渠道 -> 渠道版本条目列表
└── schemas/
    └── mapping.schema.json   # JSON Schema 验证
```

## 更新流程

渠道 SDK 发布时，更新 `mappings/onesdk.json` 并提交 PR。

每个 OneSDK 版本下可以维护多个渠道，每个渠道可以维护多个渠道 SDK 版本条目。
当前条目字段包括：

- `version`: 渠道 SDK 版本号
- `zip_url`: 渠道 ZIP 下载地址
- `md5`: ZIP 文件 MD5

## 双仓库同步

- 主仓库：GitHub
- 镜像仓库：Gitee（通过 Webhook 自动同步）
