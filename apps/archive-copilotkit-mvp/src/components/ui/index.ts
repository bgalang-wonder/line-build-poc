/**
 * UI Component Library
 *
 * A collection of reusable UI components following the
 * enterprise "quiet confidence" design system.
 *
 * Design tokens:
 * - Primary: Deep indigo (indigo-600/700)
 * - Neutrals: Warm neutral palette
 * - Shadows: Layered for depth
 * - Borders: Subtle neutral-200
 *
 * @example
 * ```tsx
 * import { Button, Card, CardHeader, CardBody, Badge } from '@/components/ui';
 * ```
 */

// Button
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

// Card
export { Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card';

// Badge
export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

// Input
export { Input } from './Input';
export type { InputProps } from './Input';

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './Table';
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
} from './Table';

// Modal
export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps } from './Modal';

// Toast (existing)
export { Toast, ToastContainer } from './Toast';
export type { ToastProps, ToastContainerProps } from './Toast';
