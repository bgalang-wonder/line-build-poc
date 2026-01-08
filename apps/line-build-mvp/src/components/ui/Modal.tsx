'use client';

import React, { useEffect, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal size options
 */
const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
} as const;

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  /**
   * Callback when modal should close
   */
  onClose: () => void;
  /**
   * Modal width size
   * @default 'md'
   */
  size?: keyof typeof modalSizes;
  /**
   * Close when clicking outside the modal content
   * @default true
   */
  closeOnOutsideClick?: boolean;
  /**
   * Close when pressing Escape key
   * @default true
   */
  closeOnEscape?: boolean;
  /**
   * Modal content
   */
  children: React.ReactNode;
  /**
   * Additional class names for the modal container
   */
  className?: string;
}

/**
 * Modal Component
 *
 * A dialog/modal component with backdrop blur, keyboard handling,
 * and click-outside-to-close behavior. Uses React Portal to render
 * at the document body level.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
 *
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
 *   <ModalHeader onClose={() => setIsOpen(false)}>
 *     Modal Title
 *   </ModalHeader>
 *   <ModalBody>
 *     <p>Modal content goes here...</p>
 *   </ModalBody>
 *   <ModalFooter>
 *     <Button variant="ghost" onClick={() => setIsOpen(false)}>
 *       Cancel
 *     </Button>
 *     <Button>Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  children,
  className = '',
}) => {
  // Handle escape key
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && closeOnOutsideClick) {
        onClose();
      }
    },
    [closeOnOutsideClick, onClose]
  );

  // Add/remove escape key listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  // Don't render anything if not open
  if (!isOpen) {
    return null;
  }

  // SSR safety check
  if (typeof window === 'undefined') {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Modal content */}
      <div
        className={`relative w-full ${modalSizes[size]} bg-white rounded-xl shadow-xl transform transition-all ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

Modal.displayName = 'Modal';

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Show close button
   * @default false
   */
  showCloseButton?: boolean;
  /**
   * Callback for close button click
   */
  onClose?: () => void;
}

/**
 * ModalHeader Component
 *
 * Header section for Modal with optional close button.
 *
 * @example
 * ```tsx
 * <ModalHeader onClose={handleClose} showCloseButton>
 *   <h2 className="text-lg font-semibold">Modal Title</h2>
 * </ModalHeader>
 * ```
 */
const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className = '', showCloseButton = false, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-b border-neutral-200 flex items-center justify-between ${className}`}
        {...props}
      >
        <div className="flex-1">{children}</div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="ml-4 p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

export type ModalBodyProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * ModalBody Component
 *
 * Main content area of the Modal.
 *
 * @example
 * ```tsx
 * <ModalBody>
 *   <p>Your modal content here...</p>
 * </ModalBody>
 * ```
 */
const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalBody.displayName = 'ModalBody';

export type ModalFooterProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * ModalFooter Component
 *
 * Footer section for Modal actions.
 *
 * @example
 * ```tsx
 * <ModalFooter>
 *   <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
 *   <Button onClick={handleConfirm}>Confirm</Button>
 * </ModalFooter>
 * ```
 */
const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';

export { Modal, ModalHeader, ModalBody, ModalFooter };
export default Modal;
