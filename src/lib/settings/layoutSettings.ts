const GALLERY_KEY = "hostpresent.isGalleryVisible";
const SIDEBAR_KEY = "hostpresent.isSidebarVisible";
const CHAT_KEY = "hostpresent.isChatVisible";
const PIP_KEY = "hostpresent.isPipVisible";

function loadBool(key) {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === "true";
  } catch {
    return false;
  }
}

function saveBool(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // ignore storage failures
  }
}

export function loadGalleryVisible() {
  return loadBool(GALLERY_KEY);
}

export function saveGalleryVisible(value) {
  saveBool(GALLERY_KEY, value);
}

export function loadSidebarVisible() {
  return loadBool(SIDEBAR_KEY);
}

export function saveSidebarVisible(value) {
  saveBool(SIDEBAR_KEY, value);
}

export function loadChatVisible() {
  return loadBool(CHAT_KEY);
}

export function saveChatVisible(value) {
  saveBool(CHAT_KEY, value);
}

export function loadPipVisible() {
  return loadBool(PIP_KEY);
}

export function savePipVisible(value) {
  saveBool(PIP_KEY, value);
}
