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
        .find((track) => track.readyState === "live" && track.enabled) ?? null
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

  const videoSender = senders.find((sender) => sender.track?.kind === "video");
  const audioSender = senders.find((sender) => sender.track?.kind === "audio");

  if (videoSender) {
    if (videoTrack !== videoSender.track) {
      await videoSender.replaceTrack(videoTrack);
    }
  } else if (videoTrack) {
    const outbound = new MediaStream([videoTrack]);
    if (audioTrack) {
      outbound.addTrack(audioTrack);
    }
    peerConnection.addTrack(videoTrack, outbound);
  }

  if (audioSender) {
    const currentAudio = audioSender.track;
    if (audioTrack !== currentAudio) {
      await audioSender.replaceTrack(audioTrack);
    }
  } else if (audioTrack) {
    peerConnection.addTrack(audioTrack, new MediaStream([audioTrack]));
  }
}
