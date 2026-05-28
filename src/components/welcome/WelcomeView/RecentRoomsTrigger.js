"use client";

import { useState } from "react";
import { RecentRoomsPopup } from "@/components/Widgets";
import shared from "./WelcomeShared.module.css";

export function RecentRoomsTrigger({
  rooms,
  activeToken,
  tokenKey,
  formatLabel,
  onSelect,
  onClear,
  onRemove,
  emptyMessage,
  title = "Recent rooms",
}) {
  const [open, setOpen] = useState(false);
  const countLabel = rooms.length === 0 ? "none" : String(rooms.length);

  return (
    <>
      <div className={shared.recentTriggerRow}>
        <button
          type="button"
          className={`${shared.button} ${shared.buttonSecondary}`}
          onClick={() => setOpen(true)}
        >
          {title} ({countLabel})
        </button>
      </div>

      <RecentRoomsPopup
        rooms={rooms}
        activeToken={activeToken}
        tokenKey={tokenKey}
        formatLabel={formatLabel}
        onSelect={onSelect}
        onClear={onClear}
        onRemove={onRemove}
        open={open}
        onOpenChange={setOpen}
        emptyMessage={emptyMessage}
        title={title}
      />
    </>
  );
}
