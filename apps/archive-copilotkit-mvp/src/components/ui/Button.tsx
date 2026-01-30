'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Button component variants using class-variance-authority
 *
 * Implements an enterprise "quiet confidence" design with:
 * - Deep indigo primary colors
 * - Warm neutrals for secondary/ghost
 * - Layered shadows and smooth transitions
 */
const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus:ring-indigo-500 shadow-sm hover:shadow-md',
        secondary:
          'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 active:bg-neutral-400 focus:ring-neutral-400',
        ghost:
          'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-neutral-400',
        danger:
          'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-sm hover:shadow-md',
      },
      size: {
        sm: 'text-sm px-3 py-1.5 gap-1.5',
        md: 'text-sm px-4 py-2 gap-2',
        lg: 'text-base px-6 py-3 gap-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Spinner component for loading state
 */
const Spinner = ({ className = '' }: { className?: string }) => (
  <svg
    className={`animate-spin h-4 w-4 ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Shows a loading spinner and disables the button
   */
  loading?: boolean;
  /**
   * Content to display before the button text
   */
  leftIcon?: React.ReactNode;
  /**
   * Content to display after the button text
   */
  rightIcon?: React.ReactNode;
}

/**
 * Button Component
 *
 * A versatile button component with multiple variants and sizes.
 * Follows enterprise "quiet confidence" design with deep indigo primary
 * and warm neutral secondary colors.
 *
 * @example
 * ```tsx
 * // Primary button (default)
 * <Button>Click me</Button>
 *
 * // Secondary button, large size
 * <Button variant="secondary" size="lg">Secondary</Button>
 *
 * // Ghost button with loading state
 * <Button variant="ghost" loading>Loading...</Button>
 *
 * // Danger button with icon
 * <Button variant="danger" leftIcon={<TrashIcon />}>Delete</Button>
 * ```
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant,
      size,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`${buttonVariants({ variant, size })} ${className}`}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Spinner className={variant === 'primary' || variant === 'danger' ? 'text-white' : 'text-neutral-600'} />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
