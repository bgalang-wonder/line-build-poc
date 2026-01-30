'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  getConcepts,
  getMenuItems,
  searchMenuItems,
  getMenuItemsByConcept,
  type BOMItem,
  type Concept,
} from '@/lib/model/data/mockBom';

export interface MenuItemSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (menuItem: BOMItem) => void;
}

/**
 * MenuItemSelector Component
 *
 * A modal dialog for selecting a menu item before creating a line build.
 * Features:
 * - Search input with typeahead functionality
 * - Concept filter dropdown
 * - Selectable list showing item name, ID, and concept name
 * - Cancel button to close without selection
 *
 * Follows "Quiet Confidence" enterprise design with deep indigo primary
 * and warm neutral colors.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <MenuItemSelector
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSelect={(menuItem) => {
 *     console.log('Selected:', menuItem);
 *     setIsOpen(false);
 *   }}
 * />
 * ```
 */
export function MenuItemSelector({
  isOpen,
  onClose,
  onSelect,
}: MenuItemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const concepts = useMemo(() => getConcepts(), []);
  const allMenuItems = useMemo(() => getMenuItems(), []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedConceptId('');
      setSelectedItemId('');
    }
  }, [isOpen]);

  // Filter menu items based on search query and concept filter
  const filteredMenuItems = useMemo(() => {
    let items = allMenuItems;

    // Filter by concept first
    if (selectedConceptId) {
      items = getMenuItemsByConcept(selectedConceptId);
    }

    // Then filter by search query
    if (searchQuery.trim()) {
      items = searchMenuItems(searchQuery).filter(item =>
        selectedConceptId ? item.conceptId === selectedConceptId : true
      );
    }

    return items;
  }, [searchQuery, selectedConceptId, allMenuItems]);

  const handleItemClick = (item: BOMItem) => {
    setSelectedItemId(item.itemId);
  };

  const handleSelectConfirm = () => {
    const selectedItem = filteredMenuItems.find(
      item => item.itemId === selectedItemId
    );
    if (selectedItem) {
      onSelect(selectedItem);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedItemId) {
      e.preventDefault();
      handleSelectConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader showCloseButton onClose={onClose}>
        <h2 className="text-lg font-semibold text-neutral-900">
          Select Menu Item
        </h2>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <Input
              label="Search"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              helperText="Type to search menu items by name or ID"
            />
          </div>

          {/* Concept Filter Dropdown */}
          <div>
            <label
              htmlFor="concept-filter"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Filter by Concept
            </label>
            <select
              id="concept-filter"
              value={selectedConceptId}
              onChange={(e) => setSelectedConceptId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
            >
              <option value="">All Concepts</option>
              {concepts.map((concept) => (
                <option key={concept.conceptId} value={concept.conceptId}>
                  {concept.conceptName}
                  {concept.description && ` - ${concept.description}`}
                </option>
              ))}
            </select>
          </div>

          {/* Results List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-700">Results</p>
              <p className="text-sm text-neutral-500">
                {filteredMenuItems.length}{' '}
                {filteredMenuItems.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            <div className="border border-neutral-200 rounded-md max-h-96 overflow-y-auto">
              {filteredMenuItems.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <p>No menu items found</p>
                  {searchQuery && (
                    <p className="text-sm mt-1">
                      Try adjusting your search or filter
                    </p>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-neutral-200">
                  {filteredMenuItems.map((item) => (
                    <li key={item.itemId}>
                      <button
                        onClick={() => handleItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                          selectedItemId === item.itemId
                            ? 'bg-indigo-50 border-l-4 border-indigo-600'
                            : 'border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium ${
                                selectedItemId === item.itemId
                                  ? 'text-indigo-900'
                                  : 'text-neutral-900'
                              }`}
                            >
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-neutral-500">
                                ID: {item.itemId}
                              </span>
                              {item.conceptName && (
                                <>
                                  <span className="text-neutral-300">•</span>
                                  <span
                                    className={`text-sm ${
                                      selectedItemId === item.itemId
                                        ? 'text-indigo-700'
                                        : 'text-neutral-600'
                                    }`}
                                  >
                                    {item.conceptName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSelectConfirm}
          disabled={!selectedItemId}
        >
          Select Item
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default MenuItemSelector;
