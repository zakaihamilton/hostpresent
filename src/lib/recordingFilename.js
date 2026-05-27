const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>]/g;

export function formatRecordingDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sanitizeRecordingSessionName(name) {
  if (typeof name !== "string") return "";
  return name.replace(INVALID_FILENAME_CHARS, "-").trim();
}

export function buildRecordingFilename({
  sessionName,
  date = new Date(),
  extension = "mp4",
} = {}) {
  const datePrefix = formatRecordingDate(date);
  const safeName =
    sanitizeRecordingSessionName(sessionName) || "Host Present Meeting";
  const ext = extension.replace(/^\./, "");
  return `${datePrefix} ${safeName}.${ext}`;
}
