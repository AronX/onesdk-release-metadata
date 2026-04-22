const state = {
  index: null,
  selectedVersion: null,
  versionDoc: null,
  originalDoc: null,
  dirty: false,
  editor: {
    mode: "empty",
    channelName: "",
    entryVersion: ""
  }
};

const elements = {
  statusText: document.getElementById("status-text"),
  versionList: document.getElementById("version-list"),
  detailView: document.getElementById("detail-view"),
  editorTitle: document.getElementById("editor-title"),
  editorBody: document.getElementById("editor-body"),
  saveButton: document.getElementById("save-button"),
  publishButton: document.getElementById("publish-button"),
  refreshButton: document.getElementById("refresh-button"),
  newVersionButton: document.getElementById("new-version-button"),
  showChangesButton: document.getElementById("show-changes-button"),
  newVersionDialog: document.getElementById("new-version-dialog"),
  newVersionForm: document.getElementById("new-version-form"),
  newVersionInput: document.getElementById("new-version-input"),
  newVersionDateInput: document.getElementById("new-version-date-input"),
  newVersionError: document.getElementById("new-version-error"),
  newVersionCancel: document.getElementById("new-version-cancel"),
  changesDialog: document.getElementById("changes-dialog"),
  changesSummary: document.getElementById("changes-summary"),
  changesClose: document.getElementById("changes-close"),
  deleteChannelDialog: document.getElementById("delete-channel-dialog"),
  deleteChannelMessage: document.getElementById("delete-channel-message"),
  deleteChannelCancel: document.getElementById("delete-channel-cancel"),
  deleteChannelSubmit: document.getElementById("delete-channel-submit"),
  deleteVersionDialog: document.getElementById("delete-version-dialog"),
  deleteVersionMessage: document.getElementById("delete-version-message"),
  deleteVersionCancel: document.getElementById("delete-version-cancel"),
  deleteVersionSubmit: document.getElementById("delete-version-submit"),
  publishDialog: document.getElementById("publish-dialog"),
  publishChangesSummary: document.getElementById("publish-changes-summary"),
  publishGitStatus: document.getElementById("publish-git-status"),
  publishDiffFiles: document.getElementById("publish-diff-files"),
  publishGitDiff: document.getElementById("publish-git-diff"),
  ossSyncStatus: document.getElementById("oss-sync-status"),
  commitMessageInput: document.getElementById("commit-message-input"),
  publishError: document.getElementById("publish-error"),
  publishClose: document.getElementById("publish-close"),
  discardMappingsButton: document.getElementById("discard-mappings-button"),
  ossSyncButton: document.getElementById("oss-sync-button"),
  commitButton: document.getElementById("commit-button"),
  pushButton: document.getElementById("push-button"),
  discardConfirmDialog: document.getElementById("discard-confirm-dialog"),
  discardConfirmCancel: document.getElementById("discard-confirm-cancel"),
  discardConfirmSubmit: document.getElementById("discard-confirm-submit"),
  flowSteps: document.getElementById("flow-steps"),
  toast: document.getElementById("toast")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function semverCompare(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (right[index] || 0) - (left[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function setDirty(flag) {
  state.dirty = flag;
  elements.saveButton.disabled = !flag;
  elements.publishButton.disabled = flag || !state.selectedVersion;
  renderStatus(flag ? "当前存在未保存修改" : "已加载 metadata");
  renderFlow(flag ? 2 : state.selectedVersion ? 3 : 1);
}

function renderStatus(text) {
  elements.statusText.textContent = text;
}

function renderFlow(stepIndex) {
  const steps = elements.flowSteps.querySelectorAll(".flow-step");
  steps.forEach((step, index) => {
    step.classList.toggle("active", index + 1 === stepIndex);
  });
}

function showToast(message, tone = "success") {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${tone}`;
  elements.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function loadIndex(selectVersion) {
  renderStatus("正在加载 metadata...");
  const indexJson = await apiFetch("/api/index");
  state.index = indexJson;
  renderVersionList();
  const targetVersion =
    selectVersion ||
    state.selectedVersion ||
    (indexJson.versions[0] ? indexJson.versions[0].version : "");
  if (targetVersion) {
    await loadVersion(targetVersion);
  } else {
    state.selectedVersion = null;
    state.versionDoc = null;
    state.originalDoc = null;
    setDirty(false);
    renderDetail();
    renderEditor();
  }
}

async function loadVersion(version) {
  if (state.dirty && version !== state.selectedVersion) {
    const confirmed = window.confirm("当前有未保存修改，确定切换版本吗？");
    if (!confirmed) return;
  }
  const versionJson = await apiFetch(`/api/version/${encodeURIComponent(version)}`);
  state.selectedVersion = version;
  state.versionDoc = clone(versionJson);
  state.originalDoc = clone(versionJson);
  state.editor = { mode: "empty", channelName: "", entryVersion: "" };
  setDirty(false);
  renderVersionList();
  renderDetail();
  renderEditor();
}

function renderVersionList() {
  const versions = state.index?.versions || [];
  if (!versions.length) {
    elements.versionList.innerHTML = '<div class="empty-state">还没有 OneSDK 版本，点击上方按钮开始创建</div>';
    return;
  }

  elements.versionList.innerHTML = versions
    .map((item) => {
      const active = item.version === state.selectedVersion ? "active" : "";
      const dirtyMark = state.dirty && item.version === state.selectedVersion ? '<span class="dirty-dot"></span>' : "";
      return `
        <button class="version-card ${active}" data-version="${item.version}">
          <h3>${item.version}${dirtyMark}</h3>
          <div class="meta-line">发布日期：${item.release_date}</div>
          <div class="meta-line">渠道：${item.channel_count ?? 0} 个</div>
          <div class="meta-line">条目：${item.entry_count ?? 0} 条</div>
        </button>
      `;
    })
    .join("");

  elements.versionList.querySelectorAll("[data-version]").forEach((button) => {
    button.addEventListener("click", () => loadVersion(button.dataset.version));
  });
}

function versionSummaryHtml() {
  if (!state.versionDoc) {
    return `
      <div class="empty-state">
        当前还没有可展示的 OneSDK 版本，请先新增一个版本。
      </div>
    `;
  }

  const versionDoc = state.versionDoc;
  const channels = Object.entries(versionDoc.channels || {});
  const channelBlocks = channels.length
    ? channels.map(([channelName, entries]) => renderChannelBlock(channelName, entries)).join("")
    : `
      <div class="empty-state">
        当前版本还没有渠道。<br />
        可以先点击“新增渠道”开始录入。
      </div>
    `;

  return `
    <div class="detail-header">
      <div>
        <h2>版本：${versionDoc.version}</h2>
        <div class="meta-line">发布日期：${versionDoc.release_date}</div>
        <div class="meta-line">文件：mappings/versions/${versionDoc.version}.json</div>
      </div>
      <div class="detail-header-actions">
        <button id="edit-version-button" class="ghost">编辑版本信息</button>
        <button id="delete-version-button" class="danger-ghost">删除版本</button>
        <button id="add-channel-button" class="primary ghost">新增渠道</button>
      </div>
    </div>
    ${channelBlocks}
  `;
}

function renderChannelBlock(channelName, entries) {
  const rows = entries.length
    ? entries
        .map((entry) => {
          const notes = Array.isArray(entry.release_note) ? entry.release_note.join(" / ") : "";
          return `
            <tr>
              <td>${entry.version}</td>
              <td>${entry.release_date}</td>
              <td>${entry.md5}</td>
              <td><a href="${entry.zip_url}" target="_blank" rel="noreferrer">查看链接</a></td>
              <td>${notes || "-"}</td>
              <td>
                <div class="entry-actions">
                  <button data-action="edit-entry" data-channel="${channelName}" data-version="${entry.version}">编辑</button>
                  <button data-action="copy-entry" data-channel="${channelName}" data-version="${entry.version}">复制</button>
                  <button data-action="delete-entry" data-channel="${channelName}" data-version="${entry.version}">删除</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="6">
          <div class="empty-state">当前渠道还没有版本条目，点击右上角“新增版本条目”。</div>
        </td>
      </tr>
    `;

  return `
    <section class="channel-block">
      <div class="channel-header">
        <div>
          <h3>${channelName}</h3>
          <div class="meta-line">${entries.length} 个条目</div>
        </div>
        <div class="channel-actions">
          <button class="danger-ghost" data-action="delete-channel" data-channel="${channelName}">删除渠道</button>
          <button class="primary ghost" data-action="new-entry" data-channel="${channelName}">新增版本条目</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>渠道版本</th>
            <th>发布日期</th>
            <th>MD5</th>
            <th>ZIP 地址</th>
            <th>更新说明</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderDetail() {
  elements.detailView.innerHTML = versionSummaryHtml();

  const editVersionButton = document.getElementById("edit-version-button");
  const deleteVersionButton = document.getElementById("delete-version-button");
  const addChannelButton = document.getElementById("add-channel-button");
  if (editVersionButton) {
    editVersionButton.addEventListener("click", () => {
      state.editor = { mode: "edit-version", channelName: "", entryVersion: "" };
      renderEditor();
    });
  }
  if (deleteVersionButton) {
    deleteVersionButton.addEventListener("click", openDeleteVersionDialog);
  }
  if (addChannelButton) {
    addChannelButton.addEventListener("click", () => {
      state.editor = { mode: "add-channel", channelName: "", entryVersion: "" };
      renderEditor();
    });
  }

  elements.detailView.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, channel, version } = button.dataset;
      if (action === "new-entry") {
        state.editor = { mode: "new-entry", channelName: channel, entryVersion: "" };
      } else if (action === "edit-entry") {
        state.editor = { mode: "edit-entry", channelName: channel, entryVersion: version };
      } else if (action === "copy-entry") {
        state.editor = { mode: "copy-entry", channelName: channel, entryVersion: version };
      } else if (action === "delete-entry") {
        deleteEntry(channel, version);
        return;
      } else if (action === "delete-channel") {
        openDeleteChannelDialog(channel);
        return;
      }
      renderEditor();
    });
  });
}

