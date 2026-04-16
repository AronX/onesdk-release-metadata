const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { execFileSync, execSync } = require("child_process");

const PORT = Number(process.env.PORT || 3210);
const SERVICE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SERVICE_ROOT, "..", "..");
const WEB_ROOT = path.resolve(REPO_ROOT, "app", "web");
const MAPPINGS_ROOT = path.resolve(REPO_ROOT, "mappings");
const VERSIONS_ROOT = path.resolve(MAPPINGS_ROOT, "versions");
const INDEX_FILE = path.resolve(MAPPINGS_ROOT, "index.json");
const PUBLISH_TARGETS = ["mappings/index.json", "mappings/versions"];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const detail = stderr || stdout || error.message;
    const wrapped = new Error(detail || `git ${args.join(" ")} 执行失败`);
    wrapped.statusCode = 400;
    throw wrapped;
  }
}

function runGitAllowing(args, allowedExitCodes = [0]) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const exitCode = typeof error.status === "number" ? error.status : null;
    if (exitCode !== null && allowedExitCodes.includes(exitCode)) {
      return String(error.stdout || "");
    }
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const detail = stderr || stdout || error.message;
    const wrapped = new Error(detail || `git ${args.join(" ")} 执行失败`);
    wrapped.statusCode = 400;
    throw wrapped;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

function isVersionString(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || "").trim());
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function normalizeReleaseNotes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function compareVersions(a, b) {
  const av = a.split(".").map((item) => Number(item));
  const bv = b.split(".").map((item) => Number(item));
  for (let index = 0; index < Math.max(av.length, bv.length); index += 1) {
    const left = av[index] || 0;
    const right = bv[index] || 0;
    if (left !== right) {
      return right - left;
    }
  }
  return 0;
}

function loadIndex() {
  const indexJson = readJson(INDEX_FILE);
  const versions = Array.isArray(indexJson.versions) ? indexJson.versions.slice() : [];
  versions.sort((left, right) => compareVersions(left.version, right.version));
  return {
    $schema: indexJson.$schema,
    versions
  };
}

function versionFilePath(version) {
  return path.resolve(VERSIONS_ROOT, `${version}.json`);
}

function loadVersion(version) {
  const filePath = versionFilePath(version);
  if (!fs.existsSync(filePath)) {
    const error = new Error(`未找到版本文件: ${version}`);
    error.statusCode = 404;
    throw error;
  }
  return readJson(filePath);
}

function validateIndexDocument(indexJson) {
  if (!indexJson || !Array.isArray(indexJson.versions)) {
    throw new Error("index.json 必须包含 versions 数组");
  }
  for (const item of indexJson.versions) {
    if (!isVersionString(item.version)) {
      throw new Error(`index.json 中存在非法版本号: ${item.version}`);
    }
    if (!isDateString(item.release_date)) {
      throw new Error(`index.json 中版本 ${item.version} 的 release_date 非法`);
    }
    const expectedFile = `versions/${item.version}.json`;
    if (item.file !== expectedFile) {
      throw new Error(`index.json 中版本 ${item.version} 的 file 必须为 ${expectedFile}`);
    }
  }
}

