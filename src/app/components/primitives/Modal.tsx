/**
 * Modal
 *
 * Base modal primitive. Portals to document.body, closes on Escape and
 * overlay click (both opt-out). Use this for every dialog/modal in the app
 * — direct `fixed inset-0 ... bg-black/50` overlays are banned by the
 * frontend rules.
 *
 * Typical usage:
 *
 *   <Modal open={open} onClose={close} size={ModalSize.Md} title="Add file">
 *     <Modal.Body>...</Modal.Body>
 *     <Modal.Footer>...</Modal.Footer>
 *   </Modal>
 *
 * For non-standard headers (custom icon area, multi-step nav, danger
 * banner, etc.) pass `title={undefined}` and put a `<Modal.Header>` (or any
 * element) as the first child.
 */

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export enum ModalSize {
  Sm = 'sm',
  Md = 'md',
  Lg = 'lg',
  Xl = 'xl',
  X2 = '2xl',
  X4 = '4xl',
  X7 = '7xl',
}

const SIZE_TO_CLASS: Record<ModalSize, string> = {
  [ModalSize.Sm]: 'max-w-sm',
  [ModalSize.Md]: 'max-w-md',
  [ModalSize.Lg]: 'max-w-lg',
  [ModalSize.Xl]: 'max-w-xl',
  [ModalSize.X2]: 'max-w-2xl',
  [ModalSize.X4]: 'max-w-4xl',
  [ModalSize.X7]: 'max-w-7xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Width preset; defaults to Md. */
  size?: ModalSize;
  /** Convenience header. Omit and render `<Modal.Header>` (or anything) as
   *  a child for custom layouts. */
  title?: ReactNode;
  /** Optional icon shown next to the title. Ignored when `title` is omitted. */
  titleIcon?: ReactNode;
  /** Close on backdrop click. Default true. */
  closeOnOverlayClick?: boolean;
  /** Close on Escape key. Default true. */
  closeOnEscape?: boolean;
  /** Cap height to viewport and let body scroll. Default true. */
  scrollable?: boolean;
  /** Extra classes for the content card (rare — prefer `size`). */
  contentClassName?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  size = ModalSize.Md,
  title,
  titleIcon,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  scrollable = true,
  contentClassName = '',
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const sizeClass = SIZE_TO_CLASS[size];
  const heightClass = scrollable ? 'max-h-[90vh] flex flex-col' : '';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`w-full mx-4 rounded-lg border border-border bg-card shadow-xl ${sizeClass} ${heightClass} ${contentClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <ModalHeader icon={titleIcon} onClose={onClose}>
            {title}
          </ModalHeader>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  icon?: ReactNode;
  /** When provided, renders a close button. */
  onClose?: () => void;
  className?: string;
}

function ModalHeader({ children, icon, onClose, className = '' }: ModalHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-3 border-b border-border ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <h3 className="text-base font-semibold text-foreground truncate">{children}</h3>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 rounded text-muted-foreground hover:bg-muted shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

function ModalBody({ children, className = '' }: ModalBodyProps) {
  return <div className={`px-5 py-4 overflow-auto ${className}`}>{children}</div>;
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`flex items-center justify-end gap-2 px-5 py-3 border-t border-border ${className}`}
    >
      {children}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
