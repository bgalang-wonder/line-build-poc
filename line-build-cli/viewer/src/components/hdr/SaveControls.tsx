"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";

interface SaveControlsProps {
  onSave: () => Promise<void>;
  onSaveAs: (newName: string) => Promise<void>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
}

export default function SaveControls({
  onSave,
  onSaveAs,
  hasUnsavedChanges,
  isSaving,
}: SaveControlsProps) {
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");

  const handleSaveAs = async () => {
    if (!newConfigName.trim()) return;
    await onSaveAs(newConfigName.trim());
    setShowSaveAsModal(false);
    setNewConfigName("");
  };

  return (
    <div className="flex items-center gap-4">
      {hasUnsavedChanges && (
        <span className="flex items-center gap-2 text-sm text-amber-600">
          <span className="w-2 h-2 rounded-full bg-amber-600"></span>
          Unsaved changes
        </span>
      )}

      <Button onClick={onSave} disabled={isSaving || !hasUnsavedChanges} variant="primary">
        {isSaving ? "Saving..." : "Save"}
      </Button>

      <Button
        onClick={() => setShowSaveAsModal(true)}
        disabled={isSaving}
        variant="secondary"
      >
        Save As...
      </Button>

      {showSaveAsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save As New Configuration</h3>
            <input
              type="text"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              placeholder="Enter configuration name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveAs} disabled={!newConfigName.trim()} variant="primary">
                Save
              </Button>
              <Button onClick={() => setShowSaveAsModal(false)} variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
