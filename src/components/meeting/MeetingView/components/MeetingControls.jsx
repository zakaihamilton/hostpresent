import { DiagnosticsPopup } from "@/components/meeting/DiagnosticsPopup";
import { Toolbar } from "@/components/meeting/Toolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function MeetingControls({
  confirmDialogProps,
  diagnosticsProps,
  toolbarProps,
}) {
  return (
    <>
      <ConfirmDialog {...confirmDialogProps} />
      <DiagnosticsPopup {...diagnosticsProps} />
      <Toolbar {...toolbarProps} />
    </>
  );
}
