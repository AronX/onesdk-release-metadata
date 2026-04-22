# OneSDK Release Metadata

OneSDK 与渠道 SDK 版本映射关系仓库。

当前仓库已切换到最终结构：

- `mappings/index.json`
- `mappings/versions/<onesdk_version>.json`

## 访问路径

### GitHub（海外）

```
https://raw.githubusercontent.com/{owner}/onesdk-release-metadata/main/mappings/index.json
```

### Gitee（国内）

```
https://gitee.com/{owner}/onesdk-release-metadata/raw/main/mappings/index.json
```

## 数据结构

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

## 目录结构

```
├── mappings/
│   ├── index.json
│   └── versions/
│       └── 1.36.0.json
├── docs/
│   └── versioned-layout-proposal.md
└── schemas/
    ├── index.schema.json
    └── version.schema.json
```

## 更新流程

渠道 SDK 发布时：

1. 先更新 `mappings/index.json`
2. 再更新对应版本文件，例如 `mappings/versions/1.36.0.json`
3. 提交 PR

版本文件中的渠道条目字段：

- `version`: 渠道 SDK 版本号
- `zip_url`: 渠道 ZIP 下载地址
- `md5`: ZIP 文件 MD5
- `release_date`: 渠道版本发布日期
- `release_note`: 渠道版本更新说明，推荐使用字符串数组

## 推荐读取流程

1. 先读取 `mappings/index.json`
2. 根据 OneSDK 版本找到目标文件，例如 `mappings/versions/1.36.0.json`
3. 再读取该版本下的渠道列表和渠道版本条目

## 设计说明

- [`docs/versioned-layout-proposal.md`](/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/docs/versioned-layout-proposal.md)
- [`docs/docker-deployment.md`](/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/docs/docker-deployment.md)

## Docker 部署

内部 Mac 机器部署可直接使用 Docker Compose：

```bash
docker compose up -d --build
```

默认访问：

```text
http://<内部Mac机器IP>:3210
```

完整部署说明见 [`docs/docker-deployment.md`](/Users/chengzixu/Documents/bilibili-code/OneSDK-Release-Metadata/docs/docker-deployment.md)。

## 双仓库同步

- 主仓库：GitHub
- 镜像仓库：Gitee（通过 Webhook 自动同步）
