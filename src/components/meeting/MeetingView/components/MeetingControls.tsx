import { DiagnosticsPopup } from "@/components/meeting/DiagnosticsPopup";
import { Toolbar } from "@/components/meeting/Toolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function MeetingControls({
  confirmDialogProps,
  diagnosticsProps,
  toolbarProps,
}: {
  confirmDialogProps?: any;
  diagnosticsProps?: any;
  toolbarProps?: any;
}) {
  return (
    <>
      <ConfirmDialog {...confirmDialogProps} />
      <DiagnosticsPopup {...diagnosticsProps} />
      <Toolbar {...toolbarProps} />
    </>
  );
}
