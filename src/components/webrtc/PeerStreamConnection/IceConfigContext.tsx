"use client";

import { createContext, useContext } from "react";

const IceConfigContext = createContext(null);

export function IceConfigProvider({
  iceServers,
  children,
}: {
  iceServers?: any;
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
