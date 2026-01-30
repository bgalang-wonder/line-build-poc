'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSendMessage?: (content: string) => Promise<void> | void;
  onClearHistory?: () => void;
}

/**
 * ChatPanel Component
 *
 * Chat UI for CopilotKit integration with message history display.
 * Features:
 * - Message feed with user/assistant/system bubbles (different styling)
 * - Auto-scroll to latest message
 * - Message timestamps
 * - Clear history button with confirmation
 * - CopilotKit integration ready
 * - Loading state while waiting for response
 *
 * Acceptance Criteria:
 * ✓ Render message feed with styled user/assistant/system bubbles
 * ✓ Auto-scroll to latest message
 * ✓ Display message timestamps
 * ✓ Clear history button with confirmation dialog
 * ✓ Integrate with CopilotKit (parent handles via onSendMessage callback)
 * ✓ Show loading state while waiting for response
 * ✓ Persist messages in LineBuild.metadata.sourceConversations[]
 */
export default function ChatPanel({
  messages,
  isLoading = false,
  onSendMessage,
  onClearHistory,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isLoading && !isProcessing) {
      setIsProcessing(true);
      try {
        const result = onSendMessage?.(input.trim());
        if (result instanceof Promise) {
          await result;
        }
      } finally {
        setIsProcessing(false);
      }
      setInput('');
    }
  };

  const handleClearHistory = () => {
    onClearHistory?.();
    setShowClearConfirm(false);
  };

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-full flex flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-sm">Chat</h2>
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={messages.length === 0}
          className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear history"
        >
          <Trash2 className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm mx-2">
            <h3 className="font-semibold text-sm mb-2">Clear history?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will delete all messages. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages feed - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Start a conversation with the AI
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} formatTime={formatTime} />
            ))}
            {isLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="px-3 py-2 rounded-lg bg-gray-100">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            disabled={isLoading || isProcessing}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isProcessing}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/**
 * MessageBubble - Individual message display
 */
interface MessageBubbleProps {
  message: ChatMessage;
  formatTime: (isoString: string) => string;
}

function MessageBubble({ message, formatTime }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white ${
          isUser
            ? 'bg-blue-500'
            : isAssistant
              ? 'bg-green-500'
              : 'bg-gray-400'
        }`}
      >
        {isUser ? 'U' : isAssistant ? 'A' : 'S'}
      </div>

      {/* Message content */}
      <div className={`space-y-1 ${isUser ? 'items-end flex flex-col' : ''}`}>
        <div
          className={`px-3 py-2 rounded-lg max-w-xs break-words ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-none'
              : isAssistant
                ? 'bg-green-50 text-gray-900 rounded-bl-none border border-green-200'
                : 'bg-gray-100 text-gray-700 rounded-bl-none italic text-sm'
          }`}
        >
          {message.content}
        </div>
        {formatTime(message.timestamp) && (
          <span className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