function validateVersionDocument(versionJson, expectedVersion, options = {}) {
  const { allowEmptyChannels = false } = options;
  if (!versionJson || typeof versionJson !== "object") {
    throw new Error("版本文件内容不能为空");
  }
  if (!isVersionString(versionJson.version)) {
    throw new Error("版本文件 version 格式非法");
  }
  if (versionJson.version !== expectedVersion) {
    throw new Error(`版本文件 version 必须与文件名一致: ${expectedVersion}`);
  }
  if (!isDateString(versionJson.release_date)) {
    throw new Error("版本文件 release_date 格式非法");
  }
  if (!versionJson.channels || typeof versionJson.channels !== "object" || Array.isArray(versionJson.channels)) {
    throw new Error("版本文件 channels 必须为对象");
  }
  if (!allowEmptyChannels && Object.keys(versionJson.channels).length === 0) {
    throw new Error(`版本 ${expectedVersion} 还没有配置任何渠道映射，不能提交发布`);
  }

  for (const [channelName, entries] of Object.entries(versionJson.channels)) {
    if (!channelName.trim()) {
      throw new Error("渠道名称不能为空");
    }
    if (!Array.isArray(entries)) {
      throw new Error(`渠道 ${channelName} 的条目必须为数组`);
    }

    const seenVersions = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        throw new Error(`渠道 ${channelName} 存在非法条目`);
      }
      if (!entry.version || typeof entry.version !== "string") {
        throw new Error(`渠道 ${channelName} 的条目缺少 version`);
      }
      if (seenVersions.has(entry.version)) {
        throw new Error(`渠道 ${channelName} 下存在重复版本: ${entry.version}`);
      }
      seenVersions.add(entry.version);
      if (!entry.release_date || !isDateString(entry.release_date)) {
        throw new Error(`渠道 ${channelName} / ${entry.version} 的 release_date 格式非法`);
      }
      if (!entry.zip_url || !validateUrl(entry.zip_url)) {
        throw new Error(`渠道 ${channelName} / ${entry.version} 的 zip_url 非法`);
      }
      if (!entry.md5 || typeof entry.md5 !== "string") {
        throw new Error(`渠道 ${channelName} / ${entry.version} 的 md5 不能为空`);
      }
      if (!Array.isArray(entry.release_note)) {
        throw new Error(`渠道 ${channelName} / ${entry.version} 的 release_note 必须为数组`);
      }
    }
  }
}

function validatePublishableMetadataFiles(files) {
  const indexJson = loadIndex();
  validateIndexDocument(indexJson);

  for (const file of files) {
    if (!file.path.startsWith("mappings/versions/") || !file.path.endsWith(".json")) {
      continue;
    }
    const version = path.basename(file.path, ".json");
    const versionJson = loadVersion(version);
    validateVersionDocument(versionJson, version, { allowEmptyChannels: false });
  }
}

function normalizeVersionDocument(input) {
  const versionJson = {
    $schema: "../../schemas/version.schema.json",
    version: String(input.version || "").trim(),
    release_date: String(input.release_date || "").trim(),
    channels: {}
  };

  const channels = input.channels && typeof input.channels === "object" ? input.channels : {};
  for (const [channelName, entries] of Object.entries(channels)) {
    const normalizedChannel = String(channelName || "").trim();
    const normalizedEntries = Array.isArray(entries) ? entries : [];
    versionJson.channels[normalizedChannel] = normalizedEntries.map((entry) => ({
      version: String(entry.version || "").trim(),
      zip_url: String(entry.zip_url || "").trim(),
      md5: String(entry.md5 || "").trim(),
      release_date: String(entry.release_date || "").trim(),
      release_note: normalizeReleaseNotes(entry.release_note)
    }));
  }
  return versionJson;
}

