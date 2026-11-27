export const ROOM_ROLE = {
  HOST: "host",
  PARTICIPANT: "participant",
} as const;

export type RoomRole = (typeof ROOM_ROLE)[keyof typeof ROOM_ROLE];
