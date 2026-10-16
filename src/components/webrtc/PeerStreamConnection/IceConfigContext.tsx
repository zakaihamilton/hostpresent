"use client";

import { createContext, useContext } from "react";

const IceConfigContext = createContext<RTCIceServer[] | null>(null);

export function IceConfigProvider({
  iceServers,
  children,
}: {
  iceServers?: RTCIceServer[] | null;
  children?: any;
}) {
  return (
    <IceConfigContext.Provider value={iceServers}>
      {children}
    </IceConfigContext.Provider>
  );
}

export function useIceServers() {
  return useContext(IceConfigContext);
}
