import { DisplayNameField } from "@/components/ui/DisplayNameField";
import hs from "./WelcomeHostPanel.module.css";
import shared from "./WelcomeShared.module.css";

export function HostSessionDetails({
  sessionTitle,
  handleSessionTitleChange,
  displayName,
  handleDisplayNameChange,
}) {
  return (
    <>
      <div className={hs.titleField}>
        <label className={shared.label} htmlFor="session-title">
          Session title
        </label>
        <input
          id="session-title"
          className={hs.titleInput}
          value={sessionTitle}
          onChange={(e) => handleSessionTitleChange(e.target.value)}
          placeholder="e.g. Weekly Standup"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
        />
        <p className={shared.helpText}>
          This also becomes the default recording file name.
        </p>
      </div>

      <DisplayNameField
        id="host-display-name"
        label="Your name"
        value={displayName}
        onChange={handleDisplayNameChange}
        placeholder="How should participants see you?"
      />
    </>
  );
}
