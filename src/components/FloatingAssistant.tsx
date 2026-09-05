import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  X,
  RotateCcw,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
  Shield,
  User,
  AlertCircle,
} from 'lucide-react';
import { AuthUser } from '../types';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface FloatingAssistantProps {
  user: AuthUser;
  onShowToast?: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

const MANAGER_SUGGESTIONS = [
  'What tasks are overdue?',
  'Who has pending tasks?',
  'What meetings are coming up?',
  'Show my employee workload.',
];

const EMPLOYEE_SUGGESTIONS = [
  'What tasks are assigned to me?',
  'What is due next?',
  'Do I have any overdue tasks?',
  'What are my current alerts?',
];

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({ user, onShowToast }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Store conversation history isolated per user ID and role
  const [conversations, setConversations] = useState<Record<string, AssistantMessage[]>>({});

  const userKey = `${user.role}_${user.userId || user.id}`;
  const currentMessages = conversations[userKey] || [];

  // Track in-flight request to avoid race conditions and stale response injection
  const activeRequestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const isManager = user.role === 'Manager';
  const suggestions = isManager ? MANAGER_SUGGESTIONS : EMPLOYEE_SUGGESTIONS;

  const welcomeMessage = isManager
    ? 'Hi! I’m your MeetFlow assistant. Ask me about your meetings, tasks, employees, deadlines, or alerts.'
    : 'Hi! I’m your MeetFlow assistant. Ask me about your tasks, deadlines, status, or alerts.';

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  // Handle opening and focusing input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
        scrollToBottom(false);
      }, 150);
    } else {
      // Stop speech recognition if user closes panel
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
        setIsListening(false);
      }
    }
  }, [isOpen, scrollToBottom]);

  // Scroll on new messages or loading state
  useEffect(() => {
    if (isOpen) {
      scrollToBottom(true);
    }
  }, [currentMessages.length, isLoading, isOpen, scrollToBottom]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Clear current user's conversation session
  const handleClearSession = () => {
    activeRequestIdRef.current = null;
    setIsLoading(false);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
    setConversations((prev) => ({
      ...prev,
      [userKey]: [],
    }));
  };

  // Voice Recognition Handler (Web Speech API)
  const toggleVoiceInput = () => {
    if (isLoading) return;

    // Check browser compatibility
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg = "Voice input isn't supported in this browser. Please use keyboard input.";
      setSpeechError(msg);
      if (onShowToast) onShowToast('Voice Input', msg, 'warning');
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    if (isListening) {
      // Stop recognition
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const combined = (finalTranscript || interim).trim();
        if (combined) {
          setInputValue((prev) => {
            // Append or replace smoothly
            if (!prev.trim()) return combined;
            if (prev.endsWith(' ')) return prev + combined;
            return prev + ' ' + combined;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          const msg = 'Microphone permission was denied. Please allow microphone access or use keyboard input.';
          setSpeechError(msg);
          if (onShowToast) onShowToast('Microphone Access', msg, 'warning');
          setTimeout(() => setSpeechError(null), 5000);
        } else if (event.error !== 'no-speech') {
          const msg = 'Voice recognition was interrupted. Please try again or type your question.';
          setSpeechError(msg);
          setTimeout(() => setSpeechError(null), 4000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
      const msg = "Voice input isn't supported in this browser. Please use keyboard input.";
      setSpeechError(msg);
      if (onShowToast) onShowToast('Voice Input', msg, 'warning');
      setTimeout(() => setSpeechError(null), 5000);
    }
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputValue;
    const question = rawText.trim();

    if (!question || isLoading) return;

    // Stop listening if active
    if (isListening && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setInputValue('');
    setSpeechError(null);

    const userMessageId = `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userMessage: AssistantMessage = {
      id: userMessageId,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const previousHistory = conversations[userKey] || [];
    const updatedHistory = [...previousHistory, userMessage];

    setConversations((prev) => ({
      ...prev,
      [userKey]: updatedHistory,
    }));

    setIsLoading(true);

    const thisRequestId = `${userKey}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    activeRequestIdRef.current = thisRequestId;

    try {
      // Format previous history for Gemini (last 8 turns)
      const historyForApi = previousHistory.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await api.chatWithAssistant({
        question,
        history: historyForApi,
      });

      // Verify request is still the active one
      if (activeRequestIdRef.current !== thisRequestId) return;

      const aiMessage: AssistantMessage = {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: res.answer || "I couldn't find that information in your MeetFlow data.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) => ({
        ...prev,
        [userKey]: [...(prev[userKey] || []), aiMessage],
      }));
    } catch (err: any) {
      if (activeRequestIdRef.current !== thisRequestId) return;

      const errorMessageText =
        typeof err?.message === 'string' &&
        !err.message.includes('object') &&
        !err.message.includes('fetch')
          ? err.message
          : "Sorry, I couldn't process that right now. Please try again.";

      const aiErrorMessage: AssistantMessage = {
        id: `msg_err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: errorMessageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) => ({
        ...prev,
        [userKey]: [...(prev[userKey] || []), aiErrorMessage],
      }));
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

  return (
    <>
      {/* ========================================================= */}
      {/* 1. FLOATING ACTION BUTTON (DASHBOARD ONLY)                */}
      {/* ========================================================= */}
      <div
        id="floating-assistant-button-container"
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40"
      >
        <button
          type="button"
          id="open-meetflow-assistant-button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group relative flex items-center gap-2.5 px-4 py-3 sm:px-4.5 sm:py-3 rounded-full font-semibold text-white transition-all duration-300 cursor-pointer shadow-lg active:scale-95 ${
            isOpen
              ? 'bg-[#5b4be0] shadow-[0_0_25px_rgba(109,93,245,0.6)] ring-2 ring-violet-400'
              : 'bg-gradient-to-r from-[#6d5df5] via-[#7d6cf6] to-[#8b5cf6] hover:from-[#7b6df7] hover:to-[#996ef8] shadow-[0_8px_30px_rgba(109,93,245,0.45)] hover:shadow-[0_10px_35px_rgba(109,93,245,0.65)] hover:scale-105'
          }`}
          aria-label={isOpen ? 'Close MeetFlow Assistant' : 'Open MeetFlow Assistant'}
          title="MeetFlow AI Assistant"
        >
          {/* Animated subtle glow orb */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-40 blur-sm transition duration-300" />

          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-white animate-in fade-in" />
            ) : (
              <div className="relative">
                <Sparkles className="w-5 h-5 text-violet-100" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0d091b] animate-pulse" />
              </div>
            )}
          </div>

          <span className="relative text-xs sm:text-sm font-medium tracking-wide text-white drop-shadow-sm flex items-center gap-1.5">
            <span>MeetFlow AI</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-white/20 text-white/90">
              {isManager ? 'Manager' : 'Employee'}
            </span>
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2. CHAT PANEL (OPENS UPON CLICKING FLOATING BUTTON)       */}
      {/* ========================================================= */}
      {isOpen && (
        <div
          id="meetflow-assistant-panel"
          className={`fixed bottom-20 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] md:w-[450px] h-[590px] max-h-[82vh] flex flex-col rounded-2xl backdrop-blur-xl border overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            isLight
              ? 'bg-white/98 border-[#E5E7EB] shadow-[0_20px_50px_rgba(15,23,42,0.12)] text-[#111827]'
              : 'bg-[#0e0a1c]/95 border-violet-800/40 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white'
          }`}
        >
          {/* Top Header */}
          <div className={`px-4 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-[#F9FAFB] border-[#E5E7EB]' : 'bg-[#120c24]/90 border-violet-900/30'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8b5cf6] flex items-center justify-center text-white shadow-sm shrink-0">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold tracking-tight truncate ${isLight ? 'text-[#111827]' : 'text-white'}`}>
                    MeetFlow Assistant
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isManager
                        ? isLight
                          ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]'
                          : 'bg-violet-950/70 text-violet-300 border-violet-700/50'
                        : isLight
                          ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'
                    }`}
                  >
                    <Shield className="w-2.5 h-2.5" />
                    <span>{isManager ? 'Manager AI' : 'Personal AI'}</span>
                  </span>
                </div>
                <p className={`text-[11px] truncate ${isLight ? 'text-[#6B7280]' : 'text-violet-300/70'}`}>
                  {isManager
                    ? `${user.companyName} • Authorized Workspace Data`
                    : `${user.name} (${user.userId || user.id}) • Personal Data`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {currentMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSession}
                  disabled={isLoading}
                  className={`p-1.5 rounded-lg transition cursor-pointer disabled:opacity-40 ${
                    isLight
                      ? 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                      : 'text-violet-400 hover:text-violet-200 hover:bg-violet-900/30'
                  }`}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isLight
                    ? 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]'
                    : 'text-violet-400 hover:text-white hover:bg-violet-900/30'
                }`}
                title="Close assistant"
                aria-label="Close assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Voice status banner if error */}
          {speechError && (
            <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 text-[11px] flex items-center gap-2 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="flex-1 leading-tight">{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-amber-600 hover:text-amber-800"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-2">
            {currentMessages.length === 0 ? (
              /* Welcome + Suggested Questions Empty State */
              <div className="h-full flex flex-col justify-center space-y-4.5 py-3">
                <div className="text-center space-y-2 px-2">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center mx-auto shadow-inner ${
                    isLight
                      ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5]'
                      : 'bg-[#6d5df5]/15 border-[#6d5df5]/30 text-[#8b7cff]'
                  }`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className={`text-sm font-semibold ${isLight ? 'text-[#111827]' : 'text-white'}`}>
                    {isManager ? 'Manager Workspace Intelligence' : 'Your Personal Task Assistant'}
                  </h4>
                  <p className={`text-xs leading-relaxed max-w-sm mx-auto ${isLight ? 'text-[#4B5563]' : 'text-violet-200/80'}`}>
                    {welcomeMessage}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider text-center ${
                    isLight ? 'text-[#6B7280]' : 'text-violet-400/90'
                  }`}>
                    Suggested Questions
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 max-w-sm mx-auto w-full">
                    {suggestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(q)}
                        disabled={isLoading}
                        className={`p-2.5 text-left text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-2 group ${
                          isLight
                            ? 'text-[#374151] bg-[#F9FAFB] hover:bg-[#EEF2FF] hover:text-[#4F46E5] border border-[#E5E7EB] hover:border-[#C7D2FE]'
                            : 'text-violet-200 bg-[#130f29] hover:bg-[#1c163a] hover:text-white border border-violet-900/40 hover:border-violet-700/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full group-hover:scale-125 transition-transform shrink-0 ${
                          isLight ? 'bg-[#6366F1]' : 'bg-[#8b7cff]'
                        }`} />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Messages Stream */
              <div className="space-y-3.5">
                {currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-mono px-1 ${
                      isLight ? 'text-[#6B7280]' : 'text-violet-400/80'
                    }`}>
                      {msg.role === 'user' ? (
                        <>
                          <User className={`w-2.5 h-2.5 ${isLight ? 'text-[#6B7280]' : 'text-violet-400'}`} />
                          <span>You</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <Bot className={`w-2.5 h-2.5 ${isLight ? 'text-[#6366F1]' : 'text-[#8b7cff]'}`} />
                          <span className={isLight ? 'text-[#4F46E5] font-semibold' : 'text-[#8b7cff] font-semibold'}>MeetFlow AI</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`text-xs leading-relaxed rounded-2xl p-3.5 shadow-sm max-w-[92%] sm:max-w-[88%] whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#6366F1] text-white rounded-tr-sm shadow-sm'
                          : isLight
                            ? 'bg-[#F3F4F6] border border-[#E5E7EB] text-[#1F2937] rounded-tl-sm font-sans'
                            : 'bg-[#140f2b] border border-violet-900/40 text-violet-100/95 rounded-tl-sm font-sans'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Loading / Generating State */}
                {isLoading && (
                  <div className="flex flex-col items-start space-y-1">
                    <div className={`flex items-center gap-1.5 text-[10px] font-mono px-1 ${
                      isLight ? 'text-[#6366F1]' : 'text-[#8b7cff]'
                    }`}>
                      <Bot className="w-2.5 h-2.5" />
                      <span>MeetFlow AI is thinking...</span>
                    </div>
                    <div className={`p-3 rounded-2xl rounded-tl-sm border text-xs flex items-center gap-2 ${
                      isLight
                        ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#4B5563]'
                        : 'bg-[#140f2b] border-violet-900/40 text-violet-300'
                    }`}>
                      <Loader2 className={`w-3.5 h-3.5 animate-spin ${isLight ? 'text-[#6366F1]' : 'text-[#8b7cff]'}`} />
                      <span className="animate-pulse">Checking your workspace records...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input & Controls Section */}
          <div className={`p-3 border-t space-y-2 shrink-0 ${
            isLight ? 'bg-[#F9FAFB] border-[#E5E7EB]' : 'bg-[#100b21]/90 border-violet-900/30'
          }`}>
            {/* Listening Indicator when Voice active */}
            {isListening && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[11px] font-medium text-red-700">Listening... Speak now</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="text-[10px] font-semibold text-red-600 hover:text-red-800 underline cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-1.5"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={
                    isManager
                      ? 'Ask about tasks, employees, meetings, deadlines...'
                      : 'Ask about your tasks, deadlines, status, alerts...'
                  }
                  rows={2}
                  className={`w-full px-3 py-2 text-xs rounded-xl transition resize-none disabled:opacity-50 ${
                    isLight
                      ? 'bg-white border border-[#D1D5DB] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30'
                      : 'bg-[#0b0817] border border-violet-900/50 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500'
                  }`}
                />
              </div>

              {/* Voice Typing Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isLoading}
                className={`p-2.5 rounded-xl border transition shadow-sm flex items-center justify-center shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-red-600/20 border-red-500 text-red-600 animate-pulse'
                    : isLight
                      ? 'bg-white border-[#D1D5DB] text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                      : 'bg-[#140f2b] border-violet-800/40 text-violet-300 hover:text-white hover:bg-[#1b143a]'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input (Click to speak)'}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-red-600" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="p-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            <div className={`flex items-center justify-between text-[10px] px-1 ${
              isLight ? 'text-[#6B7280]' : 'text-violet-400/60'
            }`}>
              <span>Enter to send • Shift+Enter for new line</span>
              <span className={`font-medium ${isLight ? 'text-[#4F46E5]' : 'text-violet-400/70'}`}>
                {isManager ? 'Manager Workspace Scoped' : 'Personal Employee Scoped'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