function currentBranchName() {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

function isPublishablePath(filePath) {
  return filePath === "mappings/index.json" || filePath.startsWith("mappings/versions/");
}

function gitStatusSummary() {
  const porcelain = runGit(["status", "--short"]);
  const lines = porcelain ? porcelain.split("\n").filter(Boolean) : [];
  const files = lines.map((line) => ({
    status: line.slice(0, 2).trim() || "??",
    path: line.slice(3).trim()
  }));
  const publishableFiles = files.filter((item) => isPublishablePath(item.path));
  const blockedFiles = files.filter((item) => !isPublishablePath(item.path));
  return {
    clean: files.length === 0,
    branch: currentBranchName(),
    files,
    publishable_files: publishableFiles,
    blocked_files: blockedFiles
  };
}

function gitDiffForFile(file) {
  if (file.status === "??") {
    return runGitAllowing(["diff", "--no-index", "--no-color", "--", "/dev/null", file.path], [0, 1]).trim();
  }
  return runGitAllowing(["diff", "--no-color", "--", file.path], [0, 1]).trim();
}

function gitDiffSummary() {
  const status = gitStatusSummary();
  const files = status.publishable_files.map((file) => ({
    status: file.status,
    path: file.path,
    diff: gitDiffForFile(file)
  }));
  const diff = files
    .map((file) => file.diff)
    .filter(Boolean)
    .join("\n");
  return {
    diff,
    files
  };
}

function gitCommit(message) {
  if (!message || !message.trim()) {
    throw new Error("commit message 不能为空");
  }
  const status = gitStatusSummary();
  if (status.publishable_files.length === 0) {
    throw new Error("当前没有可发布的 metadata 改动");
  }
  validatePublishableMetadataFiles(status.publishable_files);
  runGit(["add", ...PUBLISH_TARGETS]);
  runGit(["commit", "-m", message.trim()]);
  const hash = runGit(["rev-parse", "--short", "HEAD"]);
  return {
    commit: hash.trim(),
    branch: currentBranchName(),
    published_files: status.publishable_files.map((item) => item.path)
  };
}

function gitPush() {
  const branch = currentBranchName();
  runGit(["push", "origin", branch]);
  return {
    branch
  };
}

function discardMappingsChanges() {
  runGit(["restore", "--source=HEAD", "--staged", "--worktree", "--", ...PUBLISH_TARGETS]);
  runGitAllowing(["clean", "-fd", "--", "mappings"], [0, 1]);
  return gitStatusSummary();
}

function buildVersionSummary(version, releaseDate, channels) {
  const channelCount = Object.keys(channels).length;
  const entryCount = Object.values(channels).reduce((count, items) => count + items.length, 0);
  return {
    version,
    release_date: releaseDate,
    file: `versions/${version}.json`,
    channel_count: channelCount,
    entry_count: entryCount
  };
}

function enrichIndex(indexJson) {
  return {
    $schema: indexJson.$schema,
    versions: indexJson.versions.map((item) => {
      const filePath = versionFilePath(item.version);
      if (!fs.existsSync(filePath)) {
        return {
          ...item,
          channel_count: 0,
          entry_count: 0,
          missing: true
        };
      }
      const versionJson = readJson(filePath);
      return buildVersionSummary(item.version, item.release_date, versionJson.channels || {});
    })
  };
}

function createVersion(version, releaseDate) {
  if (!isVersionString(version)) {
    throw new Error("OneSDK 版本号必须为 x.y.z");
  }
  if (!isDateString(releaseDate)) {
    throw new Error("发布日期必须为 YYYY-MM-DD");
  }
  const currentIndex = loadIndex();
  if (currentIndex.versions.some((item) => item.version === version)) {
    throw new Error(`OneSDK 版本已存在: ${version}`);
  }

  const versionJson = {
    $schema: "../../schemas/version.schema.json",
    version,
    release_date: releaseDate,
    channels: {}
  };
  validateVersionDocument(versionJson, version, { allowEmptyChannels: true });
  writeJson(versionFilePath(version), versionJson);

  const nextIndex = {
    $schema: "../schemas/index.schema.json",
    versions: currentIndex.versions
      .concat([{ version, release_date: releaseDate, file: `versions/${version}.json` }])
      .sort((left, right) => compareVersions(left.version, right.version))
  };
  validateIndexDocument(nextIndex);
  writeJson(INDEX_FILE, nextIndex);

  return versionJson;
}

function saveVersion(version, input) {
  const normalized = normalizeVersionDocument(input);
  validateVersionDocument(normalized, version, { allowEmptyChannels: true });
  writeJson(versionFilePath(version), normalized);

  const currentIndex = loadIndex();
  const existing = currentIndex.versions.find((item) => item.version === version);
  const nextIndex = {
    $schema: "../schemas/index.schema.json",
    versions: currentIndex.versions
      .filter((item) => item.version !== version)
      .concat([
        {
          version,
          release_date: normalized.release_date,
          file: `versions/${version}.json`
        }
      ])
      .sort((left, right) => compareVersions(left.version, right.version))
  };
  if (!existing && !fs.existsSync(versionFilePath(version))) {
    throw new Error(`未找到版本文件: ${version}`);
  }
  validateIndexDocument(nextIndex);
  writeJson(INDEX_FILE, nextIndex);
  return normalized;
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    req.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) {
        reject(new Error("请求体过大"));
      }
    });
    req.on("end", () => {
      if (!buffer) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(buffer));
      } catch (_) {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, requestPathname) {
  const relativePath = requestPathname === "/" ? "/index.html" : requestPathname;
  const filePath = path.resolve(WEB_ROOT, `.${relativePath}`);
  if (!filePath.startsWith(WEB_ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not Found");
    return;
  }
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mimeType });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/index") {
      const indexJson = loadIndex();
      validateIndexDocument(indexJson);
      sendJson(res, 200, enrichIndex(indexJson));
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/version/")) {
      const version = decodeURIComponent(pathname.replace("/api/version/", ""));
      const versionJson = loadVersion(version);
      validateVersionDocument(versionJson, version, { allowEmptyChannels: true });
      sendJson(res, 200, versionJson);
      return;
    }

    if (req.method === "POST" && pathname === "/api/version") {
      const body = await collectRequestBody(req);
      const versionJson = createVersion(String(body.version || "").trim(), String(body.release_date || "").trim());
      sendJson(res, 201, versionJson);
      return;
    }

    if (req.method === "PUT" && pathname.startsWith("/api/version/")) {
      const version = decodeURIComponent(pathname.replace("/api/version/", ""));
      const body = await collectRequestBody(req);
      const versionJson = saveVersion(version, body);
      sendJson(res, 200, versionJson);
      return;
    }

    if (req.method === "GET" && pathname === "/api/git/status") {
      sendJson(res, 200, gitStatusSummary());
      return;
    }

    if (req.method === "GET" && pathname === "/api/git/diff") {
      sendJson(res, 200, gitDiffSummary());
      return;
    }

    if (req.method === "POST" && pathname === "/api/git/commit") {
      const body = await collectRequestBody(req);
      sendJson(res, 200, gitCommit(String(body.message || "")));
      return;
    }

    if (req.method === "POST" && pathname === "/api/git/push") {
      sendJson(res, 200, gitPush());
      return;
    }

    if (req.method === "POST" && pathname === "/api/git/discard-mappings") {
      sendJson(res, 200, discardMappingsChanges());
      return;
    }

    sendJson(res, 404, { error: "接口不存在" });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    sendJson(res, statusCode, {
      error: error.message || "请求失败"
    });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
});

function describePortOccupant(port) {
  try {
    const pid = execSync(`lsof -ti tcp:${port}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .trim()
      .split("\n")
      .filter(Boolean)[0];

    if (!pid) {
      return null;
    }

    const command = execSync(`ps -p ${pid} -o command=`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    return { pid, command };
  } catch (_) {
    return null;
  }
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const occupant = describePortOccupant(PORT);
    console.error(`端口 ${PORT} 已被占用，当前服务无法启动。`);
    if (occupant) {
      console.error(`占用进程 PID: ${occupant.pid}`);
      console.error(`占用命令: ${occupant.command}`);
      console.error(`可执行: kill ${occupant.pid}`);
    } else {
      console.error(`可执行: lsof -iTCP:${PORT} -sTCP:LISTEN 查看占用进程`);
    }
    console.error(`或者使用临时端口启动: PORT=${PORT + 1} npm start`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`OneSDK Metadata Admin service running at http://127.0.0.1:${PORT}`);
});
