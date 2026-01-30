import React, { forwardRef, createContext, useContext } from 'react';

/**
 * Table context for passing down sticky state
 */
const TableContext = createContext<{ sticky?: boolean }>({});

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /**
   * Enable sticky header behavior
   * @default false
   */
  sticky?: boolean;
}

/**
 * Table Component
 *
 * A data table component with sticky header support and warm hover states.
 * Follows enterprise "quiet confidence" design with clean borders
 * and professional styling.
 *
 * @example
 * ```tsx
 * // Basic table
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Name</TableHead>
 *       <TableHead>Email</TableHead>
 *       <TableHead>Status</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>John Doe</TableCell>
 *       <TableCell>john@example.com</TableCell>
 *       <TableCell>Active</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 *
 * // Table with sticky header (wrap in overflow container)
 * <div className="max-h-96 overflow-auto">
 *   <Table sticky>
 *     <TableHeader>...</TableHeader>
 *     <TableBody>...</TableBody>
 *   </Table>
 * </div>
 * ```
 */
const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', sticky = false, children, ...props }, ref) => {
    return (
      <TableContext.Provider value={{ sticky }}>
        <div className="w-full overflow-auto">
          <table
            ref={ref}
            className={`w-full text-sm border-collapse ${className}`}
            {...props}
          >
            {children}
          </table>
        </div>
      </TableContext.Provider>
    );
  }
);

Table.displayName = 'Table';

export type TableHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>;

/**
 * TableHeader Component
 *
 * Header section of the table. Supports sticky positioning
 * when Table has sticky prop enabled.
 */
const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    const { sticky } = useContext(TableContext);

    const stickyStyles = sticky ? 'sticky top-0 z-10' : '';

    return (
      <thead
        ref={ref}
        className={`bg-neutral-50 border-b border-neutral-200 ${stickyStyles} ${className}`}
        {...props}
      >
        {children}
      </thead>
    );
  }
);

TableHeader.displayName = 'TableHeader';

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;

/**
 * TableBody Component
 *
 * Body section of the table containing data rows.
 */
const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`divide-y divide-neutral-200 ${className}`}
        {...props}
      >
        {children}
      </tbody>
    );
  }
);

TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Disable hover effect for this row
   * @default false
   */
  noHover?: boolean;
}

/**
 * TableRow Component
 *
 * A table row with warm hover states for better interactivity.
 */
const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className = '', noHover = false, children, ...props }, ref) => {
    const hoverStyles = noHover ? '' : 'hover:bg-neutral-50 transition-colors';

    return (
      <tr
        ref={ref}
        className={`${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

export type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

/**
 * TableHead Component
 *
 * Header cell for column titles. Uses uppercase text
 * with subtle styling for hierarchy.
 */
const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

/**
 * TableCell Component
 *
 * Standard table cell for data display.
 */
const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`px-4 py-3 text-neutral-700 ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
