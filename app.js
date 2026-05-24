(function () {
  const REVIEW_DIR_NAME = ".local-markdown-reviewer";
  const USER_ID_KEY = "local-markdown-reviewer-user-id";
  const AUTHOR_KEY = "local-markdown-reviewer-author";
  const DB_NAME = "local-markdown-reviewer";
  const DB_STORE_NAME = "handles";
  const LAST_FOLDER_KEY = "last-folder";
  const THEME_KEY = "local-markdown-reviewer-theme";
  const SHOW_BLANK_LINES_KEY = "local-markdown-reviewer-show-blank-lines";
  const HIDE_LINE_NUMBERS_KEY = "local-markdown-reviewer-hide-line-numbers";
  const HIDE_COMMENTS_KEY = "local-markdown-reviewer-hide-comments";
  const PREVIEW_FONT_SIZE_KEY = "local-markdown-reviewer-preview-font-size";
  const COMMENT_FONT_SIZE_KEY = "local-markdown-reviewer-comment-font-size";
  const ANCHOR_CONTEXT_CHARS = 48;
  const MERMAID_SCRIPT = "mermaid.min.js";
  const MARKDOWN_IT_SCRIPT = "markdown-it.min.js";

  const state = {
    dirHandle: null,
    files: [],
    currentFile: null,
    currentText: "",
    originalEditText: "",
    currentBranch: "",
    comments: [],
    events: [],
    userId: getUserId(),
    selectedQuote: "",
    selectedTarget: null,
    imageObjectUrls: [],
    dirty: false
  };

  let mermaidLoadPromise = null;
  let markdownItLoadPromise = null;
  let markdownRenderer = null;

  const els = {
    repoStatus: document.getElementById("repoStatus"),
    openFolderButton: document.getElementById("openFolderButton"),
    reopenFolderButton: document.getElementById("reopenFolderButton"),
    saveButton: document.getElementById("saveButton"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    showBlankLinesInput: document.getElementById("showBlankLinesInput"),
    hideLineNumbersInput: document.getElementById("hideLineNumbersInput"),
    hideCommentsInput: document.getElementById("hideCommentsInput"),
    previewFontSizeSelect: document.getElementById("previewFontSizeSelect"),
    commentFontSizeSelect: document.getElementById("commentFontSizeSelect"),
    downloadButton: document.getElementById("downloadButton"),
    downloadCsvButton: document.getElementById("downloadCsvButton"),
    importInput: document.getElementById("importInput"),
    fileCount: document.getElementById("fileCount"),
    fileList: document.getElementById("fileList"),
    currentFileName: document.getElementById("currentFileName"),
    currentFileMeta: document.getElementById("currentFileMeta"),
    markdownPreview: document.getElementById("markdownPreview"),
    markdownEditor: document.getElementById("markdownEditor"),
    editMarkdownButton: document.getElementById("editMarkdownButton"),
    saveMarkdownButton: document.getElementById("saveMarkdownButton"),
    cancelMarkdownEditButton: document.getElementById("cancelMarkdownEditButton"),
    addCommentButton: document.getElementById("addCommentButton"),
    commentFilter: document.getElementById("commentFilter"),
    tocPanel: document.getElementById("tocPanel"),
    tocList: document.getElementById("tocList"),
    commentList: document.getElementById("commentList"),
    commentDialog: document.getElementById("commentDialog"),
    authorInput: document.getElementById("authorInput"),
    quoteInput: document.getElementById("quoteInput"),
    bodyInput: document.getElementById("bodyInput"),
    submitCommentButton: document.getElementById("submitCommentButton")
  };

  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  applyBlankLineSetting(localStorage.getItem(SHOW_BLANK_LINES_KEY) === "true");
  applyLineNumberSetting(localStorage.getItem(HIDE_LINE_NUMBERS_KEY) === "true");
  applyCommentVisibility(localStorage.getItem(HIDE_COMMENTS_KEY) === "true");
  applyPreviewFontSize(localStorage.getItem(PREVIEW_FONT_SIZE_KEY) || "normal");
  applyCommentFontSize(localStorage.getItem(COMMENT_FONT_SIZE_KEY) || "normal");
  els.openFolderButton.addEventListener("click", openFolder);
  els.reopenFolderButton.addEventListener("click", reopenLastFolder);
  els.saveButton.addEventListener("click", persistComments);
  els.themeToggleButton.addEventListener("click", toggleTheme);
  els.showBlankLinesInput.addEventListener("change", () => {
    localStorage.setItem(SHOW_BLANK_LINES_KEY, String(els.showBlankLinesInput.checked));
    applyBlankLineSetting(els.showBlankLinesInput.checked);
  });
  els.hideLineNumbersInput.addEventListener("change", () => {
    localStorage.setItem(HIDE_LINE_NUMBERS_KEY, String(els.hideLineNumbersInput.checked));
    applyLineNumberSetting(els.hideLineNumbersInput.checked);
  });
  els.hideCommentsInput.addEventListener("change", () => {
    localStorage.setItem(HIDE_COMMENTS_KEY, String(els.hideCommentsInput.checked));
    applyCommentVisibility(els.hideCommentsInput.checked);
  });
  els.previewFontSizeSelect.addEventListener("change", () => {
    localStorage.setItem(PREVIEW_FONT_SIZE_KEY, els.previewFontSizeSelect.value);
    applyPreviewFontSize(els.previewFontSizeSelect.value);
  });
  els.commentFontSizeSelect.addEventListener("change", () => {
    localStorage.setItem(COMMENT_FONT_SIZE_KEY, els.commentFontSizeSelect.value);
    applyCommentFontSize(els.commentFontSizeSelect.value);
  });
  els.downloadButton.addEventListener("click", downloadComments);
  els.downloadCsvButton.addEventListener("click", downloadCommentsCsv);
  els.importInput.addEventListener("change", importComments);
  els.editMarkdownButton.addEventListener("click", startMarkdownEdit);
  els.saveMarkdownButton.addEventListener("click", saveMarkdownEdit);
  els.cancelMarkdownEditButton.addEventListener("click", cancelMarkdownEdit);
  els.addCommentButton.addEventListener("click", openCommentDialog);
  els.commentFilter.addEventListener("change", () => {
    renderPreviewAnnotations();
    renderComments();
  });
  els.commentDialog.addEventListener("close", handleDialogClose);
  els.markdownPreview.addEventListener("mouseup", captureSelection);
  els.markdownPreview.addEventListener("keyup", captureSelection);
  els.markdownPreview.addEventListener("click", handlePreviewClick);

  if (!("showDirectoryPicker" in window)) {
    els.repoStatus.textContent = "フォルダ直接保存は非対応です。JSONの読み書きを使ってください。";
    els.openFolderButton.disabled = true;
    els.reopenFolderButton.disabled = true;
  } else {
    initLastFolderButton();
  }

  function setDirty(value) {
    state.dirty = value;
    els.saveButton.disabled = !state.dirHandle || !value;
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  function applyTheme(theme) {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalizedTheme;
    els.themeToggleButton.textContent = normalizedTheme === "dark" ? "ライト" : "ダーク";
  }

  function applyBlankLineSetting(showBlankLines) {
    document.documentElement.dataset.showBlankLines = showBlankLines ? "true" : "false";
    els.showBlankLinesInput.checked = showBlankLines;
  }

  function applyLineNumberSetting(hideLineNumbers) {
    document.documentElement.dataset.hideLineNumbers = hideLineNumbers ? "true" : "false";
    els.hideLineNumbersInput.checked = hideLineNumbers;
  }

  function applyCommentVisibility(hideComments) {
    document.documentElement.dataset.hideComments = hideComments ? "true" : "false";
    els.hideCommentsInput.checked = hideComments;
  }

  function applyPreviewFontSize(size) {
    const normalizedSize = ["small", "normal", "large", "xlarge"].includes(size) ? size : "normal";
    document.documentElement.dataset.previewFontSize = normalizedSize;
    els.previewFontSizeSelect.value = normalizedSize;
  }

  function applyCommentFontSize(size) {
    const normalizedSize = ["small", "normal", "large", "xlarge"].includes(size) ? size : "normal";
    document.documentElement.dataset.commentFontSize = normalizedSize;
    els.commentFontSizeSelect.value = normalizedSize;
  }

  async function openFolder() {
    const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await storeLastFolderHandle(dirHandle);
    await loadFolder(dirHandle);
  }

  async function reopenLastFolder() {
    const dirHandle = await getStoredHandle(LAST_FOLDER_KEY);
    if (!dirHandle) {
      els.reopenFolderButton.disabled = true;
      return;
    }
    els.reopenFolderButton.disabled = true;
    const permission = await ensureHandlePermission(dirHandle);
    if (!permission) {
      els.repoStatus.textContent = "前回のフォルダを開く権限がありません。フォルダを開くから選択してください。";
      els.reopenFolderButton.disabled = false;
      return;
    }
    try {
      await loadFolder(dirHandle);
    } finally {
      els.reopenFolderButton.disabled = false;
    }
  }

  async function loadFolder(dirHandle) {
    state.dirHandle = dirHandle;
    state.currentBranch = await readGitBranch(state.dirHandle);
    updateRepoStatus();
    state.files = [];
    await collectMarkdownFiles(state.dirHandle, "");
    state.files.sort((a, b) => a.path.localeCompare(b.path));
    await loadComments();
    renderFiles();
    renderComments();
    if (state.files.length > 0) {
      await selectFile(state.files[0].path);
    }
  }

  async function initLastFolderButton() {
    const dirHandle = await getStoredHandle(LAST_FOLDER_KEY);
    els.reopenFolderButton.disabled = !dirHandle;
  }

  async function storeLastFolderHandle(dirHandle) {
    await setStoredHandle(LAST_FOLDER_KEY, dirHandle);
    els.reopenFolderButton.disabled = false;
  }

  async function ensureHandlePermission(dirHandle) {
    const options = { mode: "readwrite" };
    if ((await dirHandle.queryPermission(options)) === "granted") {
      return true;
    }
    return (await dirHandle.requestPermission(options)) === "granted";
  }

  async function openHandleDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DB_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getStoredHandle(key) {
    if (!("indexedDB" in window)) {
      return null;
    }
    try {
      const db = await openHandleDb();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE_NAME, "readonly");
        const store = transaction.objectStore(DB_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      return null;
    }
  }

  async function setStoredHandle(key, value) {
    if (!("indexedDB" in window)) {
      return;
    }
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE_NAME, "readwrite");
      const store = transaction.objectStore(DB_STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  async function collectMarkdownFiles(dirHandle, prefix) {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name === ".git" || name === REVIEW_DIR_NAME || name === "node_modules") {
        continue;
      }
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        await collectMarkdownFiles(handle, path);
      } else if (/\.(md|markdown|mdown)$/i.test(name)) {
        state.files.push({ path, handle });
      }
    }
  }

  async function readGitBranch(dirHandle) {
    try {
      const gitHandle = await dirHandle.getDirectoryHandle(".git");
      const headHandle = await gitHandle.getFileHandle("HEAD");
      const head = (await (await headHandle.getFile()).text()).trim();
      if (head.startsWith("ref: refs/heads/")) {
        return head.slice("ref: refs/heads/".length);
      }
      if (head) {
        return `detached ${head.slice(0, 7)}`;
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function updateRepoStatus(extra = "") {
    if (!state.dirHandle) {
      els.repoStatus.textContent = "フォルダ未選択";
      return;
    }
    const parts = [state.dirHandle.name];
    if (state.currentBranch) {
      parts.push(`branch: ${state.currentBranch}`);
    }
    if (extra) {
      parts.push(extra);
    }
    els.repoStatus.textContent = parts.join(" / ");
  }

  async function loadComments() {
    const dataFiles = await readCommentFiles(REVIEW_DIR_NAME);
    if (dataFiles.length > 0) {
      state.events = normalizeCommentFiles(dataFiles);
      state.comments = buildComments(state.events);
      setDirty(false);
      return;
    }

    state.comments = [];
    state.events = [];
    setDirty(false);
  }

  async function readCommentFiles(dirName) {
    try {
      const reviewDir = await state.dirHandle.getDirectoryHandle(dirName);
      const files = [];
      for await (const [name, handle] of reviewDir.entries()) {
        if (handle.kind !== "file" || !/\.json$/i.test(name)) {
          continue;
        }
        try {
          const file = await handle.getFile();
          files.push({
            name,
            data: JSON.parse(await file.text())
          });
        } catch (error) {
          // 壊れたJSONが1つあっても、他のユーザのコメントは読み続けます。
        }
      }
      return files;
    } catch (error) {
      return [];
    }
  }

  async function saveComments() {
    if (!state.dirHandle) {
      return;
    }
    const reviewDir = await state.dirHandle.getDirectoryHandle(REVIEW_DIR_NAME, { create: true });
    const fileHandle = await reviewDir.getFileHandle(getUserCommentFileName(), { create: true });
    const writable = await fileHandle.createWritable();
    const ownEvents = state.events.filter((event) => event.userId === state.userId);
    await writable.write(JSON.stringify({
      version: 3,
      userId: state.userId,
      author: getCurrentAuthor(),
      events: ownEvents
    }, null, 2));
    await writable.close();
    setDirty(false);
    if (state.dirHandle) {
      updateRepoStatus("自動保存済み");
    }
  }

  async function persistComments() {
    setDirty(true);
    try {
      await saveComments();
    } catch (error) {
      els.repoStatus.textContent = "コメントの自動保存に失敗しました。保存ボタンかJSONダウンロードを試してください。";
    }
  }

  function normalizeCommentFiles(files) {
    const events = [];
    for (const file of files) {
      const data = file.data || {};
      if (Array.isArray(data.events)) {
        for (const event of data.events) {
          events.push({
            ...event,
            userId: event.userId || data.userId || getUserIdFromFileName(file.name) || state.userId
          });
        }
      } else if (Array.isArray(data.comments)) {
        events.push(...commentsToEvents(data.comments, data.userId || state.userId));
      }
    }
    return dedupeEvents(events);
  }

  function commentsToEvents(comments, userId) {
    const events = [];
    for (const comment of comments) {
      const createdAt = comment.createdAt || new Date().toISOString();
      const replies = Array.isArray(comment.replies) ? comment.replies : [];
      const commentCopy = {
        ...comment,
        replies: []
      };
      events.push({
        id: `migrate-comment-${comment.id}`,
        type: "comment:create",
        userId,
        author: comment.author || "reviewer",
        createdAt,
        comment: commentCopy
      });
      for (const reply of replies) {
        events.push({
          id: `migrate-reply-${comment.id}-${reply.id}`,
          type: "reply:create",
          userId,
          author: reply.author || "reviewer",
          createdAt: reply.createdAt || createdAt,
          commentId: comment.id,
          reply
        });
      }
    }
    return events;
  }

  function buildComments(events) {
    const comments = new Map();
    const sortedEvents = dedupeEvents(events).sort((a, b) => {
      const dateDiff = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      return dateDiff === 0 ? String(a.id).localeCompare(String(b.id)) : dateDiff;
    });

    for (const event of sortedEvents) {
      if (event.type === "comment:create" && event.comment && event.comment.id) {
        if (!comments.has(event.comment.id)) {
          comments.set(event.comment.id, {
            ...event.comment,
            status: event.comment.status || "open",
            replies: Array.isArray(event.comment.replies) ? event.comment.replies.slice() : []
          });
        }
      }
    }

    for (const event of sortedEvents) {
      if (event.type === "comment:status" && comments.has(event.commentId)) {
        const comment = comments.get(event.commentId);
        comment.status = event.status;
        comment.updatedAt = event.createdAt || comment.updatedAt;
      }

      if (event.type === "reply:create" && comments.has(event.commentId) && event.reply) {
        const comment = comments.get(event.commentId);
        if (!comment.replies.some((reply) => reply.id === event.reply.id)) {
          comment.replies.push(event.reply);
          comment.updatedAt = event.createdAt || comment.updatedAt;
        }
      }
    }

    return Array.from(comments.values());
  }

  function dedupeEvents(events) {
    const seen = new Set();
    const unique = [];
    for (const event of events) {
      if (!event || !event.id || seen.has(event.id)) {
        continue;
      }
      seen.add(event.id);
      unique.push(event);
    }
    return unique;
  }

  function addEvent(event) {
    state.events.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      userId: state.userId,
      author: getCurrentAuthor(),
      createdAt: new Date().toISOString(),
      ...event
    });
    state.events = dedupeEvents(state.events);
    state.comments = buildComments(state.events);
  }

  function getUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  }

  function getUserCommentFileName() {
    return `user-${state.userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  }

  function getUserIdFromFileName(fileName) {
    const match = fileName.match(/^user-(.+)\.json$/);
    return match ? match[1] : null;
  }

  function getCurrentAuthor() {
    return localStorage.getItem(AUTHOR_KEY) || "reviewer";
  }

  function renderFiles() {
    els.fileCount.textContent = String(state.files.length);
    els.fileList.innerHTML = "";
    if (state.files.length === 0) {
      els.fileList.innerHTML = '<p class="empty">Markdown ファイルが見つかりません。</p>';
      return;
    }
    for (const file of state.files) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-item";
      button.textContent = file.path;
      button.addEventListener("click", () => selectFile(file.path));
      if (state.currentFile && state.currentFile.path === file.path) {
        button.classList.add("active");
      }
      els.fileList.appendChild(button);
    }
  }

  async function selectFile(path) {
    const file = state.files.find((item) => item.path === path);
    if (!file) {
      return;
    }
    state.currentFile = file;
    const blob = await file.handle.getFile();
    state.currentText = await blob.text();
    els.currentFileName.textContent = file.path;
    els.currentFileMeta.textContent = `${state.currentText.length.toLocaleString()} 文字`;
    state.selectedQuote = "";
    state.selectedTarget = null;
    renderPreview();
    els.addCommentButton.disabled = false;
    els.editMarkdownButton.disabled = false;
    setMarkdownEditMode(false);
    renderFiles();
    renderComments();
  }

  function startMarkdownEdit() {
    if (!state.currentFile) {
      return;
    }
    state.originalEditText = state.currentText;
    els.markdownEditor.value = state.currentText;
    setMarkdownEditMode(true);
    els.markdownEditor.focus();
  }

  async function saveMarkdownEdit() {
    if (!state.currentFile) {
      return;
    }
    const nextText = els.markdownEditor.value;
    const writable = await state.currentFile.handle.createWritable();
    await writable.write(nextText);
    await writable.close();
    state.currentText = nextText;
    els.currentFileMeta.textContent = `${state.currentText.length.toLocaleString()} 文字`;
    setMarkdownEditMode(false);
    renderPreview();
    renderComments();
  }

  function cancelMarkdownEdit() {
    els.markdownEditor.value = state.originalEditText;
    setMarkdownEditMode(false);
  }

  function setMarkdownEditMode(editing) {
    els.markdownPreview.hidden = editing;
    els.markdownEditor.hidden = !editing;
    els.editMarkdownButton.hidden = editing;
    els.saveMarkdownButton.hidden = !editing;
    els.cancelMarkdownEditButton.hidden = !editing;
    els.addCommentButton.disabled = editing || !state.currentFile;
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }
    if (!els.markdownPreview.contains(selection.anchorNode) || !els.markdownPreview.contains(selection.focusNode)) {
      return;
    }
    const quote = selection.toString().trim();
    if (!quote) {
      return;
    }
    const target = getSelectionTarget(selection, quote);
    state.selectedQuote = quote;
    state.selectedTarget = target || {
      type: "text",
      quote
    };
    updatePreviewSelection();
  }

  function handlePreviewClick(event) {
    const lineButton = event.target.closest("[data-comment-line]");
    if (!lineButton || !els.markdownPreview.contains(lineButton)) {
      return;
    }
    const line = Number(lineButton.dataset.commentLine);
    const text = getLineText(line);
    state.selectedQuote = text || `L${line}`;
    state.selectedTarget = {
      type: "line",
      startLine: line,
      endLine: line,
      anchor: createAnchor(line, line, text)
    };
    window.getSelection().removeAllRanges();
    updatePreviewSelection();
  }

  function openCommentDialog() {
    captureSelection();
    if (!state.currentFile) {
      return;
    }
    els.quoteInput.value = formatTargetLabel(state.selectedTarget, state.selectedQuote || state.currentFile.path);
    els.bodyInput.value = "";
    els.authorInput.value = getCurrentAuthor() === "reviewer" ? "" : getCurrentAuthor();
    els.commentDialog.showModal();
    els.bodyInput.focus();
  }

  async function handleDialogClose() {
    if (els.commentDialog.returnValue === "cancel") {
      return;
    }
    const body = els.bodyInput.value.trim();
    if (!body || !state.currentFile) {
      return;
    }
    const author = els.authorInput.value.trim() || "reviewer";
    const now = new Date().toISOString();
    localStorage.setItem(AUTHOR_KEY, author);
    addEvent({
      type: "comment:create",
      author,
      createdAt: now,
      comment: {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        file: state.currentFile.path,
        quote: state.selectedQuote || els.quoteInput.value.trim(),
        target: withAnchor(state.selectedTarget, state.selectedQuote || els.quoteInput.value.trim()),
        body,
        author,
        status: "open",
        createdAt: now,
        updatedAt: now,
        replies: []
      }
    });
    state.selectedQuote = "";
    state.selectedTarget = null;
    renderPreviewAnnotations();
    renderComments();
    await persistComments();
  }

  async function renderPreview() {
    revokeImageObjectUrls();
    await ensureMarkdownItLoaded();
    els.markdownPreview.innerHTML = renderMarkdown(state.currentText);
    renderPreviewAnnotations();
    renderRelativeImages();
    renderMermaidDiagrams();
    renderTableOfContents();
  }

  function renderTableOfContents() {
    const headings = getHeadings();
    els.tocList.innerHTML = "";
    els.tocPanel.hidden = headings.length === 0;
    if (headings.length === 0) {
      return;
    }
    for (const heading of headings) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `toc-item toc-level-${heading.level}`;
      button.textContent = heading.text;
      button.addEventListener("click", () => scrollToTarget({
        startLine: heading.line,
        endLine: heading.line
      }));
      els.tocList.appendChild(button);
    }
  }

  function getHeadings() {
    return getNormalizedText().split("\n").map((line, index) => {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (!heading) {
        return null;
      }
      return {
        line: index + 1,
        level: heading[1].length,
        text: heading[2].replace(/[#\s]+$/g, "")
      };
    }).filter(Boolean);
  }

  async function renderRelativeImages() {
    if (!state.dirHandle || !state.currentFile) {
      return;
    }
    const images = els.markdownPreview.querySelectorAll("img[data-relative-src], img[src]");
    for (const image of images) {
      const relativeSrc = image.dataset.relativeSrc || image.getAttribute("src") || "";
      if (!relativeSrc || isAbsoluteImageSource(relativeSrc)) {
        continue;
      }
      try {
        const imagePath = resolveRelativePath(state.currentFile.path, relativeSrc);
        const fileHandle = await getFileHandleByPath(imagePath);
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        state.imageObjectUrls.push(url);
        image.src = url;
        image.removeAttribute("data-relative-src");
      } catch (error) {
        image.classList.add("image-missing");
        image.alt = image.alt || relativeSrc;
        image.title = `画像を読み込めません: ${relativeSrc}`;
      }
    }
  }

  function isAbsoluteImageSource(value) {
    return /^(https?:\/\/|data:image\/|blob:)/i.test(value);
  }

  function revokeImageObjectUrls() {
    for (const url of state.imageObjectUrls) {
      URL.revokeObjectURL(url);
    }
    state.imageObjectUrls = [];
  }

  async function getFileHandleByPath(path) {
    const parts = path.split("/").filter(Boolean);
    let dirHandle = state.dirHandle;
    for (let index = 0; index < parts.length - 1; index += 1) {
      dirHandle = await dirHandle.getDirectoryHandle(parts[index]);
    }
    return dirHandle.getFileHandle(parts[parts.length - 1]);
  }

  function resolveRelativePath(filePath, relativePath) {
    const baseParts = filePath.split("/").slice(0, -1);
    const parts = relativePath.split(/[?#]/)[0].split("/");
    for (const part of parts) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        baseParts.pop();
      } else {
        baseParts.push(part);
      }
    }
    return baseParts.join("/");
  }

  function updatePreviewSelection() {
    renderPreviewAnnotations();
  }

  function renderPreviewAnnotations() {
    const lines = els.markdownPreview.querySelectorAll(".md-line");
    const filter = els.commentFilter.value;
    const showResolved = filter === "all" || filter === "resolved";
    for (const line of lines) {
      line.classList.remove("has-comment", "has-resolved-comment", "selected-line");
      line.removeAttribute("title");
    }
    if (!state.currentFile) {
      return;
    }

    const counts = new Map();
    for (const comment of state.comments) {
      if (comment.file !== state.currentFile.path) {
        continue;
      }
      if (comment.status === "resolved" && !showResolved) {
        continue;
      }
      if (filter === "resolved" && comment.status !== "resolved") {
        continue;
      }
      for (const lineNumber of getCommentLines(comment)) {
        const current = counts.get(lineNumber) || { open: 0, resolved: 0 };
        if (comment.status === "resolved") {
          current.resolved += 1;
        } else {
          current.open += 1;
        }
        counts.set(lineNumber, current);
      }
    }

    for (const [lineNumber, count] of counts) {
      const line = getLineElement(lineNumber);
      if (!line) {
        continue;
      }
      line.classList.toggle("has-comment", count.open > 0);
      line.classList.toggle("has-resolved-comment", count.open === 0 && count.resolved > 0);
      line.title = `未対応 ${count.open} / 解決済み ${count.resolved}`;
    }

    for (const lineNumber of getTargetLines(state.selectedTarget)) {
      const line = getLineElement(lineNumber);
      if (line) {
        line.classList.add("selected-line");
      }
    }
  }

  function getSelectionTarget(selection, quote) {
    const anchorLine = getClosestLine(selection.anchorNode);
    const focusLine = getClosestLine(selection.focusNode);
    if (!anchorLine || !focusLine) {
      return null;
    }

    const startLine = Math.min(Number(anchorLine.dataset.line), Number(focusLine.dataset.line));
    const endLine = Math.max(Number(anchorLine.dataset.line), Number(focusLine.dataset.line));
    const target = {
      type: startLine === endLine ? "text" : "range",
      startLine,
      endLine
    };

    if (startLine === endLine) {
      const lineText = getLineText(startLine);
      const columnIndex = lineText.indexOf(quote);
      if (columnIndex >= 0) {
        target.startColumn = columnIndex + 1;
        target.endColumn = columnIndex + quote.length;
      } else {
        const renderedText = getRenderedLineText(startLine);
        const renderedColumnIndex = renderedText.indexOf(quote);
        if (renderedColumnIndex >= 0) {
          target.startColumn = renderedColumnIndex + 1;
          target.endColumn = renderedColumnIndex + quote.length;
          target.columnSource = "preview";
        }
      }
    }

    return withAnchor(target, quote);
  }

  function withAnchor(target, quote) {
    if (!target) {
      return null;
    }
    return {
      ...target,
      anchor: target.anchor || createAnchor(
        target.startLine,
        target.endLine || target.startLine,
        quote,
        target.startColumn,
        target.endColumn
      )
    };
  }

  function createAnchor(startLine, endLine, quote, startColumn, endColumn) {
    const text = getNormalizedText();
    const offsets = getLineOffsets(text);
    const startLineIndex = Math.max(0, Number(startLine) - 1);
    const endLineIndex = Math.max(startLineIndex, Number(endLine || startLine) - 1);
    let startOffset = offsets[startLineIndex] || 0;
    let endOffset = getLineEndOffset(text, offsets, endLineIndex);
    if (Number(startColumn) > 0) {
      startOffset += Number(startColumn) - 1;
    }
    if (Number(endColumn) > 0 && startLineIndex === endLineIndex) {
      endOffset = (offsets[startLineIndex] || 0) + Number(endColumn);
    }
    let needle = quote || text.slice(startOffset, endOffset);

    if (needle) {
      const nearest = findNearestOffset(text, needle, startOffset);
      if (nearest >= 0) {
        startOffset = nearest;
        endOffset = nearest + needle.length;
      } else {
        needle = text.slice(startOffset, endOffset);
      }
    }

    return {
      quote: needle,
      prefix: text.slice(Math.max(0, startOffset - ANCHOR_CONTEXT_CHARS), startOffset),
      suffix: text.slice(endOffset, endOffset + ANCHOR_CONTEXT_CHARS),
      section: getHeadingContext(startLine),
      startOffset,
      endOffset
    };
  }

  function resolveCommentTarget(comment) {
    const anchor = comment.target && comment.target.anchor;
    const quote = anchor ? anchor.quote : comment.quote;
    const text = getNormalizedText();
    const fallbackOffset = anchor && Number.isFinite(anchor.startOffset) ? anchor.startOffset : null;
    const range = findAnchorRange(text, anchor || { quote }, fallbackOffset);
    if (!range) {
      const sectionTarget = resolveSectionTarget(comment.target || {}, anchor);
      if (sectionTarget) {
        return {
          found: true,
          approximate: true,
          target: sectionTarget
        };
      }
      return {
        found: false,
        target: comment.target || null
      };
    }
    const lines = getLineRangeFromOffsets(text, range.startOffset, range.endOffset);
    const originalTarget = comment.target || {};
    return {
      found: true,
      target: {
        ...originalTarget,
        startLine: lines.startLine,
        endLine: lines.endLine
      }
    };
  }

  function resolveSectionTarget(originalTarget, anchor) {
    const section = (anchor && anchor.section) || (originalTarget && originalTarget.section);
    const line = findSectionLine(section);
    if (!line) {
      return null;
    }
    return {
      ...originalTarget,
      type: "section",
      startLine: line,
      endLine: line,
      section
    };
  }

  function getHeadingContext(lineNumber) {
    const headings = parseMarkdownHeadings(getNormalizedText());
    let current = null;
    for (const heading of headings) {
      if (heading.line > Number(lineNumber)) {
        break;
      }
      current = heading;
    }
    return current;
  }

  function findSectionLine(section) {
    if (!section) {
      return null;
    }
    const ownLine = findBestHeadingLine(section);
    if (ownLine) {
      return ownLine;
    }
    const ancestors = Array.isArray(section.ancestors) ? section.ancestors.slice().reverse() : [];
    if (section.parent) {
      ancestors.unshift(section.parent);
    }
    for (const ancestor of ancestors) {
      const ancestorLine = findBestHeadingLine(ancestor);
      if (ancestorLine) {
        return ancestorLine;
      }
    }
    return null;
  }

  function findBestHeadingLine(section) {
    if (!section || !section.title) {
      return null;
    }
    const headings = parseMarkdownHeadings(getNormalizedText());
    let best = null;
    for (const heading of headings) {
      if (heading.title !== section.title) {
        continue;
      }
      const levelScore = heading.level === section.level ? 4 : 0;
      const pathScore = commonPrefixItems(heading.path, section.path) * 3;
      const distanceScore = Number.isFinite(section.line) ? Math.max(0, 8 - Math.abs(heading.line - section.line)) : 0;
      const score = levelScore + pathScore + distanceScore;
      if (!best || score > best.score) {
        best = { line: heading.line, score };
      }
    }
    return best ? best.line : null;
  }

  function parseMarkdownHeadings(text) {
    const headings = [];
    const stack = [];
    text.split("\n").forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (!match) {
        return;
      }
      const level = match[1].length;
      const title = match[2].trim();
      const ancestors = stack.slice(0, level - 1).filter(Boolean).map(toHeadingRef);
      const current = {
        line: index + 1,
        level,
        title,
        path: ancestors.map((heading) => heading.title).concat(title),
        parent: ancestors.length > 0 ? ancestors[ancestors.length - 1] : null,
        ancestors
      };
      stack[level - 1] = current;
      stack.length = level;
      headings.push(current);
    });
    return headings;
  }

  function toHeadingRef(heading) {
    return {
      line: heading.line,
      level: heading.level,
      title: heading.title,
      path: heading.path
    };
  }

  function commonPrefixItems(a = [], b = []) {
    let index = 0;
    while (index < Math.min(a.length, b.length) && a[index] === b[index]) {
      index += 1;
    }
    return index;
  }

  function findAnchorRange(text, anchor, fallbackOffset) {
    if (!anchor) {
      return null;
    }
    const candidates = findAllOffsets(text, anchor.quote);
    if (candidates.length === 0) {
      return findContextAnchorRange(text, anchor, fallbackOffset);
    }

    let best = null;
    for (const startOffset of candidates) {
      const endOffset = startOffset + anchor.quote.length;
      const before = text.slice(Math.max(0, startOffset - ANCHOR_CONTEXT_CHARS), startOffset);
      const after = text.slice(endOffset, endOffset + ANCHOR_CONTEXT_CHARS);
      const contextScore = commonSuffixLength(anchor.prefix || "", before) + commonPrefixLength(anchor.suffix || "", after);
      const distanceScore = fallbackOffset === null ? 0 : Math.max(0, ANCHOR_CONTEXT_CHARS - Math.abs(startOffset - fallbackOffset));
      const score = contextScore * 10 + distanceScore;
      if (!best || score > best.score) {
        best = { startOffset, endOffset, score };
      }
    }
    return best;
  }

  function findContextAnchorRange(text, anchor, fallbackOffset) {
    const suffixRange = findRangeByContext(text, anchor.suffix || "", "suffix", fallbackOffset);
    if (suffixRange) {
      return suffixRange;
    }
    return findRangeByContext(text, anchor.prefix || "", "prefix", fallbackOffset);
  }

  function findRangeByContext(text, context, type, fallbackOffset) {
    if (!context || context.trim().length < 4) {
      return null;
    }
    const candidates = findAllOffsets(text, context);
    if (candidates.length === 0) {
      return null;
    }
    let best = null;
    for (const index of candidates) {
      const offset = type === "suffix" ? index : index + context.length;
      const distanceScore = fallbackOffset === null ? 0 : Math.max(0, ANCHOR_CONTEXT_CHARS - Math.abs(offset - fallbackOffset));
      const score = context.length * 10 + distanceScore;
      if (!best || score > best.score) {
        best = {
          startOffset: offset,
          endOffset: offset,
          score
        };
      }
    }
    return best;
  }

  function findNearestOffset(text, needle, offset) {
    const offsets = findAllOffsets(text, needle);
    if (offsets.length === 0) {
      return -1;
    }
    return offsets.reduce((best, current) => {
      return Math.abs(current - offset) < Math.abs(best - offset) ? current : best;
    }, offsets[0]);
  }

  function findAllOffsets(text, needle) {
    const offsets = [];
    let index = text.indexOf(needle);
    while (index >= 0) {
      offsets.push(index);
      index = text.indexOf(needle, index + Math.max(1, needle.length));
    }
    return offsets;
  }

  function commonPrefixLength(a, b) {
    const max = Math.min(a.length, b.length);
    let index = 0;
    while (index < max && a[index] === b[index]) {
      index += 1;
    }
    return index;
  }

  function commonSuffixLength(a, b) {
    const max = Math.min(a.length, b.length);
    let index = 0;
    while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) {
      index += 1;
    }
    return index;
  }

  function getLineRangeFromOffsets(text, startOffset, endOffset) {
    return {
      startLine: text.slice(0, startOffset).split("\n").length,
      endLine: text.slice(0, Math.max(startOffset, endOffset - 1)).split("\n").length
    };
  }

  function getLineOffsets(text) {
    const offsets = [0];
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        offsets.push(index + 1);
      }
    }
    return offsets;
  }

  function getLineEndOffset(text, offsets, lineIndex) {
    const nextLineOffset = offsets[lineIndex + 1];
    if (nextLineOffset === undefined) {
      return text.length;
    }
    return Math.max(offsets[lineIndex], nextLineOffset - 1);
  }

  function getNormalizedText() {
    return state.currentText.replace(/\r\n/g, "\n");
  }

  function getClosestLine(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element ? element.closest(".md-line") : null;
  }

  function getLineElement(lineNumber) {
    return els.markdownPreview.querySelector(`.md-line[data-line="${lineNumber}"]`);
  }

  function getLineText(lineNumber) {
    return getNormalizedText().split("\n")[lineNumber - 1] || "";
  }

  function getRenderedLineText(lineNumber) {
    const line = getLineElement(lineNumber);
    const content = line ? line.querySelector(".md-line-content") : null;
    return content ? content.textContent.trimEnd() : "";
  }

  function getCommentLines(comment) {
    const resolved = resolveCommentTarget(comment);
    if (resolved.found) {
      return getTargetLines(resolved.target);
    }
    if (comment.target && comment.target.anchor) {
      return [];
    }
    if (!comment.quote) {
      return getTargetLines(comment.target);
    }
    const index = getNormalizedText().indexOf(comment.quote);
    if (index < 0) {
      return getTargetLines(comment.target);
    }
    return [getNormalizedText().slice(0, index).split("\n").length];
  }

  function getTargetLines(target) {
    if (!target || !target.startLine) {
      return [];
    }
    const start = Number(target.startLine);
    const end = Number(target.endLine || target.startLine);
    const lines = [];
    for (let line = start; line <= end; line += 1) {
      lines.push(line);
    }
    return lines;
  }

  function getTargetStartLine(comment) {
    const lines = getCommentLines(comment);
    return lines.length > 0 ? lines[0] : Number.MAX_SAFE_INTEGER;
  }

  function getDisplayTarget(comment) {
    if (!state.currentFile || comment.file !== state.currentFile.path) {
      return {
        target: comment.target,
        missing: false
      };
    }
    const resolved = resolveCommentTarget(comment);
    return {
      target: resolved.found ? resolved.target : comment.target,
      missing: !resolved.found && Boolean(comment.target && comment.target.anchor),
      approximate: Boolean(resolved.approximate)
    };
  }

  function formatTargetLabel(target, fallback) {
    if (!target || !target.startLine) {
      return fallback;
    }
    const lineLabel = target.startLine === target.endLine || !target.endLine
      ? `L${target.startLine}`
      : `L${target.startLine}-L${target.endLine}`;
    if (target.startColumn && target.endColumn) {
      return `${lineLabel}:${target.startColumn}-${target.endColumn} ${fallback}`;
    }
    return `${lineLabel} ${fallback}`;
  }

  function renderComments() {
    const filter = els.commentFilter.value;
    const currentPath = state.currentFile ? state.currentFile.path : null;
    let comments = state.comments;
    if (currentPath) {
      comments = comments.filter((comment) => comment.file === currentPath);
    }
    if (filter !== "all") {
      comments = comments.filter((comment) => comment.status === filter);
    }
    comments = comments.slice().sort((a, b) => {
      const lineDiff = getTargetStartLine(a) - getTargetStartLine(b);
      return lineDiff === 0 ? b.createdAt.localeCompare(a.createdAt) : lineDiff;
    });
    els.commentList.innerHTML = "";
    if (comments.length === 0) {
      els.commentList.innerHTML = '<p class="empty">表示するコメントはありません。</p>';
      return;
    }
    for (const comment of comments) {
      els.commentList.appendChild(renderCommentCard(comment));
    }
  }

  function renderCommentCard(comment) {
    const card = document.createElement("section");
    card.className = `comment-card ${comment.status === "resolved" ? "resolved" : ""}`;
    const displayTarget = getDisplayTarget(comment);
    if (displayTarget.missing) {
      card.classList.add("missing-target");
    } else if (displayTarget.approximate) {
      card.classList.add("approximate-target");
    }

    const meta = document.createElement("div");
    meta.className = "comment-meta";
    meta.textContent = `${comment.author} / ${formatDate(comment.createdAt)} / ${comment.status === "resolved" ? "解決済み" : "未対応"}`;

    const quote = document.createElement("div");
    quote.className = "comment-quote";
    quote.textContent = displayTarget.missing
      ? `位置不明 ${comment.quote || comment.file}`
      : displayTarget.approximate
        ? `位置候補 ${formatTargetLabel(displayTarget.target, getSectionLabel(displayTarget.target) || comment.quote || comment.file)}`
      : formatTargetLabel(displayTarget.target, comment.quote || comment.file);

    const body = document.createElement("div");
    body.className = "comment-body";
    body.textContent = comment.body;

    const actions = document.createElement("div");
    actions.className = "comment-actions";

    const jump = document.createElement("button");
    jump.type = "button";
    jump.textContent = "対象へ移動";
    jump.disabled = displayTarget.missing || !displayTarget.target || !displayTarget.target.startLine;
    jump.addEventListener("click", () => {
      scrollToTarget(displayTarget.target);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = comment.status === "resolved" ? "未対応に戻す" : "解決済みにする";
    toggle.addEventListener("click", async () => {
      addEvent({
        type: "comment:status",
        commentId: comment.id,
        status: comment.status === "resolved" ? "open" : "resolved"
      });
      renderPreviewAnnotations();
      renderComments();
      await persistComments();
    });

    const replies = renderReplies(comment);
    const replyForm = renderReplyForm(comment);

    actions.append(jump, toggle);
    card.append(meta, quote, body, replies, replyForm, actions);
    return card;
  }

  function getSectionLabel(target) {
    return target && target.section && target.section.title ? `章: ${target.section.title}` : "";
  }

  function scrollToTarget(target) {
    if (!els.markdownEditor.hidden) {
      scrollEditorToTarget(target);
      return;
    }
    const lines = getTargetLines(target);
    if (lines.length === 0) {
      return;
    }
    const firstLine = getLineElement(lines[0]);
    if (!firstLine) {
      return;
    }
    for (const line of els.markdownPreview.querySelectorAll(".jump-line")) {
      line.classList.remove("jump-line");
    }
    for (const lineNumber of lines) {
      const line = getLineElement(lineNumber);
      if (line) {
        line.classList.add("jump-line");
      }
    }
    firstLine.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    window.setTimeout(() => {
      for (const line of els.markdownPreview.querySelectorAll(".jump-line")) {
        line.classList.remove("jump-line");
      }
    }, 1800);
  }

  function scrollEditorToTarget(target) {
    const lines = getTargetLines(target);
    if (lines.length === 0) {
      return;
    }
    const text = els.markdownEditor.value.replace(/\r\n/g, "\n");
    const range = getEditorLineRange(text, lines[0], lines[lines.length - 1]);
    const lineHeight = parseFloat(getComputedStyle(els.markdownEditor).lineHeight) || 22;
    els.markdownEditor.focus();
    els.markdownEditor.setSelectionRange(range.start, range.end);
    els.markdownEditor.scrollTop = Math.max(0, (lines[0] - 3) * lineHeight);
  }

  function getEditorLineRange(text, startLine, endLine) {
    const offsets = getLineOffsets(text);
    const startIndex = Math.max(0, Number(startLine) - 1);
    const endIndex = Math.max(startIndex, Number(endLine || startLine) - 1);
    const start = offsets[startIndex] === undefined ? text.length : offsets[startIndex];
    const end = getLineEndOffset(text, offsets, endIndex);
    return { start, end };
  }

  function renderReplies(comment) {
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const list = document.createElement("div");
    list.className = "reply-list";
    if (replies.length === 0) {
      return list;
    }

    for (const reply of replies.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const item = document.createElement("div");
      item.className = "reply-item";

      const meta = document.createElement("div");
      meta.className = "reply-meta";
      meta.textContent = `${reply.author || "reviewer"} / ${formatDate(reply.createdAt)}`;

      const body = document.createElement("div");
      body.className = "reply-body";
      body.textContent = reply.body;

      item.append(meta, body);
      list.appendChild(item);
    }
    return list;
  }

  function renderReplyForm(comment) {
    const form = document.createElement("div");
    form.className = "reply-form";

    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.placeholder = "返信を書く";
    textarea.setAttribute("aria-label", "返信");

    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "返信";
    submit.addEventListener("click", async () => {
      const body = textarea.value.trim();
      if (!body) {
        textarea.focus();
        return;
      }
      const author = getCurrentAuthor();
      const now = new Date().toISOString();
      addEvent({
        type: "reply:create",
        commentId: comment.id,
        author,
        createdAt: now,
        reply: {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          body,
          author,
          createdAt: now,
          updatedAt: now
        }
      });
      renderComments();
      await persistComments();
    });

    form.append(textarea, submit);
    return form;
  }

  function downloadComments() {
    const blob = new Blob([JSON.stringify({
      version: 3,
      userId: state.userId,
      author: getCurrentAuthor(),
      events: state.events.filter((event) => event.userId === state.userId),
      comments: state.comments
    }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getUserCommentFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCommentsCsv() {
    const rows = [["type", "file", "target", "status", "author", "body", "createdAt", "parentCommentId", "id"]];
    for (const comment of state.comments) {
      rows.push([
        "comment",
        comment.file || "",
        formatTargetLabel(comment.target, comment.quote || ""),
        comment.status || "",
        comment.author || "",
        comment.body || "",
        comment.createdAt || "",
        "",
        comment.id || ""
      ]);
      for (const reply of Array.isArray(comment.replies) ? comment.replies : []) {
        rows.push([
          "reply",
          comment.file || "",
          formatTargetLabel(comment.target, comment.quote || ""),
          comment.status || "",
          reply.author || "",
          reply.body || "",
          reply.createdAt || "",
          comment.id || "",
          reply.id || ""
        ]);
      }
    }
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "comments.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function escapeCsvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  async function importComments(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const data = JSON.parse(await file.text());
    const importedEvents = normalizeCommentFiles([{ name: file.name, data }]);
    state.events = dedupeEvents(state.events.concat(importedEvents));
    state.comments = buildComments(state.events);
    renderPreviewAnnotations();
    renderComments();
    await persistComments();
    event.target.value = "";
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let inCode = false;
    let codeLanguage = "";
    let codeStartLine = 0;
    let codeLines = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      let content = "";

      const codeFence = line.match(/^```\s*([a-zA-Z0-9_-]+)?\s*$/);
      if (codeFence) {
        if (inCode) {
          html.push(renderCodeBlock(codeStartLine, lineNumber, codeLanguage, codeLines));
          inCode = false;
          codeLanguage = "";
          codeStartLine = 0;
          codeLines = [];
        } else {
          inCode = true;
          codeLanguage = (codeFence[1] || "").toLowerCase();
          codeStartLine = lineNumber;
          codeLines = [];
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (isTableStart(lines, index)) {
        const startLine = lineNumber;
        const tableLines = [line, lines[index + 1]];
        index += 2;
        while (index < lines.length && /^\|.+\|$/.test(lines[index])) {
          tableLines.push(lines[index]);
          index += 1;
        }
        index -= 1;
        html.push(renderTableBlock(startLine, startLine + tableLines.length - 1, tableLines));
        continue;
      }

      if (/^\s*$/.test(line)) {
        html.push(renderSourceLine(lineNumber, '<span class="blank-line">&nbsp;</span>'));
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        content = renderMarkdownFragment(line, `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        html.push(renderSourceLine(lineNumber, content));
        continue;
      }

      if (/^\|[-:\s|]+\|$/.test(line)) {
        content = `<div class="table-separator">${escapeHtml(line)}</div>`;
        html.push(renderSourceLine(lineNumber, content));
        continue;
      }

      if (/^\|.+\|$/.test(line)) {
        content = "<table><tbody><tr>";
        for (const cell of splitTableRow(line)) {
          content += `<td>${renderInlineMarkdown(cell)}</td>`;
        }
        content += "</tr></tbody></table>";
        html.push(renderSourceLine(lineNumber, content));
        continue;
      }

      const list = line.match(/^\s*[-*+]\s+(.+)$/);
      if (list) {
        content = renderMarkdownFragment(line, `<ul><li>${inlineMarkdown(list[1])}</li></ul>`);
        html.push(renderSourceLine(lineNumber, content));
        continue;
      }

      const quote = line.match(/^>\s?(.+)$/);
      if (quote) {
        content = renderMarkdownFragment(line, `<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
        html.push(renderSourceLine(lineNumber, content));
        continue;
      }

      content = renderMarkdownFragment(line, `<p>${inlineMarkdown(line)}</p>`);
      html.push(renderSourceLine(lineNumber, content));
    }
    if (inCode) {
      html.push(renderCodeBlock(codeStartLine, lines.length, codeLanguage, codeLines));
    }
    return html.join("\n");
  }

  function renderCodeBlock(startLine, endLine, language, codeLines) {
    const code = codeLines.join("\n");
    if (language === "mermaid") {
      const content = [
        `<div class="mermaid-block" data-mermaid-source="${escapeHtml(code)}">`,
        `<pre class="mermaid-fallback"><code>${escapeHtml(code)}</code></pre>`,
        "</div>"
      ].join("");
      return renderSourceLine(startLine, content, endLine);
    }
    const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
    return renderSourceLine(startLine, `<pre><code${languageClass}>${escapeHtml(code || " ")}</code></pre>`, endLine);
  }

  function renderTableBlock(startLine, endLine, tableLines) {
    if (markdownRenderer) {
      return renderSourceLine(startLine, markdownRenderer.render(tableLines.join("\n")).trim(), endLine);
    }

    let content = "<table><thead><tr>";
    for (const cell of splitTableRow(tableLines[0])) {
      content += `<th>${inlineMarkdown(cell)}</th>`;
    }
    content += "</tr></thead><tbody>";
    for (const row of tableLines.slice(2)) {
      content += "<tr>";
      for (const cell of splitTableRow(row)) {
        content += `<td>${inlineMarkdown(cell)}</td>`;
      }
      content += "</tr>";
    }
    content += "</tbody></table>";
    return renderSourceLine(startLine, content, endLine);
  }

  function isTableStart(lines, index) {
    return /^\|.+\|$/.test(lines[index]) && index + 1 < lines.length && /^\|[-:\s|]+\|$/.test(lines[index + 1]);
  }

  function renderMarkdownFragment(markdown, fallback) {
    if (!markdownRenderer) {
      return fallback;
    }
    return markdownRenderer.render(markdown).trim();
  }

  function renderInlineMarkdown(markdown) {
    if (!markdownRenderer) {
      return inlineMarkdown(markdown);
    }
    return markdownRenderer.renderInline(markdown);
  }

  async function renderMermaidDiagrams() {
    const blocks = els.markdownPreview.querySelectorAll(".mermaid-block");
    if (blocks.length === 0) {
      return;
    }
    await ensureMermaidLoaded();
    if (!window.mermaid) {
      return;
    }
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default"
    });
    for (const block of blocks) {
      const source = block.dataset.mermaidSource || "";
      const id = `mermaid-${crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`;
      try {
        const result = await window.mermaid.render(id, source);
        block.innerHTML = result.svg;
        block.classList.add("rendered");
      } catch (error) {
        block.classList.add("render-error");
      }
    }
  }

  async function ensureMermaidLoaded() {
    if (window.mermaid) {
      return;
    }
    if (!mermaidLoadPromise) {
      mermaidLoadPromise = loadScript(MERMAID_SCRIPT).catch(() => {});
    }
    await mermaidLoadPromise;
  }

  async function ensureMarkdownItLoaded() {
    if (markdownRenderer || window.markdownit) {
      markdownRenderer = markdownRenderer || window.markdownit({
        html: false,
        linkify: true,
        typographer: false
      });
      return;
    }
    if (!markdownItLoadPromise) {
      markdownItLoadPromise = loadScript(MARKDOWN_IT_SCRIPT).catch(() => {});
    }
    await markdownItLoadPromise;
    if (window.markdownit) {
      markdownRenderer = window.markdownit({
        html: false,
        linkify: true,
        typographer: false
      });
    }
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function renderSourceLine(lineNumber, content, endLine) {
    const label = endLine && endLine !== lineNumber ? `${lineNumber}-${endLine}` : lineNumber;
    return [
      `<div class="md-line" data-line="${lineNumber}">`,
      `<button class="line-number" type="button" data-comment-line="${lineNumber}" title="この行にコメント">`,
      label,
      "</button>",
      `<div class="md-line-content">${content}</div>`,
      "</div>"
    ].join("");
  }

  function splitTableRow(line) {
    return line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/!\[([^\]]*)\]\((?!https?:\/\/|data:image\/)([^)]+)\)/g, '<img data-relative-src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
