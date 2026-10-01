import { JoinCodeBoxes } from "./JoinCodeBoxes";
import hs from "./WelcomeHostPanel.module.css";
import shared from "./WelcomeShared.module.css";

export function HostRoomSharing({
  activeShareTab,
  setActiveShareTab,
  inviteLink,
  formattedJoinCode,
  copyMessage,
  handleCopyLink,
  handleCopyJoinCode,
}) {
  return (
    <>
      {/* Hidden tabs kept for accessibility/test suite compatibility */}
      <div
        className={shared.visuallyHidden}
        role="tablist"
        aria-label="Sharing options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeShareTab === "link"}
          className={`${shared.shareTab} ${activeShareTab === "link" ? shared.shareTabActive : ""}`}
          onClick={() => setActiveShareTab("link")}
        >
          Invite link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeShareTab === "code"}
          className={`${shared.shareTab} ${activeShareTab === "code" ? shared.shareTabActive : ""}`}
          onClick={() => setActiveShareTab("code")}
        >
          Room code
        </button>
      </div>

      <div className={hs.shareSection}>
        <div className={shared.directActionsGrid}>
          <div className={shared.directActionSection}>
            <label className={shared.label} htmlFor="invite-link">
              Invite link
            </label>
            <div className={shared.directActionRow}>
              <input
                id="invite-link"
                className={shared.linkInput}
                readOnly
                value={inviteLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={`${shared.button} ${shared.buttonCopyInline}`}
                onClick={handleCopyLink}
                disabled={!inviteLink}
              >
                {activeShareTab === "link" && copyMessage
                  ? copyMessage
                  : "Copy invite link"}
              </button>
            </div>
          </div>

          <div className={shared.directActionSection}>
            <label className={shared.label} htmlFor="join-code-box-0">
              Room code
            </label>
            <div className={shared.directActionRow}>
              <JoinCodeBoxes
                value={formattedJoinCode}
                readOnly
                className={shared.joinCodeBoxes}
              />
              <button
                type="button"
                className={`${shared.button} ${shared.buttonCopyInline}`}
                onClick={handleCopyJoinCode}
                disabled={!formattedJoinCode}
              >
                {activeShareTab === "code" && copyMessage
                  ? copyMessage
                  : "Copy room code"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
