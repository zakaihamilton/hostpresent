import {
  destroyOutboundAudioMixer,
  getOutboundAudioMixer,
  needsOutboundAudioMix,
} from "./outboundAudioMixer.js";

export { destroyOutboundAudioMixer, needsOutboundAudioMix };

export function pickOutboundVideoTrack(localStream, screenStream) {
  const screenVideo = screenStream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  if (screenVideo) return screenVideo;

  return (
    localStream
      ?.getVideoTracks()
      .find((track) => track.readyState === "live") ?? null
  );
}

export async function resolveOutboundAudioTrack(localStream, screenStream) {
  const mixer = getOutboundAudioMixer();
  if (!mixer) {
    return (
      localStream
        ?.getAudioTracks()
        .find((track) => track.readyState === "live") ?? null
    );
  }

  return mixer.getMixedAudioTrack(localStream, screenStream);
}

export async function buildOutboundMediaStream(localStream, screenStream) {
  if (!localStream && !screenStream) return null;

  const tracks = [];
  const videoTrack = pickOutboundVideoTrack(localStream, screenStream);
  const audioTrack = await resolveOutboundAudioTrack(localStream, screenStream);

  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);

  return tracks.length > 0 ? new MediaStream(tracks) : null;
}

export async function syncOutboundTracks(call, localStream, screenStream) {
  const peerConnection = call?.peerConnection;
  if (!peerConnection) return;

  const videoTrack = pickOutboundVideoTrack(localStream, screenStream);
  const audioTrack = await resolveOutboundAudioTrack(localStream, screenStream);
  const senders = peerConnection.getSenders();

  const videoSender = senders.find(
    (sender) => (sender._hostPresentKind ?? sender.track?.kind) === "video",
  );
  const audioSender = senders.find(
    (sender) => (sender._hostPresentKind ?? sender.track?.kind) === "audio",
  );

  if (videoSender) {
    if (videoTrack !== videoSender.track) {
      await videoSender.replaceTrack(videoTrack);
    }
    videoSender._hostPresentKind = "video";
  } else if (videoTrack) {
    const outbound = new MediaStream([videoTrack]);
    if (audioTrack) {
      outbound.addTrack(audioTrack);
    }
    const sender = peerConnection.addTrack(videoTrack, outbound);
    sender._hostPresentKind = "video";
  }

  if (audioSender) {
    const currentAudio = audioSender.track;
    if (audioTrack !== currentAudio) {
      await audioSender.replaceTrack(audioTrack);
    }
    audioSender._hostPresentKind = "audio";
  } else if (audioTrack) {
    const sender = peerConnection.addTrack(
      audioTrack,
      new MediaStream([audioTrack]),
    );
    sender._hostPresentKind = "audio";
  }
}
