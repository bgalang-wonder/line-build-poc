'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getAllBOMItems, findBOMItem, getItemTypeFromId } from '@/lib/model/data/mockBom';
import { ChevronDown } from 'lucide-react';

interface BOMAutocompleteProps {
  selectedBomId?: string;
  onChange?: (bomId: string, bomName: string) => void;
  filterByType?: string[]; // Filter to specific item types (e.g., ['40*'] for consumables)
}

interface BOMItem {
  itemId: string;
  name: string;
}

/**
 * BOMAutocomplete Component
 *
 * Searchable dropdown for selecting BOM items from the mock catalog.
 * Features:
 * - Real-time filtering by item ID or name
 * - Displays as "itemId: itemName" format
 * - Minimum 2-character search before showing results
 * - Keyboard navigation (arrow keys, enter)
 * - Optional filtering by item type prefix
 * - Graceful handling of no results
 *
 * Item ID Format (from Cookbook):
 * - 5* = Ingredients (raw)
 * - 40* = Consumable Items (in menu item BOMs)
 * - 80* = Menu items
 * - 88* = Packaged goods
 * - 9* = Packaging items
 *
 * Acceptance Criteria:
 * ✓ Searchable dropdown filtering mock BOM data
 * ✓ Filters as user types (ID or name match)
 * ✓ Display format: 'itemId: itemName'
 * ✓ Selecting item populates WorkUnit.target.bomId
 * ✓ Handles zero results gracefully
 * ✓ Keyboard navigation (arrow keys, enter)
 * ✓ Minimum 2-char search
 * ✓ Optional type filtering
 */
export default function BOMAutocomplete({
  selectedBomId,
  onChange,
  filterByType,
}: BOMAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all BOM items
  const allBOMItems = getAllBOMItems();

  // Filter by type if specified
  const availableItems = filterByType
    ? allBOMItems.filter((item) => {
        const prefix = getItemTypeFromId(item.itemId);
        return filterByType.some((type) => prefix === type);
      })
    : allBOMItems;

  // Filter by search query (minimum 2 characters)
  const filteredItems =
    searchQuery.length < 2
      ? []
      : availableItems.filter(
          (item) =>
            item.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

  // Get selected item label
  const selectedItemLabel = selectedBomId
    ? (() => {
        const item = findBOMItem(selectedBomId);
        return item ? `${item.itemId}: ${item.name}` : selectedBomId;
      })()
    : '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[highlightedIndex]) {
            handleSelectItem(filteredItems[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, highlightedIndex, filteredItems]);

  /**
   * Handle selecting an item
   */
  const handleSelectItem = (item: BOMItem) => {
    onChange?.(item.itemId, item.name);
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  /**
   * Get type label for display
   */
  const getTypeLabel = (itemId: string): string => {
    const prefix = getItemTypeFromId(itemId);
    const typeMap: { [key: string]: string } = {
      '5': 'Ingredient',
      '40': 'Consumable',
      '80': 'Menu Item',
      '88': 'Packaged Good',
      '9': 'Packaging',
    };
    return (prefix && typeMap[prefix]) || 'Item';
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        BOM Item
      </label>

      {/* Input / Display field */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer flex items-center justify-between hover:border-gray-400 transition-colors"
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by ID or name (min 2 chars)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 outline-none text-sm bg-transparent"
            autoFocus
          />
        ) : (
          <span className="text-sm text-gray-700">
            {selectedItemLabel || 'Select BOM item...'}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-600 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Search info */}
      {!isOpen && (
        <p className="text-xs text-gray-500 mt-1">
          Search by item ID (e.g., 4001234) or name
        </p>
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          {/* Search threshold notice */}
          {searchQuery.length < 2 && (
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
              Type at least 2 characters to search
            </div>
          )}

          {/* Results list */}
          <div className="max-h-64 overflow-y-auto">
            {searchQuery.length < 2 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Type to search...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching items found
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredItems.map((item, index) => (
                  <li key={item.itemId}>
                    <button
                      onClick={() => handleSelectItem(item)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        index === highlightedIndex
                          ? 'bg-blue-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-900">
                          {item.itemId}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {item.name}
                        </div>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded ml-2 flex-shrink-0">
                        {getTypeLabel(item.itemId)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
