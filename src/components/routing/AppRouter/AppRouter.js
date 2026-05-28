"use client";

import { useEffect } from "react";
import { MeetingJoinError } from "@/components/ui/MeetingJoinError";
import { MeetingLoading } from "@/components/ui/MeetingLoading";
import { MeetingView } from "@/components/meeting/MeetingView";
import { WelcomeView } from "@/components/welcome/WelcomeView";
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

  const {
    token: sessionToken,
    loading: resolvingToken,
    error: resolveError,
  } = useRouteToken({
    role,
    token: routeToken,
    joinCode: view === APP_VIEW.MEETING ? joinCode : null,
    view,
  });

  useEffect(() => {
    if (!ready || view !== APP_VIEW.MEETING) return;
    if (resolvingToken || sessionToken || resolveError) return;

    if (role === APP_ROLE.PARTICIPANT && !joinCode) {
      navigateParticipantWelcome();
    }
  }, [
    joinCode,
    navigateParticipantWelcome,
    ready,
    resolveError,
    resolvingToken,
    role,
    sessionToken,
    view,
  ]);

  if (!ready) {
    return null;
  }

  if (view === APP_VIEW.MEETING) {
    if (resolvingToken) {
      return <MeetingLoading message="Looking up room…" />;
    }

    if (!sessionToken) {
      return (
        <MeetingJoinError
          title="Could not join meeting"
          message={
            resolveError ??
            "[E032] Invalid or expired room link. Check the join code and try again."
          }
          onBack={() => {
            if (role === APP_ROLE.PARTICIPANT) {
              navigateParticipantWelcome();
              return;
            }
            navigate({
              view: APP_VIEW.WELCOME,
              role: APP_ROLE.HOST,
            });
          }}
          backLabel={
            role === APP_ROLE.PARTICIPANT
              ? "Back to join screen"
              : "Back to welcome"
          }
        />
      );
    }

    return (
      <MeetingView
        role={role}
        token={sessionToken}
        joinCode={joinCode}
        onBack={() => {
          if (role === APP_ROLE.PARTICIPANT) {
            navigateParticipantWelcome();
            return;
          }
          navigate({
            view: APP_VIEW.WELCOME,
            role: APP_ROLE.HOST,
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
      autoJoinFromRoute={view === APP_VIEW.JOIN}
      navigate={navigate}
      navigateJoinCode={navigateJoinCode}
      navigateParticipantWelcome={navigateParticipantWelcome}
    />
  );
}
