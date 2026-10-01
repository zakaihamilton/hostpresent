"use client";

import { useCallback, useEffect, useRef } from "react";
import { createMediaRenegotiateMessage } from "@/lib/signaling/messages";
import {
  buildOutboundMediaStream,
  pickOutboundVideoTrack,
  resolveOutboundAudioTrack,
  syncOutboundTracks,
} from "@/lib/webrtc/outboundMedia";
import { needsMediaRenegotiation } from "@/lib/webrtc/outboundMediaReconciliation";
import { hostPeerId } from "@/lib/webrtc/peerClient";
import {
  closeRelayCallsForSource as closeRelayCallsForSourceInMap,
  closeRelayCallsForViewer as closeRelayCallsForViewerInMap,
  ensureRelayCall as ensureRelayCallInMap,
} from "@/lib/webrtc/relayCalls";

function resolveOutboundStreams(
  streamOverrides,
  localStreamRef,
  screenStreamRef,
) {
  const localStream = Object.hasOwn(streamOverrides, "localStream")
    ? streamOverrides.localStream
    : localStreamRef.current;
  const screenStream = Object.hasOwn(streamOverrides, "screenStream")
    ? streamOverrides.screenStream
    : screenStreamRef.current;

  return { localStream, screenStream };
}

export function useRoomMediaCalls({
  isHost,
  peerRef,
  destroyedRef,
  mediaCallsRef,
  preservingParticipantMediaCallsRef,
  relayCallsRef,
  inboundStreamsRef,
  connectionsRef,
  localStreamRef,
  screenStreamRef,
  onRemoteParticipantRef,
  onRemoteHostStreamRef,
  roomIdRef,
  send,
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const closeRelayCallsForViewer = useCallback((viewerId) => {
    closeRelayCallsForViewerInMap(relayCallsRef.current, viewerId);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const closeRelayCallsForSource = useCallback((sourceId) => {
    closeRelayCallsForSourceInMap(
      relayCallsRef.current,
      inboundStreamsRef.current,
      sourceId,
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const ensureRelayCall = useCallback(
    (viewerId, sourceId) => {
      if (!isHost || viewerId === sourceId) return;

      ensureRelayCallInMap({
        relayCalls: relayCallsRef.current,
        inboundStreams: inboundStreamsRef.current,
        peer: peerRef.current,
        viewerId,
        sourceId,
        onFailure: () => console.warn("[peer] relay call failed"),
      });
    },
    [isHost],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const syncRelayForViewer = useCallback(
    (viewerId) => {
      if (!isHost) return;
      for (const sourceId of inboundStreamsRef.current.keys()) {
        ensureRelayCall(viewerId, sourceId);
      }
    },
    [ensureRelayCall, isHost],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const syncRelayForSource = useCallback(
    (sourceId, stream) => {
      if (!isHost) return;
      if (!stream) {
        closeRelayCallsForSource(sourceId);
        return;
      }
      inboundStreamsRef.current.set(sourceId, stream);
      for (const viewerId of connectionsRef.current.keys()) {
        ensureRelayCall(viewerId, sourceId);
      }
    },
    [closeRelayCallsForSource, ensureRelayCall, isHost],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const bindMediaCall = useCallback(
    (call, remoteId) => {
      if (!call) return;

      const relayFrom =
        typeof call.metadata?.relayFrom === "string"
          ? call.metadata.relayFrom
          : null;
      const participantId = relayFrom || remoteId;

      if (!relayFrom) {
        const existing = mediaCallsRef.current.get(remoteId);
        if (existing && existing !== call) {
          if (isHost) {
            preservingParticipantMediaCallsRef.current.add(existing);
          }
          existing.close();
        }
        mediaCallsRef.current.set(remoteId, call);
      }

      call.on("stream", (remoteStream) => {
        if (destroyedRef.current) return;
        if (isHost) {
          onRemoteParticipantRef.current?.({
            id: participantId,
            stream: remoteStream,
          });
          if (!relayFrom) {
            syncRelayForSource(participantId, remoteStream);
          }
          return;
        }
        if (relayFrom) {
          onRemoteParticipantRef.current?.({
            id: relayFrom,
            stream: remoteStream,
          });
          return;
        }
        onRemoteHostStreamRef.current?.(remoteStream);
      });

      call.on("close", () => {
        if (destroyedRef.current) return;
        const isCurrentCall =
          relayFrom !== null || mediaCallsRef.current.get(remoteId) === call;
        if (!isCurrentCall) return;
        if (!relayFrom) {
          mediaCallsRef.current.delete(remoteId);
        }
        if (isHost) {
          if (!relayFrom) {
            onRemoteParticipantRef.current?.({
              id: participantId,
              stream: null,
              preserveProfile:
                preservingParticipantMediaCallsRef.current.has(call),
            });
            syncRelayForSource(participantId, null);
          }
          return;
        }
        if (relayFrom) {
          onRemoteParticipantRef.current?.({ id: relayFrom, stream: null });
          return;
        }
        onRemoteHostStreamRef.current?.(null);
      });

      call.on("error", (error) => {
        if (destroyedRef.current) return;
        console.warn("[peer] media call error", error);
      });
    },
    [isHost, syncRelayForSource],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const answerIncomingCall = useCallback(
    (call, remoteId, { receiveOnly = false } = {}) => {
      bindMediaCall(call, remoteId);
      if (receiveOnly) {
        call.answer();
        return;
      }
      void (async () => {
        if (destroyedRef.current) return;
        const outbound = await buildOutboundMediaStream(
          localStreamRef.current,
          screenStreamRef.current,
        );
        if (destroyedRef.current) return;
        if (outbound) {
          call.answer(outbound);
        } else {
          call.answer();
        }
      })().catch((error) => {
        console.warn("[peer] handle incoming call failed", error);
      });
    },
    [bindMediaCall],
  );

  const syncQueueRef = useRef(Promise.resolve());

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const ensureMediaCallNow = useCallback(
    async (remoteId, streamOverrides = {}) => {
      const peer = peerRef.current;
      if (!peer || destroyedRef.current) return;

      const {
        localStream: outboundLocalStream,
        screenStream: outboundScreenStream,
      } = resolveOutboundStreams(
        streamOverrides,
        localStreamRef,
        screenStreamRef,
      );

      const outbound = await buildOutboundMediaStream(
        outboundLocalStream,
        outboundScreenStream,
      );
      if (
        !outbound ||
        destroyedRef.current ||
        peerRef.current !== peer ||
        !connectionsRef.current.has(remoteId)
      )
        return;

      const existing = mediaCallsRef.current.get(remoteId);
      if (existing) {
        const peerConnection = existing.peerConnection;
        if (peerConnection && peerConnection.connectionState !== "closed") {
          await syncOutboundTracks(
            existing,
            outboundLocalStream,
            outboundScreenStream,
          );
        }
        return;
      }

      const call = peer.call(remoteId, outbound);
      if (!call) return;
      bindMediaCall(call, remoteId);
    },
    [bindMediaCall],
  );

  const ensureMediaCall = useCallback(
    (remoteId, streamOverrides = {}) => {
      const next = syncQueueRef.current.then(() =>
        ensureMediaCallNow(remoteId, streamOverrides),
      );
      syncQueueRef.current = next.catch(() => {});
      return next;
    },
    [ensureMediaCallNow],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref arguments are stable containers; read their current values when this callback runs.
  const enqueueSync = useCallback(
    async (streamOverrides = {}) => {
      const next = syncQueueRef.current.then(async () => {
        if (destroyedRef.current) return;
        const {
          localStream: outboundLocalStream,
          screenStream: outboundScreenStream,
        } = resolveOutboundStreams(
          streamOverrides,
          localStreamRef,
          screenStreamRef,
        );

        if (isHost) {
          const tasks = [];
          for (const call of mediaCallsRef.current.values()) {
            tasks.push(
              syncOutboundTracks(
                call,
                outboundLocalStream,
                outboundScreenStream,
              ),
            );
          }
          await Promise.all(tasks);

          for (const remoteId of connectionsRef.current.keys()) {
            // Already inside the queue: enqueueing here would wait on this task.
            await ensureMediaCallNow(remoteId, streamOverrides);
          }
          return;
        }

        const hostId = hostPeerId(roomIdRef.current);
        const existing = mediaCallsRef.current.get(hostId);
        const hasVideoTrack = Boolean(
          pickOutboundVideoTrack(outboundLocalStream, outboundScreenStream),
        );
        const hasAudioTrack = Boolean(
          await resolveOutboundAudioTrack(
            outboundLocalStream,
            outboundScreenStream,
          ),
        );

        // addTrack does not renegotiate PeerJS SDP when the call was answered
        // without tracks, so send an explicit renegotiation message first.
        if (existing) {
          if (
            needsMediaRenegotiation(existing, { hasVideoTrack, hasAudioTrack })
          ) {
            send(createMediaRenegotiateMessage());
            return;
          }
          await syncOutboundTracks(
            existing,
            outboundLocalStream,
            outboundScreenStream,
          );
          return;
        }

        if (hasVideoTrack || hasAudioTrack) {
          send(createMediaRenegotiateMessage());
        }
      });
      syncQueueRef.current = next.catch(() => {});
      return next;
    },
    [isHost, ensureMediaCallNow, send],
  );

  useEffect(() => {
    enqueueSync().catch((error) => {
      console.warn("[peer] syncAllOutboundTracks failed", error);
    });
  }, [enqueueSync]);

  return {
    answerIncomingCall,
    closeRelayCallsForSource,
    closeRelayCallsForViewer,
    enqueueSync,
    ensureMediaCall,
    syncRelayForSource,
    syncRelayForViewer,
  };
}