function renderEditor() {
  const mode = state.editor.mode;
  elements.editorBody.classList.remove("empty");

  if (!state.versionDoc || mode === "empty") {
    elements.editorTitle.textContent = "编辑区";
    elements.editorBody.classList.add("empty");
    elements.editorBody.textContent = "请选择一个版本或条目开始编辑";
    return;
  }

  if (mode === "edit-version") {
    elements.editorTitle.textContent = "编辑版本信息";
    elements.editorBody.innerHTML = `
      <div class="field-group">
        <label>OneSDK 版本号</label>
        <input value="${state.versionDoc.version}" disabled />
      </div>
      <div class="field-group">
        <label>发布日期</label>
        <input id="version-release-date" type="date" value="${state.versionDoc.release_date}" />
      </div>
      <div class="editor-actions">
        <button id="cancel-editor">取消</button>
        <button id="save-version-meta" class="primary">应用</button>
      </div>
    `;
    document.getElementById("cancel-editor").addEventListener("click", resetEditor);
    document.getElementById("save-version-meta").addEventListener("click", () => {
      state.versionDoc.release_date = document.getElementById("version-release-date").value;
      setDirty(true);
      resetEditor();
      renderDetail();
    });
    return;
  }

  if (mode === "add-channel") {
    elements.editorTitle.textContent = "新增渠道";
    elements.editorBody.innerHTML = `
      <div class="field-group">
        <label>渠道名称</label>
        <input id="channel-name-input" placeholder="例如 bilibili / lumo" />
      </div>
      <p id="editor-error" class="error-text hidden"></p>
      <div class="editor-actions">
        <button id="cancel-editor">取消</button>
        <button id="save-channel" class="primary">应用</button>
      </div>
    `;
    document.getElementById("cancel-editor").addEventListener("click", resetEditor);
    document.getElementById("save-channel").addEventListener("click", () => {
      const channelName = document.getElementById("channel-name-input").value.trim();
      const errorNode = document.getElementById("editor-error");
      if (!channelName) {
        errorNode.textContent = "渠道名称不能为空";
        errorNode.classList.remove("hidden");
        return;
      }
      if (state.versionDoc.channels[channelName]) {
        errorNode.textContent = "当前版本下已存在同名渠道";
        errorNode.classList.remove("hidden");
        return;
      }
      state.versionDoc.channels[channelName] = [];
      setDirty(true);
      resetEditor();
      renderDetail();
    });
    return;
  }

  const channelName = state.editor.channelName;
  const entries = state.versionDoc.channels[channelName] || [];
  const sourceEntry = entries.find((entry) => entry.version === state.editor.entryVersion);
  const initial = sourceEntry
    ? clone(sourceEntry)
    : {
        version: "",
        release_date: state.versionDoc.release_date || todayString(),
        zip_url: "",
        md5: "",
        release_note: []
      };
  if (mode === "copy-entry" && sourceEntry) {
    initial.version = "";
  }

  elements.editorTitle.textContent =
    mode === "new-entry" ? `新增 ${channelName} 条目` : `编辑 ${channelName} / ${state.editor.entryVersion || ""}`;
  elements.editorBody.innerHTML = `
    <div class="field-group">
      <label>渠道</label>
      <input value="${channelName}" disabled />
    </div>
    <div class="field-group">
      <label>渠道版本号</label>
      <input id="entry-version-input" value="${initial.version}" placeholder="例如 4.4.0" />
    </div>
    <div class="field-group">
      <label>发布日期</label>
      <input id="entry-date-input" type="date" value="${initial.release_date}" />
    </div>
    <div class="field-group">
      <label>ZIP 下载地址</label>
      <input id="entry-url-input" value="${initial.zip_url}" placeholder="https://..." />
    </div>
    <div class="field-group">
      <label>MD5</label>
      <input id="entry-md5-input" value="${initial.md5}" placeholder="32 位 md5" />
    </div>
    <div class="field-group">
      <label>更新说明</label>
      <textarea id="entry-note-input" placeholder="每行一条说明">${(initial.release_note || []).join("\n")}</textarea>
      <div class="hint-text">每行一条说明，保存时会写成 release_note 数组。</div>
    </div>
    <p id="editor-error" class="error-text hidden"></p>
    <div class="editor-actions">
      <button id="cancel-editor">取消</button>
      <button id="save-entry" class="primary">应用</button>
    </div>
  `;

  document.getElementById("cancel-editor").addEventListener("click", resetEditor);
  document.getElementById("save-entry").addEventListener("click", () => {
    const nextEntry = {
      version: document.getElementById("entry-version-input").value.trim(),
      release_date: document.getElementById("entry-date-input").value.trim(),
      zip_url: document.getElementById("entry-url-input").value.trim(),
      md5: document.getElementById("entry-md5-input").value.trim(),
      release_note: document
        .getElementById("entry-note-input")
        .value.split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    };
    const errorNode = document.getElementById("editor-error");
    if (!nextEntry.version || !nextEntry.release_date || !nextEntry.zip_url || !nextEntry.md5) {
      errorNode.textContent = "版本号、发布日期、ZIP 地址、MD5 都不能为空";
      errorNode.classList.remove("hidden");
      return;
    }

    const duplicated = entries.some(
      (entry) => entry.version === nextEntry.version && entry.version !== state.editor.entryVersion
    );
    if (duplicated) {
      errorNode.textContent = "当前渠道下已存在同名版本";
      errorNode.classList.remove("hidden");
      return;
    }

    const nextEntries = entries.filter((entry) => entry.version !== state.editor.entryVersion);
    nextEntries.push(nextEntry);
    nextEntries.sort((left, right) => semverCompare(left.version, right.version));
    state.versionDoc.channels[channelName] = nextEntries;
    setDirty(true);
    resetEditor();
    renderDetail();
  });
}

