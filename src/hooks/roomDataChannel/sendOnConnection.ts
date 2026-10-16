import type { DataConnection } from "peerjs";

export function sendOnConnection(
  conn: DataConnection | null | undefined,
  message: unknown,
): boolean {
  if (!conn?.open) return false;
  try {
    conn.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}
