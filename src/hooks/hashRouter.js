"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "@/lib/room/joinCodeFormat";
import { getParticipantRoomByToken } from "@/lib/settings/participantRoomSettings";
import { getRoomByHostToken } from "@/lib/settings/roomSettings";

const DEFAULT_ROLE = "host";
const STORAGE_KEY = "hostpresent.lastWelcomeTab";

export const APP_VIEW = {
  WELCOME: "welcome",
  MEETING: "meeting",
  JOIN: "join",
};

export const APP_ROLE = {
  HOST: "host",
  PARTICIPANT: "participant",
};

function isLegacyToken(value) {
  return typeof value === "string" && value.includes(".");
}

function readOpenProofFromLocation() {
  if (typeof window === "undefined") return null;

  const fromSearch = new URLSearchParams(window.location.search).get("open");
  if (fromSearch) return fromSearch;

  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) {
    return new URLSearchParams(hash.slice(queryIndex + 1)).get("open");
  }

  return null;
}

function stripHashQuery(value) {
  if (!value) return value;
  const queryIndex = value.indexOf("?");
  return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
}
function parseLegacyRoute(parts) {
  const [viewRaw, roleRaw, third] = parts;
  const view =
    viewRaw === APP_VIEW.MEETING ? APP_VIEW.MEETING : APP_VIEW.WELCOME;
  const role =
    roleRaw === APP_ROLE.PARTICIPANT ? APP_ROLE.PARTICIPANT : APP_ROLE.HOST;

  if (view === APP_VIEW.WELCOME && !roleRaw) {
    return {
      view: APP_VIEW.WELCOME,
      role: DEFAULT_ROLE,
      token: null,
      joinCode: null,
    };
  }

  if (third && isLegacyToken(third)) {
    return { view, role, token: third, joinCode: null };
  }

  if (third && isValidJoinCode(third)) {
    return {
      view,
      role,
      token: null,
      joinCode: normalizeJoinCode(third),
    };
  }

  return { view, role, token: null, joinCode: null };
}

function parseHash(hash) {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = normalized.replace(/^\/+/, "").split("/").filter(Boolean);

  if (parts.length === 0) {
    return {
      view: APP_VIEW.WELCOME,
      role: DEFAULT_ROLE,
      token: null,
      joinCode: null,
    };
  }

  const [first, second] = parts;

  if (first === "h") {
    if (second && isValidJoinCode(second)) {
      return {
        view: APP_VIEW.WELCOME,
        role: APP_ROLE.HOST,
        token: null,
        joinCode: normalizeJoinCode(second),
      };
    }
    return {
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.HOST,
      token: null,
      joinCode: null,
    };
  }

  if (first === "j") {
    const codePart = stripHashQuery(second);
    if (codePart && isValidJoinCode(codePart)) {
      return {
        view: APP_VIEW.JOIN,
        role: APP_ROLE.PARTICIPANT,
        token: null,
        joinCode: normalizeJoinCode(codePart),
      };
    }
    return {
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.PARTICIPANT,
      token: null,
      joinCode: null,
    };
  }

  if (first === "mh" && second && isValidJoinCode(stripHashQuery(second))) {
    return {
      view: APP_VIEW.MEETING,
      role: APP_ROLE.HOST,
      token: null,
      joinCode: normalizeJoinCode(stripHashQuery(second)),
    };
  }

  if (first === "mj" && second && isValidJoinCode(stripHashQuery(second))) {
    return {
      view: APP_VIEW.MEETING,
      role: APP_ROLE.PARTICIPANT,
      token: null,
      joinCode: normalizeJoinCode(stripHashQuery(second)),
    };
  }

  if (first === "welcome" || first === "meeting") {
    return parseLegacyRoute(parts);
  }

  return {
    view: APP_VIEW.WELCOME,
    role: DEFAULT_ROLE,
    token: null,
    joinCode: null,
  };
}

