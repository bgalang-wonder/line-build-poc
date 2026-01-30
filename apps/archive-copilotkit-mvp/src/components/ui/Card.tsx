import React, { forwardRef } from 'react';

/**
 * Card variant styles
 */
const cardVariants = {
  default: 'bg-white shadow-sm',
  elevated: 'bg-white shadow-lg shadow-neutral-900/5',
  bordered: 'bg-white border border-neutral-200',
} as const;

/**
 * Card padding styles
 */
const cardPadding = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: keyof typeof cardVariants;
  /**
   * Internal padding
   * @default 'md'
   */
  padding?: keyof typeof cardPadding;
}

/**
 * Card Component
 *
 * A flexible container component with multiple visual variants.
 * Follows enterprise "quiet confidence" design with layered shadows
 * and warm neutral colors.
 *
 * @example
 * ```tsx
 * // Default card with medium padding
 * <Card>
 *   <CardHeader>Title</CardHeader>
 *   <CardBody>Content goes here</CardBody>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 *
 * // Elevated card with large padding
 * <Card variant="elevated" padding="lg">
 *   Elevated content
 * </Card>
 *
 * // Bordered card with no padding (for custom layouts)
 * <Card variant="bordered" padding="none">
 *   <div className="p-6">Custom padded content</div>
 * </Card>
 * ```
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl ${cardVariants[variant]} ${cardPadding[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * CardHeader Component
 *
 * Header section for Card with bottom border separator.
 * Use for titles, actions, or any header content.
 *
 * @example
 * ```tsx
 * <CardHeader>
 *   <h2 className="text-lg font-semibold">Card Title</h2>
 * </CardHeader>
 * ```
 */
const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 border-b border-neutral-200 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * CardBody Component
 *
 * Main content area of the Card.
 *
 * @example
 * ```tsx
 * <CardBody>
 *   <p>Your main content here</p>
 * </CardBody>
 * ```
 */
const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * CardFooter Component
 *
 * Footer section for Card with top border separator.
 * Use for actions, metadata, or any footer content.
 *
 * @example
 * ```tsx
 * <CardFooter className="flex justify-end gap-2">
 *   <Button variant="ghost">Cancel</Button>
 *   <Button>Save</Button>
 * </CardFooter>
 * ```
 */
const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 border-t border-neutral-200 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardBody, CardFooter };
export default Card;
