export function sendOnConnection(conn, message) {
  if (!conn?.open) return false;
  try {
    conn.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}
