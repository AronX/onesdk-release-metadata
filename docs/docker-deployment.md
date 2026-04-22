# Docker 部署说明

本文档用于把 OneSDK Metadata Admin 部署到内部 Mac 机器，通过浏览器管理 `mappings/` 下的映射数据。

## 部署模型

Docker 服务会把当前仓库挂载到容器内的 `/workspace`：

- 网页编辑后，JSON 会直接写回宿主机仓库的 `mappings/`
- 网页里的 commit / push 会在同一个宿主机 Git 工作区上执行
- 容器重启或重建不会丢失 metadata 改动

## 前置条件

内部 Mac 机器需要准备：

1. 安装 Docker Desktop
2. 克隆本仓库
3. 确认仓库有可用的远端地址

```bash
git remote -v
```

## 启动服务

在仓库根目录执行：

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://<内部Mac机器IP>:3210
```

如果只希望本机访问，可以把 `docker-compose.yml` 里的端口改成：

```yaml
ports:
  - "127.0.0.1:3210:3210"
```

## 配置 commit 用户

默认 commit 用户是：

```text
OneSDK Metadata Admin <onesdk-metadata-admin@internal.local>
```

如需改成团队账号，在启动前设置环境变量：

```bash
export GIT_USER_NAME="OneSDK Release Bot"
export GIT_USER_EMAIL="onesdk-release@example.com"
docker compose up -d --build
```

## 如果需要在网页里 push

网页里的 commit 不需要额外认证；push 需要容器能访问 Git 远端。

### SSH 远端

先确保内部 Mac 宿主机本身可以 push：

```bash
ssh -T git@github.com
git push --dry-run
```

然后用 SSH override 启动：

```bash
docker compose -f docker-compose.yml -f docker-compose.ssh.yml up -d --build
```

这个模式会只读挂载宿主机的 `~/.ssh` 到容器中。请先在宿主机完成 `known_hosts` 初始化，避免容器内首次连接时无法写入。

### HTTPS/token 远端

如果远端是 HTTPS，建议在宿主机执行 push，或在容器内按公司规范配置凭据。网页里提交 commit 后，也可以在宿主机仓库根目录执行：

```bash
git push origin main
```

## 常用运维命令

查看日志：

```bash
docker compose logs -f metadata-admin
```

重启：

```bash
docker compose restart metadata-admin
```

停止：

```bash
docker compose down
```

升级代码后重新构建：

```bash
git pull
docker compose up -d --build
```

检查容器健康状态：

```bash
docker compose ps
curl http://127.0.0.1:3210/api/health
```

## 数据安全说明

- “保存”会直接写入宿主机仓库的 `mappings/index.json` 和 `mappings/versions/*.json`
- “提交 commit”只会提交 `mappings/index.json` 和 `mappings/versions`
- “丢弃 mappings 变更”只会回退 `mappings/` 目录下的改动
- 不要把服务直接暴露到公网；当前后台没有登录鉴权
