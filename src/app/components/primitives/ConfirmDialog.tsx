/**
 * ConfirmDialog
 *
 * Two-button confirmation modal — thin wrapper over `Modal` for
 * destructive or irreversible actions (discard draft, delete space, etc.).
 */

import type { ReactNode } from 'react';
import { Modal, ModalSize } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  message: ReactNode;
  title?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClasses = danger
    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
    : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <Modal open={open} onClose={onCancel} size={ModalSize.Sm} title={title}>
      <Modal.Body className="text-sm text-foreground">{message}</Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded px-4 py-1.5 text-sm font-medium ${confirmClasses}`}
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
