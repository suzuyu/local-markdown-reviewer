const REVIEW_DIR_NAME = ".local-markdown-reviewer";

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Local Markdown Reviewer")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getCurrentUser() {
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "";
  const properties = PropertiesService.getUserProperties();
  let userId = email || properties.getProperty("localMarkdownReviewerUserId");
  if (!userId) {
    userId = Utilities.getUuid();
    properties.setProperty("localMarkdownReviewerUserId", userId);
  }
  return {
    email,
    userId: sanitizeFilePart(userId),
    author: email || "reviewer"
  };
}

function listMarkdownFiles(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = [];
  collectMarkdownFiles_(folder, "", files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function listDriveFolders(parentFolderId) {
  const folder = parentFolderId ? DriveApp.getFolderById(parentFolderId) : DriveApp.getRootFolder();
  const folders = folder.getFolders();
  const items = [];
  while (folders.hasNext()) {
    const child = folders.next();
    const name = child.getName();
    if (name === REVIEW_DIR_NAME) {
      continue;
    }
    items.push({
      id: child.getId(),
      name
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: folder.getId(),
    name: parentFolderId ? folder.getName() : "マイドライブ",
    folders: items
  };
}

function searchDriveFolders(query) {
  const normalized = String(query || "").trim();
  if (!normalized) {
    return [];
  }
  const escaped = normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const folders = DriveApp.searchFolders(`title contains '${escaped}' and trashed = false`);
  const items = [];
  while (folders.hasNext() && items.length < 50) {
    const folder = folders.next();
    const name = folder.getName();
    if (name === REVIEW_DIR_NAME) {
      continue;
    }
    items.push({
      id: folder.getId(),
      name
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function getMarkdownFile(fileId) {
  const file = DriveApp.getFileById(fileId);
  return {
    id: file.getId(),
    name: file.getName(),
    text: file.getBlob().getDataAsString("UTF-8"),
    updatedAt: file.getLastUpdated().toISOString()
  };
}

function saveMarkdownFile(fileId, text) {
  const file = DriveApp.getFileById(fileId);
  file.setContent(text || "");
  return {
    id: file.getId(),
    name: file.getName(),
    text: text || "",
    updatedAt: file.getLastUpdated().toISOString()
  };
}

function getImageDataUrl(folderId, currentFilePath, imagePath) {
  const root = DriveApp.getFolderById(folderId);
  const resolvedPath = resolveRelativePath_(currentFilePath, imagePath);
  const file = getFileByPath_(root, resolvedPath);
  const blob = file.getBlob();
  return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
}

function loadReviewData(folderId) {
  const user = getCurrentUser();
  const reviewFolder = getReviewFolder_(folderId, false);
  const events = [];
  if (reviewFolder) {
    const files = reviewFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!/\.json$/i.test(file.getName())) {
        continue;
      }
      try {
        const data = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
        if (Array.isArray(data.events)) {
          data.events.forEach(event => {
            events.push(Object.assign({}, event, {
              userId: event.userId || data.userId || file.getName().replace(/^user-|\.[^.]+$/g, "")
            }));
          });
        }
      } catch (error) {
        // 同期中や壊れたJSONは読み飛ばします。
      }
    }
  }
  return {
    user,
    events: dedupeEvents_(events)
  };
}

function appendReviewEvents(folderId, incomingEvents) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const user = getCurrentUser();
    const reviewFolder = getReviewFolder_(folderId, true);
    const fileName = `user-${user.userId}.json`;
    const file = getOrCreateJsonFile_(reviewFolder, fileName);
    let data = { version: 3, userId: user.userId, author: user.author, events: [] };
    try {
      data = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
    } catch (error) {
      // 空または壊れた場合は作り直します。
    }
    const ownEvents = Array.isArray(data.events) ? data.events : [];
    const normalized = (incomingEvents || []).map(event => Object.assign({}, event, {
      userId: user.userId,
      author: event.author || user.author
    }));
    const nextData = {
      version: 3,
      userId: user.userId,
      author: user.author,
      events: dedupeEvents_(ownEvents.concat(normalized))
    };
    file.setContent(JSON.stringify(nextData, null, 2));
    return loadReviewData(folderId);
  } finally {
    lock.releaseLock();
  }
}

function collectMarkdownFiles_(folder, prefix, output) {
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const child = folders.next();
    const name = child.getName();
    if (name === REVIEW_DIR_NAME || name === ".git" || name === "node_modules") {
      continue;
    }
    collectMarkdownFiles_(child, prefix ? `${prefix}/${name}` : name, output);
  }

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (/\.(md|markdown|mdown)$/i.test(name)) {
      output.push({
        id: file.getId(),
        name,
        path: prefix ? `${prefix}/${name}` : name,
        updatedAt: file.getLastUpdated().toISOString()
      });
    }
  }
}

function getReviewFolder_(folderId, create) {
  const folder = DriveApp.getFolderById(folderId);
  const folders = folder.getFoldersByName(REVIEW_DIR_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return create ? folder.createFolder(REVIEW_DIR_NAME) : null;
}

function getOrCreateJsonFile_(folder, name) {
  const files = folder.getFilesByName(name);
  if (files.hasNext()) {
    return files.next();
  }
  return folder.createFile(name, JSON.stringify({ version: 3, events: [] }, null, 2), MimeType.PLAIN_TEXT);
}

function getFileByPath_(rootFolder, path) {
  const parts = String(path || "").split("/").filter(Boolean);
  let folder = rootFolder;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const folders = folder.getFoldersByName(parts[index]);
    if (!folders.hasNext()) {
      throw new Error(`フォルダが見つかりません: ${parts[index]}`);
    }
    folder = folders.next();
  }
  const files = folder.getFilesByName(parts[parts.length - 1]);
  if (!files.hasNext()) {
    throw new Error(`ファイルが見つかりません: ${path}`);
  }
  return files.next();
}

function resolveRelativePath_(filePath, relativePath) {
  const baseParts = String(filePath || "").split("/").slice(0, -1);
  const parts = String(relativePath || "").split(/[?#]/)[0].split("/");
  parts.forEach(part => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  });
  return baseParts.join("/");
}

function dedupeEvents_(events) {
  const seen = {};
  return (events || []).filter(event => {
    if (!event || !event.id || seen[event.id]) {
      return false;
    }
    seen[event.id] = true;
    return true;
  });
}

function sanitizeFilePart(value) {
  return String(value || "reviewer").replace(/[^a-zA-Z0-9_.-]/g, "_");
}
