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
  renderStatus(flag ? "当前存在未保存修改" : "已加载 metadata");
}

function renderStatus(text) {
  elements.statusText.textContent = text;
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
        <button class="primary ghost" data-action="new-entry" data-channel="${channelName}">新增版本条目</button>
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
  const addChannelButton = document.getElementById("add-channel-button");
  if (editVersionButton) {
    editVersionButton.addEventListener("click", () => {
      state.editor = { mode: "edit-version", channelName: "", entryVersion: "" };
      renderEditor();
    });
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

function openChangesDialog() {
  const changes = buildChangeSummary();
  elements.changesSummary.innerHTML = `<ul>${changes.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  elements.changesDialog.showModal();
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
  elements.newVersionButton.addEventListener("click", openNewVersionDialog);
  elements.showChangesButton.addEventListener("click", openChangesDialog);
  elements.newVersionForm.addEventListener("submit", createVersionFromDialog);
  elements.newVersionCancel.addEventListener("click", () => elements.newVersionDialog.close());
  elements.changesClose.addEventListener("click", () => elements.changesDialog.close());

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
