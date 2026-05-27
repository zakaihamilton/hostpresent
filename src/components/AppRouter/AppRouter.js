"use client";

import { useEffect } from "react";
import { MeetingView } from "@/components/MeetingView";
import { WelcomeView } from "@/components/WelcomeView";
import { APP_ROLE, APP_VIEW, useHashRouter } from "@/hooks/hashRouter";
import { useRouteToken } from "@/hooks/routeToken";
import { ROOM_SESSION_STATUS, useRoomSession } from "@/hooks/roomSession";

function ParticipantMeetingGuard({
  joinCode,
  token,
  navigateJoinCode,
  navigateParticipantWelcome,
  children,
}) {
  const { status } = useRoomSession({
    role: APP_ROLE.PARTICIPANT,
    token,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (
      status === ROOM_SESSION_STATUS.WAITING ||
      status === ROOM_SESSION_STATUS.ERROR
    ) {
      if (joinCode) {
        navigateJoinCode(joinCode);
        return;
      }
      navigateParticipantWelcome();
    }
  }, [joinCode, navigateJoinCode, navigateParticipantWelcome, status]);

  if (
    status === ROOM_SESSION_STATUS.IDLE ||
    status === ROOM_SESSION_STATUS.LOADING ||
    status === ROOM_SESSION_STATUS.WAITING
  ) {
    return null;
  }

  return children;
}

export function AppRouter() {
  const {
    ready,
    view,
    role,
    token: routeToken,
    joinCode,
    openProof,
    navigate,
    navigateJoinCode,
    navigateParticipantWelcome,
  } = useHashRouter();

  const { token: sessionToken, loading: resolvingToken } = useRouteToken({
    role,
    token: routeToken,
    joinCode: view === APP_VIEW.MEETING ? joinCode : null,
  });

  if (!ready) {
    return null;
  }

  if (view === APP_VIEW.MEETING) {
    if (resolvingToken || !sessionToken) {
      return null;
    }

    const meeting = (
      <MeetingView
        role={role}
        token={sessionToken}
        onBack={() => {
          navigate({
            view: APP_VIEW.WELCOME,
            role,
            joinCode,
          });
        }}
      />
    );

    if (role === APP_ROLE.PARTICIPANT) {
      return (
        <ParticipantMeetingGuard
          joinCode={joinCode}
          token={sessionToken}
          navigateJoinCode={navigateJoinCode}
          navigateParticipantWelcome={navigateParticipantWelcome}
        >
          {meeting}
        </ParticipantMeetingGuard>
      );
    }

    return meeting;
  }

  const welcomeRole =
    view === APP_VIEW.JOIN ? APP_ROLE.PARTICIPANT : (role ?? APP_ROLE.HOST);

  return (
    <WelcomeView
      role={welcomeRole}
      token={routeToken}
      joinCode={joinCode}
      openProof={openProof}
      navigate={navigate}
      navigateJoinCode={navigateJoinCode}
      navigateParticipantWelcome={navigateParticipantWelcome}
    />
  );
}
