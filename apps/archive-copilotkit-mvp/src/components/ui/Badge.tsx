import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Badge component variants using class-variance-authority
 *
 * Implements subtle, professional colors following
 * enterprise "quiet confidence" design.
 */
const badgeVariants = cva(
  // Base styles
  'inline-flex items-center font-medium rounded-md border',
  {
    variants: {
      variant: {
        default: 'bg-neutral-100 text-neutral-700 border-neutral-300',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        danger: 'bg-red-50 text-red-700 border-red-200',
        info: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Optional left icon/element
   */
  leftIcon?: React.ReactNode;
  /**
   * Optional right icon/element
   */
  rightIcon?: React.ReactNode;
}

/**
 * Badge Component
 *
 * A small label component for status indicators, counts, or categories.
 * Follows enterprise "quiet confidence" design with subtle, refined colors.
 *
 * @example
 * ```tsx
 * // Default badge
 * <Badge>Default</Badge>
 *
 * // Success badge, small size
 * <Badge variant="success" size="sm">Active</Badge>
 *
 * // Warning badge with icon
 * <Badge variant="warning" leftIcon={<AlertIcon />}>Pending</Badge>
 *
 * // Danger badge for errors
 * <Badge variant="danger">Failed</Badge>
 *
 * // Info badge for informational content
 * <Badge variant="info">New</Badge>
 * ```
 */
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant, size, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`${badgeVariants({ variant, size })} ${className}`}
        {...props}
      >
        {leftIcon && <span className="mr-1 -ml-0.5">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-1 -mr-0.5">{rightIcon}</span>}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export default Badge;
