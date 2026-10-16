export type RoomRole = "host" | "participant";

/** Data returned by the authenticated room state endpoint. */
export interface RoomState {
  roomId?: string;
  role?: RoomRole;
  status?: string;
  joinCode?: string | null;
  openedAt?: number;
  peerAuthToken?: string;
  peerId?: string;
  iceConfigUrl?: string;
}

export function isRoomState(value: unknown): value is RoomState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.roomId === "string" &&
    (state.role === "host" || state.role === "participant") &&
    (state.status === undefined || typeof state.status === "string") &&
    (state.joinCode === undefined ||
      state.joinCode === null ||
      typeof state.joinCode === "string") &&
    (state.openedAt === undefined || typeof state.openedAt === "number") &&
    (state.peerAuthToken === undefined ||
      typeof state.peerAuthToken === "string") &&
    (state.peerId === undefined || typeof state.peerId === "string") &&
    (state.iceConfigUrl === undefined || typeof state.iceConfigUrl === "string")
  );
}

export interface PeerJsConfig {
  host: string;
  port: number;
  path: string;
  key: string;
  secure: boolean;
  debug: 0;
}

export interface CreatedRoom {
  joinCode: string;
  roomId: string;
  hostToken: string;
}

export function isCreatedRoom(value: unknown): value is CreatedRoom {
  if (!value || typeof value !== "object") return false;
  const room = value as Record<string, unknown>;
  return (
    typeof room.joinCode === "string" &&
    typeof room.roomId === "string" &&
    Boolean(room.roomId) &&
    typeof room.hostToken === "string" &&
    Boolean(room.hostToken)
  );
}
