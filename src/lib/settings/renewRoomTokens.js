import {
  getActiveRoom,
  getRoomByHostToken,
  saveRoom,
  setActiveHostToken,
} from "./roomSettings";

export function renewSavedHostRoom(previousHostToken, state) {
  if (!state?.hostToken || state.hostToken === previousHostToken) {
    return false;
  }

  const saved =
    getRoomByHostToken(previousHostToken) ??
    (getActiveRoom()?.hostToken === previousHostToken ? getActiveRoom() : null);

  saveRoom({
    roomId: state.roomId ?? saved?.roomId,
    hostToken: state.hostToken,
    participantToken: state.participantToken ?? saved?.participantToken,
    joinCode: state.joinCode ?? saved?.joinCode ?? null,
    createdAt: saved?.createdAt ?? Date.now(),
    title: saved?.title,
  });
  setActiveHostToken(state.hostToken);
  return true;
}
