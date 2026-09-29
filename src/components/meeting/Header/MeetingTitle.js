import { useCallback, useEffect, useRef, useState } from "react";
import { Edit, Logo, X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./Header.module.css";

export function MeetingTitle({
  sessionTitle,
  onSessionTitleChange,
  revealTitleOnLogoClick,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(sessionTitle || "");
  const inputRef = useRef(null);

  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const renameInputRef = useRef(null);
  const meetingName = sessionTitle || "Host Present";

  useEffect(() => {
    setEditedTitle(sessionTitle || "");
  }, [sessionTitle]);

  const handleTitleClick = useCallback(() => {
    if (onSessionTitleChange) {
      setIsEditingTitle(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [onSessionTitleChange]);

  const saveTitle = useCallback(() => {
    const trimmed = editedTitle.trim();
    if (trimmed !== (sessionTitle || "")) {
      onSessionTitleChange(trimmed);
    } else {
      setEditedTitle(sessionTitle || "");
    }
  }, [editedTitle, sessionTitle, onSessionTitleChange]);

  const handleTitleSubmit = useCallback(() => {
    setIsEditingTitle(false);
    saveTitle();
  }, [saveTitle]);

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleTitleSubmit();
      } else if (e.key === "Escape") {
        setIsEditingTitle(false);
        setEditedTitle(sessionTitle || "");
      }
    },
    [handleTitleSubmit, sessionTitle],
  );

  const handleOpenRenamePopup = useCallback(() => {
    setEditedTitle(sessionTitle || "");
    setIsRenamePopupOpen(true);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [sessionTitle]);

  const handleCloseRenamePopup = useCallback(() => {
    setIsRenamePopupOpen(false);
    setEditedTitle(sessionTitle || "");
  }, [sessionTitle]);

  const handleRenamePopupSubmit = useCallback(() => {
    setIsRenamePopupOpen(false);
    saveTitle();
  }, [saveTitle]);

  const handleRenamePopupKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleRenamePopupSubmit();
      } else if (e.key === "Escape") {
        handleCloseRenamePopup();
      }
    },
    [handleRenamePopupSubmit, handleCloseRenamePopup],
  );

  const logoIcon = <Logo />;
  return (
    <>
      <div className={styles.leading}>
        <div className={styles.logo}>
          {revealTitleOnLogoClick
            ? <>
                <span className={styles.logoTooltipNarrow}>
                  <Tooltip
                    text={meetingName}
                    placement="bottom"
                    trigger="click"
                  >
                    <button
                      type="button"
                      className={`${styles.logoButton} ${styles.logoIconContainer}`}
                      aria-label={`Meeting name, ${meetingName}`}
                    >
                      {logoIcon}
                    </button>
                  </Tooltip>
                </span>
                <span className={styles.logoTextParticipantInline}>
                  {meetingName}
                </span>
              </>
            : <Tooltip text={meetingName} placement="bottom">
                <span className={styles.logoIconContainer} aria-hidden>
                  {logoIcon}
                </span>
              </Tooltip>}
          {onSessionTitleChange
            ? isEditingTitle
              ? <input
                  ref={inputRef}
                  type="text"
                  className={styles.logoTitleInput}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  maxLength={50}
                  placeholder="Meeting name"
                  aria-label="Rename meeting"
                />
              : <>
                  <Tooltip text="Rename meeting" placement="bottom">
                    <button
                      type="button"
                      className={`${styles.logoText} ${styles.logoTextVisible} ${styles.logoTextEditable}`}
                      onClick={handleTitleClick}
                    >
                      <span className={styles.logoTextLabel}>
                        {meetingName}
                      </span>
                      <span className={styles.editIconWrapper}>
                        <Edit size={14} className={styles.editIcon} />
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Rename meeting" placement="bottom">
                    <button
                      type="button"
                      className={styles.mobileEditButton}
                      onClick={handleOpenRenamePopup}
                      aria-label="Rename meeting"
                    >
                      <Edit size={15} />
                    </button>
                  </Tooltip>
                </>
            : null}
        </div>
      </div>

      {isRenamePopupOpen && (
        <>
          <div
            className={styles.renamePopupOverlay}
            onClick={handleCloseRenamePopup}
            aria-hidden
          />
          <div
            className={styles.renamePopup}
            role="dialog"
            aria-modal="true"
            aria-label="Rename meeting"
          >
            <div className={styles.renamePopupHeader}>
              <span className={styles.renamePopupTitle}>Rename meeting</span>
              <Tooltip text="Close" placement="bottom">
                <button
                  type="button"
                  className={styles.renamePopupClose}
                  onClick={handleCloseRenamePopup}
                  aria-label="Close rename dialog"
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>
            <input
              id="meeting-rename-input"
              ref={renameInputRef}
              type="text"
              className={styles.renamePopupInput}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleRenamePopupKeyDown}
              maxLength={50}
              placeholder="Meeting name"
              aria-label="New meeting name"
            />
            <div className={styles.renamePopupActions}>
              <button
                type="button"
                className={styles.renamePopupCancel}
                onClick={handleCloseRenamePopup}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.renamePopupSave}
                onClick={handleRenamePopupSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
