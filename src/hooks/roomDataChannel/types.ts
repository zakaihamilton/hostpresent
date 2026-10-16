import type { DataConnection } from "peerjs";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  ChatMessage,
  ParticipantMode,
  SignalingMessage,
} from "@/lib/signaling/messages";
import type { MediaControlMessage } from "@/lib/webrtc/audienceProtocol";

export interface RoomMediaControlsConnection {
  localParticipantId?: string;
  send: (message: SignalingMessage) => boolean;
  syncOutboundMedia?: (streams?: {
    localStream?: MediaStream | null;
    screenStream?: MediaStream | null;
  }) => Promise<void>;
}

export interface RemoteParticipantUpdate {
  id: string;
  name?: string;
  stream?: MediaStream | null;
  mode?: ParticipantMode;
  preserveProfile?: boolean;
}

export interface SendParticipantProfileOptions {
  nextDisplayName?: string;
  nextParticipantMode?: ParticipantMode;
}

export type RoomMessageHandler = (
  message: SignalingMessage | ChatMessage,
) => void;

export interface RoomConnectionContext {
  isHost: boolean;
  destroyedRef: MutableRefObject<boolean>;
  isCurrentConnection?: () => boolean;
  updateConnectedState: (delta: number) => void;
  createHostPresencePayload: () => SignalingMessage;
  onRemoteParticipantRef: MutableRefObject<
    ((participant: RemoteParticipantUpdate) => void) | null | undefined
  >;
  onMediaOpen: (id: string) => void;
  onMediaClose: (id: string) => void;
  onMediaControl: (id: string, message: MediaControlMessage) => void;
  sendParticipantProfileRef: MutableRefObject<
    (options?: SendParticipantProfileOptions) => boolean
  >;
  scheduleReconnectToHost: () => void;
  roomIdRef: MutableRefObject<string | null | undefined>;
  participantDisplayNamesRef: MutableRefObject<Map<string, string>>;
  hostDisplayNameRef: MutableRefObject<string>;
  localParticipantIdRef: MutableRefObject<string>;
  connectionsRef: MutableRefObject<Map<string, DataConnection>>;
  notifyHandlers: RoomMessageHandler;
  onChatMessageRef: MutableRefObject<((message: ChatMessage) => void) | null>;
  peerDeviceIdsRef: MutableRefObject<Map<string, string>>;
  setHostPresent: Dispatch<SetStateAction<boolean>>;
  setConnectionError: Dispatch<SetStateAction<string | null>>;
}
