"use client";

import { useEffect, useState } from "react";
import { APP_ROLE } from "@/hooks/useHashRouter";
import { resolveJoinCode } from "@/lib/room/inviteLink";
import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";
import { getParticipantRoomByJoinCode } from "@/lib/settings/participantRoomSettings";
import { getRoomByJoinCode } from "@/lib/settings/roomSettings";

export function useRouteToken({ role, token, joinCode }) {
  const [resolvedToken, setResolvedToken] = useState(token);
  const [loading, setLoading] = useState(Boolean(joinCode && !token));

  useEffect(() => {
    if (token) {
      setResolvedToken(token);
      setLoading(false);
      return;
    }

    if (!joinCode) {
      setResolvedToken(null);
      setLoading(false);
      return;
    }

    const normalized = normalizeJoinCode(joinCode);

    if (role === APP_ROLE.HOST) {
      const room = getRoomByJoinCode(normalized);
      setResolvedToken(room?.hostToken ?? null);
      setLoading(false);
      return;
    }

    const saved = getParticipantRoomByJoinCode(normalized);
    if (saved?.participantToken) {
      setResolvedToken(saved.participantToken);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void resolveJoinCode(normalized)
      .then((resolved) => {
        if (!cancelled) {
          setResolvedToken(resolved.participantToken ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [joinCode, role, token]);

  return { token: resolvedToken, loading };
}
