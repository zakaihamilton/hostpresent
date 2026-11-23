import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useIceServers } from "@/components/webrtc/PeerStreamConnection";
import type { PeerJsConfig } from "@/lib/room/roomTypes";
import { SIGNALING_ERROR } from "@/lib/webrtc/peerClient";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";

const SIGNALING_NOT_CONFIGURED_ERROR = SIGNALING_ERROR.NOT_CONFIGURED;

export function useSignalingConfig({
  setConnectionError,
}: {
  setConnectionError: Dispatch<SetStateAction<string | null>>;
}) {
  const [peerConfig, setPeerConfig] = useState<PeerJsConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const iceServers = useIceServers();
  const peerConfigRef = useRef<PeerJsConfig | null>(null);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConfigReady(false);
    setPeerConfig(null);
    peerConfigRef.current = null;

    void fetchPeerJsConfig()
      .then((config) => {
        if (cancelled) return;
        if (!config) {
          setConnectionError(SIGNALING_NOT_CONFIGURED_ERROR);
          setConfigReady(true);
          return;
        }
        setConnectionError(null);
        setPeerConfig(config);
        peerConfigRef.current = config;
        setConfigReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[peer] failed to load signaling config", err);
        setConnectionError(SIGNALING_ERROR.CONFIG_LOAD_FAILED);
        setConfigReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setConnectionError]);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  return {
    peerConfig,
    configReady,
    iceServers,
    peerConfigRef,
    iceServersRef,
  };
}