function resetEditor() {
  state.editor = { mode: "empty", channelName: "", entryVersion: "" };
  renderEditor();
}

function deleteEntry(channelName, entryVersion) {
  const confirmed = window.confirm(`确认删除 ${channelName} / ${entryVersion} ?`);
  if (!confirmed) return;
  state.versionDoc.channels[channelName] = (state.versionDoc.channels[channelName] || []).filter(
    (entry) => entry.version !== entryVersion
  );
  setDirty(true);
  renderDetail();
  if (state.editor.entryVersion === entryVersion && state.editor.channelName === channelName) {
    resetEditor();
  }
}

function openDeleteChannelDialog(channelName) {
  const entries = state.versionDoc?.channels?.[channelName] || [];
  elements.deleteChannelDialog.dataset.channel = channelName;
  elements.deleteChannelMessage.innerHTML = `
    即将删除渠道 <code>${escapeHtml(channelName)}</code>，以及该渠道下的 ${entries.length} 个版本条目。
  `;
  elements.deleteChannelDialog.showModal();
}

function confirmDeleteChannel() {
  const channelName = elements.deleteChannelDialog.dataset.channel || "";
  if (!channelName || !state.versionDoc?.channels?.[channelName]) {
    elements.deleteChannelDialog.close();
    return;
  }

  delete state.versionDoc.channels[channelName];
  setDirty(true);
  if (state.editor.channelName === channelName) {
    resetEditor();
  } else {
    renderEditor();
  }
  renderDetail();
  elements.deleteChannelDialog.close();
  showToast(`已删除渠道 ${channelName}，保存后生效`, "success");
}

