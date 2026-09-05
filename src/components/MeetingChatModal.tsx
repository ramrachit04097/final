import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
  Bot,
  User,
  RotateCcw,
} from 'lucide-react';
import { TranscriptRecord } from '../types';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface MeetingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: TranscriptRecord | null;
  onShowToast?: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

const SUGGESTED_QUESTIONS = [
  'What were the main points discussed?',
  'What tasks were assigned?',
  'What are the upcoming deadlines?',
  'What decisions were made?',
];

export const MeetingChatModal: React.FC<MeetingChatModalProps> = ({
  isOpen,
  onClose,
  transcript,
  onShowToast,
}) => {
  // Store chat history isolated per transcript ID
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Active in-flight request ID tracker to prevent race conditions and cross-meeting leakage
  const activeRequestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const transcriptId = transcript?.id || 'temp';
  const currentMessages = transcript ? conversations[transcriptId] || [] : [];

  // Determine transcript readiness
  const hasTranscript = Boolean(transcript && transcript.transcriptText);
  const transcriptContentLength = transcript?.transcriptText ? transcript.transcriptText.trim().length : 0;
  const isTranscriptEmpty = !hasTranscript || transcriptContentLength === 0;
  const isTranscriptTooShort = !isTranscriptEmpty && transcriptContentLength < 15;
  const isChatDisabled = isTranscriptEmpty || isTranscriptTooShort;

  // Auto-scroll to newest message smoothly
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Focus input on open if chat is ready
      setTimeout(() => {
        if (inputRef.current && !isChatDisabled) {
          inputRef.current.focus();
        }
        scrollToBottom(false);
      }, 150);
    }
  }, [isOpen, transcriptId, isChatDisabled, scrollToBottom]);

  // Whenever messages or loading state changes, smoothly scroll down
  useEffect(() => {
    if (isOpen) {
      scrollToBottom(true);
    }
  }, [currentMessages.length, isLoading, isOpen, scrollToBottom]);

  // Handle closing and reset in-flight flags
  const handleClose = () => {
    activeRequestIdRef.current = null;
    setIsLoading(false);
    onClose();
  };

  // Reset conversation for this specific transcript
  const handleClearSession = () => {
    if (!transcript) return;
    activeRequestIdRef.current = null;
    setIsLoading(false);
    setConversations((prev) => ({
      ...prev,
      [transcriptId]: [],
    }));
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputValue;
    const question = rawText.trim();

    if (!question || !transcript || isChatDisabled || isLoading) {
      return;
    }

    // Clear input immediately to prevent duplicate sends
    setInputValue('');

    const userMessageId = `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append user message to this transcript's history
    const previousHistory = conversations[transcriptId] || [];
    const updatedHistory = [...previousHistory, userMessage];

    setConversations((prev) => ({
      ...prev,
      [transcriptId]: updatedHistory,
    }));

    setIsLoading(true);

    // Track request ID to protect against unmounts and meeting switches
    const thisRequestId = `${transcriptId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    activeRequestIdRef.current = thisRequestId;

    try {
      // Prepare history formatted for API (up to last 8 turns)
      const historyForApi = previousHistory.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await api.chatWithTranscript({
        transcriptId: transcript.id,
        question,
        history: historyForApi,
        meetingTitle: transcript.meetingTitle,
        meetingDate: transcript.recordedAt,
        durationSeconds: transcript.durationSeconds,
        rawTranscriptText: transcript.transcriptText,
      });

      // Verify this request is still the active one for this transcript
      if (activeRequestIdRef.current !== thisRequestId) {
        return;
      }

      const aiMessage: ChatMessage = {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: res.answer || "I couldn't find that information in this meeting transcript.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) => ({
        ...prev,
        [transcriptId]: [...(prev[transcriptId] || []), aiMessage],
      }));
    } catch (err: any) {
      // Verify request is still active
      if (activeRequestIdRef.current !== thisRequestId) {
        return;
      }

      const errorMessageText =
        typeof err?.message === 'string' && !err.message.includes('object') && !err.message.includes('fetch')
          ? err.message
          : "Sorry, I couldn't process that right now. Please try again.";

      const aiErrorMessage: ChatMessage = {
        id: `msg_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: errorMessageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) => ({
        ...prev,
        [transcriptId]: [...(prev[transcriptId] || []), aiErrorMessage],
      }));

      if (onShowToast) {
        onShowToast('Notice', "Sorry, I couldn't process that right now. Please try again.", 'warning');
      }
    } finally {
      if (activeRequestIdRef.current === thisRequestId) {
        setIsLoading(false);
        activeRequestIdRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="meeting-chat-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <GlowingEdgeCard
        glowColor="#8b7cff"
        className="w-full max-w-2xl h-[650px] max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-violet-900/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-900/40 border border-violet-700/40 text-violet-300">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Chat with Meeting
              </h2>
            </div>
            <p className="text-xs text-violet-300/80">
              Ask questions about this meeting
            </p>

            {transcript && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-violet-950/60 border border-violet-800/50 text-violet-200">
                  <FileText className="w-3 h-3 text-violet-400" />
                  <span className="max-w-[240px] truncate">{transcript.meetingTitle}</span>
                </span>
                {transcript.recordedAt && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-violet-400 font-mono">
                    <Calendar className="w-3 h-3 text-violet-400" />
                    <span>{transcript.recordedAt.split('T')[0]}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {currentMessages.length > 0 && (
              <button
                type="button"
                onClick={handleClearSession}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-violet-400 hover:text-violet-200 hover:bg-violet-900/30 transition cursor-pointer disabled:opacity-40"
                title="Clear conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-violet-400 hover:text-white hover:bg-violet-900/30 transition cursor-pointer"
              title="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Empty or Invalid Transcript States */}
          {isTranscriptEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">No transcript available for this meeting.</h4>
              <p className="text-xs text-violet-300/60 max-w-sm">
                This meeting does not have transcript text yet. Record or transcribe audio first to start asking questions.
              </p>
            </div>
          ) : isTranscriptTooShort ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">
                There's not enough transcript content to answer questions about this meeting.
              </h4>
              <p className="text-xs text-violet-300/60 max-w-sm">
                The transcript text is too brief or empty to provide accurate answers.
              </p>
            </div>
          ) : currentMessages.length === 0 ? (
            /* Suggested Questions Empty State */
            <div className="h-full flex flex-col justify-center space-y-5 px-2 py-4">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#6d5df5]/15 border border-[#6d5df5]/30 flex items-center justify-center mx-auto text-[#8b7cff]">
                  <Bot className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">What would you like to know?</h3>
                <p className="text-xs text-violet-300/70 max-w-md mx-auto">
                  Ask anything discussed in <span className="text-white font-medium">"{transcript?.meetingTitle}"</span>. All answers are grounded strictly in this meeting's complete raw transcript.
                </p>
              </div>

              <div className="space-y-2 max-w-lg mx-auto w-full">
                <p className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider text-center">
                  Suggested Questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      disabled={isLoading}
                      className="p-2.5 text-left text-xs text-violet-200 bg-[#120e24] hover:bg-[#1a1433] hover:text-white border border-violet-900/40 hover:border-violet-700/60 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8b7cff] group-hover:scale-125 transition-transform" />
                      <span className="line-clamp-2">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages List */
            <div className="space-y-4">
              {currentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-violet-400/80 font-mono px-1">
                    {msg.role === 'user' ? (
                      <>
                        <span>You</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-[#8b7cff]" />
                        <span className="text-[#8b7cff] font-semibold">MeetFlow AI</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`text-xs leading-relaxed rounded-2xl p-3.5 sm:p-4 shadow-sm max-w-[90%] sm:max-w-[85%] whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#6d5df5] text-white rounded-tr-sm'
                        : 'bg-[#120e24] border border-violet-900/40 text-violet-100/90 rounded-tl-sm font-sans'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing / Loading indicator */}
              {isLoading && (
                <div className="flex flex-col items-start space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#8b7cff] font-mono px-1">
                    <Bot className="w-3 h-3" />
                    <span>MeetFlow AI is thinking...</span>
                  </div>
                  <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[#120e24] border border-violet-900/40 text-xs text-violet-300 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8b7cff]" />
                    <span className="animate-pulse">Reading transcript and preparing answer...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Footer & Input Section */}
        <div className="pt-3 border-t border-violet-900/30 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isChatDisabled || isLoading}
                placeholder={
                  isChatDisabled
                    ? 'Chat unavailable for this transcript'
                    : 'Ask about this meeting... (Press Enter to send, Shift+Enter for newline)'
                }
                rows={2}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0e0a1c] border border-violet-900/50 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500 transition resize-none disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isChatDisabled || isLoading || !inputValue.trim()}
              className="p-3 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
              title="Send question"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-violet-400/60 px-1">
            <span>Informational answers only. Chatbot does not create or modify tasks.</span>
            <span>Scoped to this meeting</span>
          </div>
        </div>
      </GlowingEdgeCard>
    </div>
  );
};
