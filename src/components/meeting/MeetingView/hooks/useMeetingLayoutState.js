import { useCallback, useEffect, useState } from "react";
import {
  loadChatVisible,
  loadGalleryVisible,
  loadSidebarVisible,
  saveChatVisible,
  saveGalleryVisible,
  saveSidebarVisible,
} from "@/lib/settings/layoutSettings";

export function useMeetingLayoutState() {
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isPipVisible, setIsPipVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () =>
      typeof window !== "undefined" &&
      (window.innerWidth <= 1024 || window.innerHeight <= 550);

    const handleResize = () => {
      const mobile = checkIsMobile();
      setIsMobile(mobile);
      if (mobile) {
        saveChatVisible(false);
        saveSidebarVisible(false);
        setIsSidebarVisible(false);
        setIsChatVisible(false);
      }
    };

    setIsGalleryVisible(loadGalleryVisible());
    const isMobileDevice = checkIsMobile();
    setIsMobile(isMobileDevice);
    if (isMobileDevice) {
      saveChatVisible(false);
      saveSidebarVisible(false);
      setIsSidebarVisible(false);
      setIsChatVisible(false);
    } else {
      setIsSidebarVisible(loadSidebarVisible());
      setIsChatVisible(loadChatVisible());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    saveGalleryVisible(isGalleryVisible);
  }, [isGalleryVisible]);

  useEffect(() => {
    if (!isMobile) saveSidebarVisible(isSidebarVisible);
  }, [isMobile, isSidebarVisible]);

  useEffect(() => {
    if (!isMobile) saveChatVisible(isChatVisible);
  }, [isMobile, isChatVisible]);

  const toggleGallery = useCallback(() => {
    setIsGalleryVisible((visible) => !visible);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((visible) => {
      const nextVisible = !visible;
      if (nextVisible && isMobile) setIsChatVisible(false);
      return nextVisible;
    });
  }, [isMobile]);

  const togglePip = useCallback(() => {
    setIsPipVisible((visible) => !visible);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatVisible((visible) => {
      const nextVisible = !visible;
      if (nextVisible && isMobile) setIsSidebarVisible(false);
      return nextVisible;
    });
  }, [isMobile]);

  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);
  const closeChat = useCallback(() => setIsChatVisible(false), []);
  const closePanels = useCallback(() => {
    setIsSidebarVisible(false);
    setIsChatVisible(false);
  }, []);

  return {
    isGalleryVisible,
    isSidebarVisible,
    isPipVisible,
    isChatVisible,
    hasUnreadChat,
    isMobile,
    setIsGalleryVisible,
    setIsSidebarVisible,
    setIsPipVisible,
    setIsChatVisible,
    setHasUnreadChat,
    toggleGallery,
    toggleSidebar,
    togglePip,
    toggleChat,
    closeSidebar,
    closeChat,
    closePanels,
  };
}