function canonicalizeRoute(route) {
  if (route.joinCode || !route.token) {
    return route;
  }

  const joinCode =
    route.role === APP_ROLE.HOST
      ? getRoomByHostToken(route.token)?.joinCode
      : getParticipantRoomByToken(route.token)?.joinCode;

  if (!joinCode) {
    return route;
  }

  return {
    ...route,
    token: null,
    joinCode: normalizeJoinCode(joinCode),
  };
}

function buildJoinHash(joinCode, openProof = null) {
  let hash = `#/j/${formatJoinCode(joinCode)}`;
  if (openProof) {
    hash += `?open=${encodeURIComponent(openProof)}`;
  }
  return hash;
}

function buildHash({ view, role, token, joinCode, openProof = null }) {
  if (joinCode) {
    const formatted = formatJoinCode(joinCode);
    if (view === APP_VIEW.MEETING) {
      return role === APP_ROLE.HOST
        ? `#/mh/${formatted}`
        : `#/mj/${formatted}`;
    }
    if (view === APP_VIEW.JOIN || role === APP_ROLE.PARTICIPANT) {
      return buildJoinHash(joinCode, openProof);
    }
    if (role === APP_ROLE.HOST) {
      return `#/h/${formatted}`;
    }
  }

  if (token) {
    const segments = [view, role, token];
    return `#/${segments.join("/")}`;
  }

  if (view === APP_VIEW.JOIN) {
    return "#/j";
  }

  return role === APP_ROLE.PARTICIPANT ? "#/j" : "#/h";
}

function readStoredWelcomeTab() {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === APP_ROLE.PARTICIPANT
      ? APP_ROLE.PARTICIPANT
      : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

function writeStoredWelcomeTab(role) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, role);
  } catch {
    // ignore storage failures
  }
}

export function useHashRouter() {
  const [route, setRoute] = useState(() => ({
    view: APP_VIEW.WELCOME,
    role: DEFAULT_ROLE,
    token: null,
    joinCode: null,
    openProof: null,
    ready: false,
  }));

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash;
      const openProof = readOpenProofFromLocation();
      if (!hash || hash === "#" || hash === "#/") {
        const role = readStoredWelcomeTab();
        const nextHash = buildHash({
          view: APP_VIEW.WELCOME,
          role,
          token: null,
        });
        window.location.replace(nextHash);
        return;
      }

      const parsed = canonicalizeRoute(parseHash(hash));
      const nextHash = buildHash(parsed);
      const hashPath = hash.split("?")[0];
      const nextPath = nextHash.split("?")[0];
      if (hashPath !== nextPath) {
        window.location.replace(nextHash);
        return;
      }

      setRoute({ ...parsed, openProof, ready: true });
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const navigate = useCallback(({ view, role, token, joinCode }) => {
    if (view === APP_VIEW.WELCOME || view === APP_VIEW.JOIN) {
      writeStoredWelcomeTab(role ?? APP_ROLE.PARTICIPANT);
    }
    const nextHash = buildHash({
      view,
      role,
      token: token ?? null,
      joinCode: joinCode ?? null,
    });
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute({
        view,
        role: role ?? APP_ROLE.PARTICIPANT,
        token: token ?? null,
        joinCode: joinCode ?? null,
        openProof: readOpenProofFromLocation(),
        ready: true,
      });
    }
  }, []);

  const navigateJoinCode = useCallback((code, openProof = null) => {
    writeStoredWelcomeTab(APP_ROLE.PARTICIPANT);
    const nextHash = buildJoinHash(code, openProof);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute({
        view: APP_VIEW.JOIN,
        role: APP_ROLE.PARTICIPANT,
        token: null,
        joinCode: normalizeJoinCode(code),
        openProof,
        ready: true,
      });
    }
  }, []);

  const navigateParticipantWelcome = useCallback(() => {
    writeStoredWelcomeTab(APP_ROLE.PARTICIPANT);
    const nextHash = "#/j";
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute({
        view: APP_VIEW.WELCOME,
        role: APP_ROLE.PARTICIPANT,
        token: null,
        joinCode: null,
        ready: true,
      });
    }
  }, []);

  return {
    ...route,
    navigate,
    navigateJoinCode,
    navigateParticipantWelcome,
    buildHash,
  };
}
