"use client";

import { useEffect } from "react";
import { MeetingView } from "@/components/MeetingView";
import { WelcomeView } from "@/components/WelcomeView";
import { APP_ROLE, APP_VIEW, useHashRouter } from "@/hooks/hashRouter";
import { useRouteToken } from "@/hooks/routeToken";

export function AppRouter() {
  const {
    ready,
    view,
    role,
    token: routeToken,
    joinCode,
    navigate,
    navigateJoinCode,
    navigateParticipantWelcome,
  } = useHashRouter();

  const { token: sessionToken, loading: resolvingToken } = useRouteToken({
    role,
    token: routeToken,
    joinCode: view === APP_VIEW.MEETING ? joinCode : null,
  });

  useEffect(() => {
    if (!ready || view !== APP_VIEW.MEETING) return;
    if (resolvingToken || sessionToken) return;

    if (role === APP_ROLE.PARTICIPANT) {
      if (joinCode) {
        navigateJoinCode(joinCode);
      } else {
        navigateParticipantWelcome();
      }
      return;
    }

    navigate({
      view: APP_VIEW.WELCOME,
      role: APP_ROLE.HOST,
      joinCode: joinCode ?? null,
    });
  }, [
    joinCode,
    navigate,
    navigateJoinCode,
    navigateParticipantWelcome,
    ready,
    resolvingToken,
    role,
    sessionToken,
    view,
  ]);

  if (!ready) {
    return null;
  }

  if (view === APP_VIEW.MEETING) {
    if (resolvingToken || !sessionToken) {
      return null;
    }

    return (
      <MeetingView
        role={role}
        token={sessionToken}
        joinCode={joinCode}
        onBack={() => {
          navigate({
            view: APP_VIEW.WELCOME,
            role,
            joinCode,
          });
        }}
      />
    );
  }

  const welcomeRole =
    view === APP_VIEW.JOIN ? APP_ROLE.PARTICIPANT : (role ?? APP_ROLE.HOST);

  return (
    <WelcomeView
      role={welcomeRole}
      token={routeToken}
      joinCode={joinCode}
      navigate={navigate}
      navigateJoinCode={navigateJoinCode}
      navigateParticipantWelcome={navigateParticipantWelcome}
    />
  );
}
