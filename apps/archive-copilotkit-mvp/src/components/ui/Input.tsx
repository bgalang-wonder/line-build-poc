'use client';

import React, { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label text displayed above the input
   */
  label?: string;
  /**
   * Error message - when provided, input shows error styling
   */
  error?: string;
  /**
   * Helper text displayed below the input
   */
  helperText?: string;
  /**
   * Additional class names for the input element
   */
  inputClassName?: string;
  /**
   * Additional class names for the wrapper div
   */
  wrapperClassName?: string;
}

/**
 * Input Component
 *
 * A form input component with label, error, and helper text support.
 * Follows enterprise "quiet confidence" design with indigo focus states
 * and warm neutral colors.
 *
 * @example
 * ```tsx
 * // Basic input with label
 * <Input label="Email" placeholder="Enter your email" />
 *
 * // Input with helper text
 * <Input
 *   label="Username"
 *   helperText="Must be 3-20 characters"
 * />
 *
 * // Input with error state
 * <Input
 *   label="Password"
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 *
 * // Disabled input
 * <Input label="Read Only" value="Cannot edit" disabled />
 * ```
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      inputClassName = '',
      wrapperClassName = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    // Generate a unique ID if not provided
    const generatedId = useId();
    const inputId = id || generatedId;

    const baseInputStyles =
      'w-full px-3 py-2 border rounded-md bg-white text-neutral-900 placeholder:text-neutral-400 transition-colors duration-200';

    const focusStyles = error
      ? 'focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500'
      : 'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

    const borderStyles = error ? 'border-red-500' : 'border-neutral-300';

    const disabledStyles = disabled
      ? 'opacity-50 cursor-not-allowed bg-neutral-50'
      : '';

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`${baseInputStyles} ${focusStyles} ${borderStyles} ${disabledStyles} ${inputClassName} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-red-500 mt-1" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-neutral-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
