import { useCallback, useRef, useState } from "react";

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    ({
      title,
      message,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      variant = "default",
    }) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialogState({
          title,
          message,
          confirmLabel,
          cancelLabel,
          variant,
        });
      }),
    [],
  );

  const closeDialog = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialogState(null);
  }, []);

  const handleConfirm = useCallback(() => {
    closeDialog(true);
  }, [closeDialog]);

  const handleCancel = useCallback(() => {
    closeDialog(false);
  }, [closeDialog]);

  return {
    confirm,
    dialogProps: dialogState
      ? {
          ...dialogState,
          open: true,
          onConfirm: handleConfirm,
          onCancel: handleCancel,
        }
      : { open: false, onConfirm: handleConfirm, onCancel: handleCancel },
  };
}
