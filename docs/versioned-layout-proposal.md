# OneSDK Metadata 最终结构说明

## 背景

单文件模式下，所有 OneSDK 版本都会堆在一个 JSON 中。这个模式在早期还可以工作，但随着版本增长，会出现几个明显问题：

- 文件体积持续增长
- 多人更新时更容易发生 Git 冲突
- 单次 PR 很难看清只改了哪个版本
- 用户侧如果只关心一个 OneSDK 版本，却需要读取整个大文件

## 当前最终结构

仓库现在采用“索引文件 + 单版本文件”模式：

```text
OneSDK-Release-Metadata/
├── mappings/
│   ├── index.json
│   └── versions/
│       ├── 1.36.0.json
│       ├── 1.37.0.json
│       └── 1.38.0.json
└── schemas/
    ├── index.schema.json
    └── version.schema.json
```

## 文件职责

### `mappings/index.json`

只维护轻量索引信息：

- 有哪些 OneSDK 版本
- 每个版本的发布日期
- 每个版本对应哪个详情文件

示例：

```json
{
  "$schema": "../schemas/index.schema.json",
  "versions": [
    {
      "version": "1.36.0",
      "release_date": "2026-04-01",
      "file": "versions/1.36.0.json"
    }
  ]
}
```

### `mappings/versions/1.36.0.json`

只维护单个 OneSDK 版本的完整渠道映射。

示例：

```json
{
  "$schema": "../../schemas/version.schema.json",
  "version": "1.36.0",
  "release_date": "2026-04-01",
  "channels": {
    "bilibili": [
      {
        "version": "4.4.0",
        "zip_url": "https://pkgdl.biligame.net/tool/ONESDK/ONE-SDK-v1.33.0-海外lumo-20260327172316.zip",
        "md5": "cdbfac868e8473942fba640899f8e78c",
        "release_date": "2026-04-08",
        "release_note": [
          "更新 Aihelp SDK",
          "优化红点未读消息逻辑"
        ]
      }
    ]
  }
}
```

## 推荐字段约束

### 顶层版本文件

- `version`: OneSDK 版本号
- `release_date`: OneSDK 版本发布日期
- `channels`: 渠道映射

### 渠道版本条目

- `version`: 渠道 SDK 版本号
- `zip_url`: 渠道 ZIP 下载地址
- `md5`: ZIP MD5
- `release_date`: 渠道版本发布日期
- `release_note`: 推荐改成字符串数组，便于展示和 diff

## 为什么推荐 `release_note` 改成数组

当前真实数据里是多行字符串，例如：

```json
"release_note": "1.更新 Aihelp SDK\n2.优化红点未读消息逻辑"
```

建议后续统一成：

```json
"release_note": [
  "更新 Aihelp SDK",
  "优化红点未读消息逻辑"
]
```

这样有几个好处：

- 更适合前端展示
- 更适合脚本处理
- Git diff 更清楚

## 用户侧读取方式

用户脚本推荐这样读取：

1. 读取 `mappings/index.json`
2. 找到当前 OneSDK 版本对应的 `file`
3. 再读取 `mappings/versions/<version>.json`
4. 根据渠道名和渠道版本生成下载选择

## 使用建议

发布侧和用户侧都应以这套结构为准：

1. 发布侧更新 `index.json` 和目标版本文件
2. 用户侧先读 `index.json`
3. 再按版本读取 `versions/<version>.json`