function openDeleteVersionDialog() {
  if (!state.versionDoc || !state.selectedVersion) return;
  if (state.dirty) {
    showToast("当前版本有未保存修改，请先保存或刷新后再删除版本。", "error");
    return;
  }

  const channelCount = Object.keys(state.versionDoc.channels || {}).length;
  const entryCount = Object.values(state.versionDoc.channels || {}).reduce((count, items) => count + items.length, 0);
  elements.deleteVersionDialog.dataset.version = state.selectedVersion;
  elements.deleteVersionMessage.innerHTML = `
    即将删除 OneSDK <code>${escapeHtml(state.selectedVersion)}</code>，
    包含 ${channelCount} 个渠道、${entryCount} 个渠道版本条目。
  `;
  elements.deleteVersionDialog.showModal();
}

async function confirmDeleteVersion() {
  const version = elements.deleteVersionDialog.dataset.version || "";
  if (!version) {
    elements.deleteVersionDialog.close();
    return;
  }

  try {
    await apiFetch(`/api/version/${encodeURIComponent(version)}`, { method: "DELETE" });
    elements.deleteVersionDialog.close();
    state.selectedVersion = null;
    state.versionDoc = null;
    state.originalDoc = null;
    state.editor = { mode: "empty", channelName: "", entryVersion: "" };
    showToast(`已删除 OneSDK ${version}`, "success");
    await loadIndex();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function buildChangeSummary() {
  if (!state.originalDoc || !state.versionDoc) {
    return ["当前没有待保存修改"];
  }

  const changes = [];
  if (state.originalDoc.release_date !== state.versionDoc.release_date) {
    changes.push(`修改 OneSDK ${state.versionDoc.version} 的发布日期`);
  }

  const originalChannels = state.originalDoc.channels || {};
  const currentChannels = state.versionDoc.channels || {};

  for (const channelName of Object.keys(currentChannels)) {
    if (!Object.prototype.hasOwnProperty.call(originalChannels, channelName)) {
      changes.push(`新增渠道 ${channelName}`);
    }
  }

  for (const channelName of Object.keys(originalChannels)) {
    if (!Object.prototype.hasOwnProperty.call(currentChannels, channelName)) {
      changes.push(`删除渠道 ${channelName}`);
    }
  }

  for (const [channelName, entries] of Object.entries(currentChannels)) {
    const originalEntries = originalChannels[channelName] || [];
    const originalMap = new Map(originalEntries.map((entry) => [entry.version, entry]));
    const currentMap = new Map(entries.map((entry) => [entry.version, entry]));

    for (const entry of entries) {
      const original = originalMap.get(entry.version);
      if (!original) {
        changes.push(`新增 ${channelName} / ${entry.version}`);
      } else if (JSON.stringify(original) !== JSON.stringify(entry)) {
        changes.push(`修改 ${channelName} / ${entry.version}`);
      }
    }

    for (const entry of originalEntries) {
      if (!currentMap.has(entry.version)) {
        changes.push(`删除 ${channelName} / ${entry.version}`);
      }
    }
  }

  return changes.length ? changes : ["当前没有待保存修改"];
}

async function saveCurrentVersion() {
  if (!state.versionDoc || !state.selectedVersion) return;
  try {
    const payload = clone(state.versionDoc);
    await apiFetch(`/api/version/${encodeURIComponent(state.selectedVersion)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast(`已保存 ${state.selectedVersion}`, "success");
    await loadIndex(state.selectedVersion);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function createVersionFromDialog(event) {
  event.preventDefault();
  const version = elements.newVersionInput.value.trim();
  const releaseDate = elements.newVersionDateInput.value.trim();
  try {
    await apiFetch("/api/version", {
      method: "POST",
      body: JSON.stringify({ version, release_date: releaseDate })
    });
    elements.newVersionDialog.close();
    elements.newVersionForm.reset();
    elements.newVersionError.classList.add("hidden");
    showToast(`已创建 ${version}`, "success");
    await loadIndex(version);
  } catch (error) {
    elements.newVersionError.textContent = error.message;
    elements.newVersionError.classList.remove("hidden");
  }
}

function openNewVersionDialog() {
  elements.newVersionInput.value = "";
  elements.newVersionDateInput.value = todayString();
  elements.newVersionError.classList.add("hidden");
  elements.newVersionDialog.showModal();
}

async function openChangesDialog() {
  const changes = buildChangeSummary();
  try {
    const gitState = await loadGitState();
    const publishableFiles = Array.isArray(gitState.status.publishable_files) ? gitState.status.publishable_files : [];
    elements.changesSummary.innerHTML = renderChangesSummaryHtml(changes, publishableFiles, gitState.status);
  } catch (_) {
    elements.changesSummary.innerHTML = renderChangesSummaryHtml(changes, []);
  }
  elements.changesDialog.showModal();
}

async function loadGitState() {
  const [status, diff] = await Promise.all([apiFetch("/api/git/status"), apiFetch("/api/git/diff")]);
  return { status, diff };
}

async function loadOssStatus() {
  return apiFetch("/api/oss/status");
}

function renderOssSyncStatus(payload) {
  if (!payload) {
    elements.ossSyncStatus.innerHTML = '<div class="changes-summary-card"><h5>等待同步</h5><p>提交 commit 成功后会自动同步 metadata 到阿里云 OSS。</p></div>';
    elements.ossSyncButton.disabled = true;
    return;
  }

  if (payload.error) {
    elements.ossSyncStatus.innerHTML = `
      <div class="changes-summary-card error-card">
        <h5>OSS 同步失败</h5>
        <p>${escapeHtml(payload.error)}</p>
      </div>
    `;
    elements.ossSyncButton.disabled = false;
    return;
  }

  if (payload.syncing) {
    elements.ossSyncStatus.innerHTML = '<div class="changes-summary-card"><h5>OSS 同步中</h5><p>正在上传 metadata 文件到阿里云 OSS，请稍候。</p></div>';
    elements.ossSyncButton.disabled = true;
    return;
  }

  if (payload.configured === false) {
    elements.ossSyncStatus.innerHTML = `
      <div class="changes-summary-card">
        <h5>OSS 未配置</h5>
        <p>请在 Docker 环境变量中配置阿里云 OSS AK/SK 后再同步。</p>
        <p><code>${escapeHtml(payload.bucket || "-")}/${escapeHtml(payload.prefix || "-")}</code></p>
      </div>
    `;
    elements.ossSyncButton.disabled = true;
    return;
  }

  if (typeof payload.uploaded_count === "number") {
    elements.ossSyncStatus.innerHTML = `
      <div class="changes-summary-card">
        <h5>OSS 已同步</h5>
        <p>已上传 ${payload.uploaded_count} 个 metadata 文件到 <code>${escapeHtml(payload.bucket)}/${escapeHtml(payload.prefix)}</code>。</p>
        <p>读取入口：<code>${escapeHtml(payload.base_url)}/index.json</code></p>
      </div>
    `;
    elements.ossSyncButton.disabled = false;
    return;
  }

  elements.ossSyncStatus.innerHTML = `
    <div class="changes-summary-card">
      <h5>OSS 已配置</h5>
      <p>目标目录：<code>${escapeHtml(payload.bucket)}/${escapeHtml(payload.prefix)}</code></p>
      <p>提交 commit 成功后会自动同步，也可以在需要时手动重试。</p>
    </div>
  `;
  elements.ossSyncButton.disabled = false;
}

async function syncOssMetadata() {
  elements.ossSyncButton.disabled = true;
  renderOssSyncStatus({ syncing: true });
  try {
    const result = await apiFetch("/api/oss/sync", { method: "POST" });
    renderOssSyncStatus(result);
    showToast(`OSS 已同步 ${result.uploaded_count} 个文件`, "success");
    return result;
  } catch (error) {
    renderOssSyncStatus({ error: error.message });
    showToast(`OSS 同步失败：${error.message}`, "error");
    return null;
  }
}

function defaultCommitMessage() {
  return `chore: update onesdk metadata for ${state.selectedVersion}`;
}

function statusMeta(status) {
  if (status === "??") {
    return { label: "新文件", tone: "new" };
  }
  if (String(status).includes("M")) {
    return { label: "已修改", tone: "modified" };
  }
  if (String(status).includes("D")) {
    return { label: "已删除", tone: "deleted" };
  }
  if (String(status).includes("A")) {
    return { label: "已新增", tone: "new" };
  }
  return { label: "已变更", tone: "default" };
}

function renderFileList(items, emptyText, withStatus = true) {
  if (!items.length) {
    return `<p>${emptyText}</p>`;
  }
  return `
    <ul class="publish-file-list">
      ${items
        .map((item) => {
          const meta = statusMeta(item.status || "");
          return `
            <li>
              ${withStatus ? `<span class="status-pill ${meta.tone}">${meta.label}</span>` : ""}
              <code>${item.path}</code>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderCommitList(items, emptyText) {
  if (!items.length) {
    return `<p>${emptyText}</p>`;
  }
  return `
    <ul class="publish-file-list">
      ${items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}
    </ul>
  `;
}

function renderChangesSummaryHtml(changes, publishableFiles, status = {}) {
  const hasUnsavedChanges = changes.length && !(changes.length === 1 && changes[0] === "当前没有待保存修改");
  const aheadCount = Number(status.ahead_count || 0);
  const unpushedCommits = Array.isArray(status.unpushed_commits) ? status.unpushed_commits : [];
  const unsavedHtml = hasUnsavedChanges
    ? `<ul>${changes.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : `
      <div class="changes-summary-card">
        <h5>当前没有未保存修改</h5>
        <p>如果你刚刚新增了一个空版本，那一步在创建时已经直接写入工作区文件了，所以这里不会再显示“待保存修改”。接下来可以直接进入发布。</p>
      </div>
    `;

  const publishableHtml = publishableFiles.length
    ? `
      <div class="changes-summary-card">
        <h5>当前已有待发布文件</h5>
        <p>这些文件已经保存到工作区，可以直接进入发布。</p>
        ${renderFileList(publishableFiles, "当前没有待发布文件。")}
      </div>
    `
    : `
      <div class="changes-summary-card">
        <h5>当前没有待发布文件</h5>
        <p>如果你还没有保存编辑内容，先完成保存；如果已经保存但这里仍为空，说明当前 metadata 工作区没有新的改动。</p>
      </div>
    `;

  const unpushedHtml = aheadCount
    ? `
      <div class="changes-summary-card">
        <h5>当前有待推送 commit</h5>
        <p>本地分支领先远端 ${aheadCount} 个 commit，可以进入发布后直接执行 push。</p>
        ${renderCommitList(unpushedCommits, "当前没有可展示的 commit 摘要。")}
      </div>
    `
    : "";

  return `${unsavedHtml}${publishableHtml}${unpushedHtml}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderDiffContent(rawDiff) {
  const lines = String(rawDiff || "").split("\n");
  const visibleLines = lines.filter(
    (line) =>
      !line.startsWith("diff --git ") &&
      !line.startsWith("index ") &&
      !line.startsWith("--- ") &&
      !line.startsWith("+++ ") &&
      !line.startsWith("new file mode ") &&
      !line.startsWith("deleted file mode ")
  );

  if (!visibleLines.some((line) => line.length > 0)) {
    return '<div class="git-diff empty">当前文件没有可展示的源码变更</div>';
  }

  const lineHtml = visibleLines
    .map((line) => {
      let kind = "context";
      let sign = " ";
      let content = line;

      if (line.startsWith("@@")) {
        kind = "hunk";
        sign = "@@";
      } else if (line.startsWith("+")) {
        kind = "add";
        sign = "+";
        content = line.slice(1);
      } else if (line.startsWith("-")) {
        kind = "delete";
        sign = "-";
        content = line.slice(1);
      } else if (line.startsWith(" ")) {
        content = line.slice(1);
      }

      const emptyClass = content.length === 0 ? " empty-line" : "";
      return `
        <div class="diff-line ${kind}${emptyClass}">
          <div class="diff-sign">${escapeHtml(sign)}</div>
          <div class="diff-content">${escapeHtml(content)}</div>
        </div>
      `;
    })
    .join("");

  return `<div class="diff-lines">${lineHtml}</div>`;
}

function renderDiffBrowser(files) {
  if (!files.length) {
    elements.publishDiffFiles.innerHTML = "";
    elements.publishGitDiff.innerHTML = "当前没有可展示的 diff";
    elements.publishGitDiff.classList.add("empty");
    return;
  }

  elements.publishGitDiff.classList.remove("empty");
  let activeIndex = 0;

  const renderActive = () => {
    elements.publishDiffFiles.innerHTML = files
      .map((file, index) => {
        const meta = statusMeta(file.status || "");
        return `
          <button class="diff-file-button ${index === activeIndex ? "active" : ""}" data-index="${index}">
            <span class="status-pill ${meta.tone}">${meta.label}</span>
            <span class="diff-file-path">${file.path}</span>
          </button>
        `;
      })
      .join("");

    const activeFile = files[activeIndex];
    elements.publishGitDiff.innerHTML = renderDiffContent(activeFile?.diff || "");

    elements.publishDiffFiles.querySelectorAll("[data-index]").forEach((button) => {
      button.addEventListener("click", () => {
        activeIndex = Number(button.dataset.index || 0);
        renderActive();
      });
    });
  };

  renderActive();
}

function renderPublishGitStatus(status) {
  const publishableFiles = Array.isArray(status.publishable_files) ? status.publishable_files : [];
  const unpushedCommits = Array.isArray(status.unpushed_commits) ? status.unpushed_commits : [];
  const branch = status.branch || "-";
  const upstream = status.upstream || "未设置";
  const aheadCount = Number(status.ahead_count || 0);
  const behindCount = Number(status.behind_count || 0);
  const clean = Boolean(status.clean);
  const blockedCount = Array.isArray(status.blocked_files) ? status.blocked_files.length : 0;
  const hasUnpushedCommits = aheadCount > 0;

  return `
    <div class="git-explainer">
      <strong>这一步在做什么</strong>
      <div>发布分两步：先把 metadata 改动提交成本地 commit，再把本地领先远端的 commit 推送出去。</div>
      ${
        blockedCount
          ? `<div>当前工作区里还有 ${blockedCount} 个其它改动，它们会保留在本地，不会进入这次 commit。</div>`
          : `<div>当前工作区没有额外噪音改动，这次发布会聚焦在 metadata 文件本身。</div>`
      }
      ${
        hasUnpushedCommits
          ? `<div>当前本地分支已经领先远端 ${aheadCount} 个 commit，即使没有新的文件 diff，也可以继续执行 push。</div>`
          : `<div>当前没有检测到待推送的本地 commit。</div>`
      }
    </div>
    <div class="git-status-grid">
      <div class="git-status-card">
        <div class="git-status-label">当前分支</div>
        <div class="git-status-value text">${branch}</div>
      </div>
      <div class="git-status-card">
        <div class="git-status-label">远端跟踪</div>
        <div class="git-status-value text">${upstream}</div>
      </div>
      <div class="git-status-card">
        <div class="git-status-label">工作区状态</div>
        <div class="git-status-value text">${clean ? "干净" : "存在改动"}</div>
      </div>
      <div class="git-status-card">
        <div class="git-status-label">本次会提交</div>
        <div class="git-status-value">${publishableFiles.length}</div>
      </div>
      <div class="git-status-card">
        <div class="git-status-label">本地领先远端</div>
        <div class="git-status-value">${aheadCount}</div>
      </div>
      <div class="git-status-card">
        <div class="git-status-label">远端领先本地</div>
        <div class="git-status-value">${behindCount}</div>
      </div>
    </div>
    <div class="publish-file-group">
      <div class="publish-file-card allowed">
        <h5>本次会提交的文件</h5>
        <p>这些文件会被 <code>git add</code> 并进入这次 metadata 发布 commit。</p>
        ${renderFileList(publishableFiles, "当前没有可提交的 metadata 文件。")}
      </div>
      <div class="publish-file-card allowed">
        <h5>待推送的本地 commit</h5>
        <p>如果上次 commit 成功但 push 失败，这里会显示还没到远端的 commit。</p>
        ${renderCommitList(unpushedCommits, "当前没有待推送的本地 commit。")}
      </div>
    </div>
  `;
}

function updatePublishButtons(status) {
  const publishableFiles = Array.isArray(status.publishable_files) ? status.publishable_files : [];
  const hasPublishableFiles = publishableFiles.length > 0;
  const hasUnpushedCommits = Number(status.ahead_count || 0) > 0;
  elements.commitButton.disabled = !hasPublishableFiles;
  elements.pushButton.disabled = hasPublishableFiles || !hasUnpushedCommits;
  elements.pushButton.textContent = "推送";
  elements.pushButton.title = hasPublishableFiles
    ? "请先提交当前 metadata 改动，再执行推送"
    : hasUnpushedCommits
      ? "推送本地领先远端的 commit"
      : "当前没有待推送的 commit";
}

async function openPublishDialog() {
  if (state.dirty) {
    showToast("请先保存当前修改，再进入发布。", "error");
    return;
  }
  try {
    renderFlow(4);
    elements.publishError.classList.add("hidden");
    const changes = buildChangeSummary();
    const [gitState, ossStatus] = await Promise.all([loadGitState(), loadOssStatus().catch((error) => ({ error: error.message }))]);
    elements.publishChangesSummary.innerHTML = `<ul>${changes.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    elements.publishGitStatus.innerHTML = renderPublishGitStatus(gitState.status);
    renderOssSyncStatus(ossStatus);
    updatePublishButtons(gitState.status);
    renderDiffBrowser(Array.isArray(gitState.diff.files) ? gitState.diff.files : []);
    if (!elements.commitMessageInput.value.trim()) {
      elements.commitMessageInput.value = defaultCommitMessage();
    }
    elements.publishDialog.showModal();
  } catch (error) {
    renderFlow(3);
    showToast(error.message, "error");
  }
}

async function runCommit() {
  const message = elements.commitMessageInput.value.trim();
  try {
    elements.publishError.classList.add("hidden");
    elements.commitButton.disabled = true;
    const result = await apiFetch("/api/git/commit", {
      method: "POST",
      body: JSON.stringify({ message })
    });
    renderFlow(5);
    showToast(`已创建 commit ${result.commit}`, "success");
    const gitState = await loadGitState();
    updatePublishButtons(gitState.status);
    elements.publishGitStatus.innerHTML = `
      <div class="git-explainer">
        <strong>Commit 已完成</strong>
        <div>当前 metadata 改动已经写入本地 git 提交。下一步如果你确认没问题，就可以继续执行 push；如果 push 失败，重新打开发布窗口也会保留待推送状态。</div>
      </div>
      <div class="git-status-grid">
        <div class="git-status-card">
          <div class="git-status-label">当前分支</div>
          <div class="git-status-value text">${gitState.status.branch}</div>
        </div>
        <div class="git-status-card">
          <div class="git-status-label">最新 commit</div>
          <div class="git-status-value text">${result.commit}</div>
        </div>
        <div class="git-status-card">
          <div class="git-status-label">工作区状态</div>
          <div class="git-status-value text">${gitState.status.clean ? "干净" : "仍有改动"}</div>
        </div>
        <div class="git-status-card">
          <div class="git-status-label">提交文件数</div>
          <div class="git-status-value">${(result.published_files || []).length}</div>
        </div>
        <div class="git-status-card">
          <div class="git-status-label">本地领先远端</div>
          <div class="git-status-value">${gitState.status.ahead_count || 0}</div>
        </div>
      </div>
      <div class="publish-file-card allowed">
        <h5>刚刚提交的文件</h5>
        ${renderFileList(
          (result.published_files || []).map((path) => ({ status: "M", path })),
          "这次没有提交任何 metadata 文件。"
        )}
      </div>
      <div class="publish-file-card allowed">
        <h5>待推送的本地 commit</h5>
        ${renderCommitList(gitState.status.unpushed_commits || [], "当前没有待推送的本地 commit。")}
      </div>
    `;
    renderDiffBrowser(Array.isArray(gitState.diff.files) ? gitState.diff.files : []);
    await syncOssMetadata();
    return true;
  } catch (error) {
    elements.publishError.textContent = `提交失败：${error.message}`;
    elements.publishError.classList.remove("hidden");
    const gitState = await loadGitState().catch(() => null);
    if (gitState) {
      elements.publishGitStatus.innerHTML = renderPublishGitStatus(gitState.status);
      updatePublishButtons(gitState.status);
      renderDiffBrowser(Array.isArray(gitState.diff.files) ? gitState.diff.files : []);
    }
    showToast(error.message, "error");
    return false;
  }
}

async function runPush() {
  try {
    elements.publishError.classList.add("hidden");
    elements.pushButton.disabled = true;
    const gitState = await loadGitState();
    const publishableFiles = Array.isArray(gitState.status.publishable_files) ? gitState.status.publishable_files : [];
    const hasPublishableFiles = publishableFiles.length > 0;
    const hasUnpushedCommits = Number(gitState.status.ahead_count || 0) > 0;

    if (hasPublishableFiles) {
      throw new Error("当前还有未提交的 metadata 改动，请先点击“提交 commit”。");
    }
    if (!hasUnpushedCommits) {
      throw new Error("当前没有待推送的本地 commit");
    }

    const result = await apiFetch("/api/git/push", { method: "POST" });
    renderFlow(5);
    showToast(`已推送到 origin/${result.branch}`, "success");
    elements.publishDialog.close();
    await loadIndex(state.selectedVersion);
  } catch (error) {
    elements.publishError.textContent = `推送失败：${error.message}`;
    elements.publishError.classList.remove("hidden");
    const gitState = await loadGitState().catch(() => null);
    if (gitState) {
      elements.publishGitStatus.innerHTML = renderPublishGitStatus(gitState.status);
      updatePublishButtons(gitState.status);
      renderDiffBrowser(Array.isArray(gitState.diff.files) ? gitState.diff.files : []);
    }
    showToast(error.message, "error");
  }
}

async function discardMappingsChanges() {
  try {
    await apiFetch("/api/git/discard-mappings", { method: "POST" });
    elements.discardConfirmDialog.close();
    elements.publishDialog.close();
    renderFlow(1);
    showToast("已丢弃 mappings 目录下的变更", "success");
    await loadIndex();
  } catch (error) {
    elements.publishError.textContent = `丢弃失败：${error.message}`;
    elements.publishError.classList.remove("hidden");
    showToast(error.message, "error");
  }
}

function bindGlobalEvents() {
  elements.refreshButton.addEventListener("click", async () => {
    if (state.dirty) {
      const confirmed = window.confirm("当前有未保存修改，确定刷新吗？");
      if (!confirmed) return;
    }
    await loadIndex(state.selectedVersion);
  });
  elements.saveButton.addEventListener("click", saveCurrentVersion);
  elements.publishButton.addEventListener("click", openPublishDialog);
  elements.newVersionButton.addEventListener("click", openNewVersionDialog);
  elements.showChangesButton.addEventListener("click", openChangesDialog);
  elements.newVersionForm.addEventListener("submit", createVersionFromDialog);
  elements.newVersionCancel.addEventListener("click", () => elements.newVersionDialog.close());
  elements.changesClose.addEventListener("click", () => elements.changesDialog.close());
  elements.deleteChannelCancel.addEventListener("click", () => elements.deleteChannelDialog.close());
  elements.deleteChannelSubmit.addEventListener("click", confirmDeleteChannel);
  elements.deleteVersionCancel.addEventListener("click", () => elements.deleteVersionDialog.close());
  elements.deleteVersionSubmit.addEventListener("click", confirmDeleteVersion);
  elements.publishClose.addEventListener("click", () => {
    elements.publishDialog.close();
    renderFlow(state.selectedVersion ? 3 : 1);
  });
  elements.discardMappingsButton.addEventListener("click", () => {
    elements.discardConfirmDialog.showModal();
  });
  elements.discardConfirmCancel.addEventListener("click", () => {
    elements.discardConfirmDialog.close();
  });
  elements.discardConfirmSubmit.addEventListener("click", discardMappingsChanges);
  elements.ossSyncButton.addEventListener("click", syncOssMetadata);
  elements.commitButton.addEventListener("click", runCommit);
  elements.pushButton.addEventListener("click", runPush);

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function bootstrap() {
  bindGlobalEvents();
  try {
    await apiFetch("/api/health");
    await loadIndex();
  } catch (error) {
    renderStatus(`加载失败：${error.message}`);
    elements.detailView.innerHTML = `
      <div class="empty-state">
        无法读取 metadata 仓库。<br />
        请确认本地服务已启动，然后点击“刷新”重试。
      </div>
    `;
    renderEditor();
  }
}

bootstrap();
