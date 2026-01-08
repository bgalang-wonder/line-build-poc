'use client';

import React from 'react';
import { ComplexityScore } from '@/lib/model/types';

interface ComplexityScoreDisplayProps {
  complexity?: ComplexityScore;
  compact?: boolean; // If true, show minimal display
}

/**
 * ComplexityScoreDisplay Component
 *
 * Displays the complexity score for the current line build with factor breakdown.
 * Shows overall score (0-100) and individual factor scores.
 */
export function ComplexityScoreDisplay({ complexity, compact = false }: ComplexityScoreDisplayProps) {
  if (!complexity) {
    return (
      <div className="text-xs text-gray-400">
        No complexity score
      </div>
    );
  }

  // Determine color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-red-50';
    if (score >= 60) return 'bg-orange-50';
    if (score >= 40) return 'bg-yellow-50';
    return 'bg-green-50';
  };

  if (compact) {
    return (
      <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreBgColor(complexity.overall)} ${getScoreColor(complexity.overall)}`}>
        Complexity: {complexity.overall}/100
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border border-gray-200 ${getScoreBgColor(complexity.overall)}`}>
      {/* Overall Score */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-sm">Complexity Score</h4>
        <span className={`text-2xl font-bold ${getScoreColor(complexity.overall)}`}>
          {complexity.overall}/100
        </span>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Work Variety:</span>
          <span className="font-medium">{complexity.factors.workVariety}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Equipment Variety:</span>
          <span className="font-medium">{complexity.factors.equipmentVariety}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Station Changes:</span>
          <span className="font-medium">{complexity.factors.stationChanges}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Time Breakdown:</span>
          <span className="font-medium">{complexity.factors.timeBreakdown}</span>
        </div>
      </div>

      {/* Last Updated */}
      <p className="text-xs text-gray-500 mt-2">
        Updated: {new Date(complexity.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}
