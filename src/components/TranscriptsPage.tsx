import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Search,
  Clock,
  Trash2,
  ListChecks,
  ChevronRight,
  ShieldAlert,
  Users,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Plus,
  Copy,
  Download,
  Check,
  X,
  Loader2,
  Database,
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  ChevronDown,
  ChevronUp,
  Send,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import {
  TranscriptRecord,
  EmployeeUser,
  MeetingItem,
  AIAnalysisResult,
  AuthUser,
} from '../types';
import { transcriptStorage } from '../services/transcriptStorage';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';
import { MeetingChatModal } from './MeetingChatModal';

interface TranscriptsPageProps {
  user: AuthUser;
  employees: EmployeeUser[];
  meetings: MeetingItem[];
  onOpenRecorder: () => void;
  onOpenReview: (
    analysis: AIAnalysisResult,
    meetingTitle: string,
    meetingDate: string,
    transcriptId?: string,
    tempTranscriptData?: {
      meetingTitle: string;
      transcriptText: string;
      durationSeconds: number;
      recordedAt?: string;
      audioBlob?: Blob | null;
    }
  ) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const TranscriptsPage: React.FC<TranscriptsPageProps> = ({
  user,
  employees,
  meetings,
  onOpenRecorder,
  onOpenReview,
  onShowToast,
}) => {
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Viewer Modal State
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRecord | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Chat with Meeting State
  const [chatTranscript, setChatTranscript] = useState<TranscriptRecord | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState<boolean>(false);

  const handleOpenChat = (record: TranscriptRecord) => {
    setChatTranscript(record);
    setIsChatModalOpen(true);
  };

  // AI Confirmation Dialog State for existing transcripts
  const [confirmAnalysisModalOpen, setConfirmAnalysisModalOpen] = useState<boolean>(false);
  const [isAnalyzingExisting, setIsAnalyzingExisting] = useState<boolean>(false);

  // =========================================================
  // WORKFLOW RECORDING PANEL STATES (Required Workflow)
  // =========================================================
  const [isRecordingPanelOpen, setIsRecordingPanelOpen] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<'record' | 'upload' | 'text'>('record');

  // Meeting metadata for current recording
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Live Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Upload Audio State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Manual Notes State
  const [manualTranscriptText, setManualTranscriptText] = useState<string>('');

  // Live Speech Recognition Preview (Web Speech API)
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean>(false);

  // Transcribing & AI Processing States
  const [isTranscribingAndAnalyzing, setIsTranscribingAndAnalyzing] = useState<boolean>(false);
  const [aiProgressStep, setAiProgressStep] = useState<string>('');
  const [temporaryAnalysis, setTemporaryAnalysis] = useState<AIAnalysisResult | null>(null);

  // MediaRecorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // CRITICAL: React Ref for the Action Section containing "Transcribe & Analyze"
  const actionSectionRef = useRef<HTMLDivElement>(null);

  // Load transcripts from Supabase
  const loadTranscripts = useCallback(async () => {
    try {
      setLoading(true);
      const items = await transcriptStorage.getTranscripts(user.companyId);
      setTranscripts(items);
    } catch (err) {
      console.error('Failed to load transcripts:', err);
      onShowToast('Notice', 'Could not fetch transcripts from storage.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [user.companyId, onShowToast]);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  // Check speech recognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechRecognitionSupported(true);
      }
    }
  }, []);

  // Clean up recording audio stream on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Format seconds to MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Compute active title
  const getActiveMeetingTitle = (): string => {
    if (selectedMeetingId) {
      const found = meetings.find((m) => m.id === selectedMeetingId);
      if (found) return found.title;
    }
    return meetingTitle.trim() || `Team Sync - ${new Date().toLocaleDateString()}`;
  };

  // =========================================================
  // CRITICAL BUG FIX: Smooth Automatic Scroll to Action Section
  // =========================================================
  // After recording stops:
  // - Render the next action section reliably
  // - Use actionSectionRef
  // - Smoothly scroll it into view after element exists in the DOM
  // - Avoid race conditions
  useEffect(() => {
    if (!isRecording && (recordedAudioBlob || uploadedFile || manualTranscriptText.trim().length > 0)) {
      const scrollTimer = setTimeout(() => {
        if (actionSectionRef.current) {
          actionSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 150);
      return () => clearTimeout(scrollTimer);
    }
  }, [isRecording, recordedAudioBlob, uploadedFile, manualTranscriptText]);

  // 1. Manager clicks Record New
  const handleOpenNewRecording = () => {
    setIsRecordingPanelOpen(true);
    setMeetingTitle('');
    setRecordedAudioBlob(null);
    setAudioUrl(null);
    setLiveTranscript('');
    setManualTranscriptText('');
    setTemporaryAnalysis(null);
    setAiProgressStep('');
  };

  // 2. Audio recording starts
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setRecordedAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(1000); // chunk every 1 second
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setRecordedAudioBlob(null);
      setAudioUrl(null);
      setTemporaryAnalysis(null);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Start Web Speech API live recognition if supported
      if (speechRecognitionSupported) {
        try {
          const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript + ' ';
            }
            setLiveTranscript(current);
          };

          recognition.onerror = (e: any) => {
            console.warn('Live speech recognition notice:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('Could not start live speech recognition:', e);
        }
      }

      onShowToast('Recording Started', 'Microphone active. Speak clearly.', 'info');
    } catch (err) {
      console.error('Microphone access error:', err);
      onShowToast('Microphone Needed', 'Please allow microphone access in your browser.', 'warning');
    }
  };

  // Toggle Pause/Resume
  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.start();
        } catch {}
      }
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    }
  };

  // 3. Manager clicks Stop Recording
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setIsPaused(false);
    onShowToast('Recording Stopped', 'Review your audio and click Transcribe & Analyze.', 'info');
  };

  // Reset/Record Again
  const handleResetRecording = () => {
    if (isRecording) {
      handleStopRecording();
    }
    setRecordedAudioBlob(null);
    setAudioUrl(null);
    setLiveTranscript('');
    setRecordingSeconds(0);
    setTemporaryAnalysis(null);
    setAiProgressStep('');
  };

  // Helper to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // =========================================================
  // 6 & 7. Manager clicks "Transcribe & Analyze"
  // =========================================================
  // Process audio -> send to Gemini AI -> generate summary & action items -> auto-open Task Review Modal
  const handleTranscribeAndAnalyze = async () => {
    const title = getActiveMeetingTitle();

    let textToAnalyze = '';
    let durationSec = recordingSeconds;

    try {
      setIsTranscribingAndAnalyzing(true);

      // Step 1: Preparing recording
      setAiProgressStep('Preparing recording...');

      if (inputMode === 'text') {
        if (!manualTranscriptText.trim()) {
          onShowToast('Notes Required', 'Please enter transcript notes to analyze.', 'warning');
          setIsTranscribingAndAnalyzing(false);
          return;
        }
        textToAnalyze = manualTranscriptText.trim();
        durationSec = 0;
      } else if (inputMode === 'upload' && uploadedFile) {
        setAiProgressStep('Transcribing meeting audio file...');
        const base64 = await blobToBase64(uploadedFile);
        try {
          const transRes = await api.transcribeMeetingAudio({
            audioBase64: base64,
            meetingTitle: title,
          });
          textToAnalyze = transRes.transcriptText;
          durationSec = transRes.durationSeconds || 0;
        } catch (err: any) {
          if (liveTranscript.trim()) {
            textToAnalyze = liveTranscript.trim();
          } else {
            throw err;
          }
        }
      } else if (recordedAudioBlob) {
        // Step 2: Transcribing meeting audio
        setAiProgressStep('Transcribing meeting audio...');
        let transcribedText = '';

        // If live transcript captured from browser Web Speech API
        if (liveTranscript.trim().length > 0) {
          transcribedText = liveTranscript.trim();
        }

        // Try server transcription
        try {
          const base64 = await blobToBase64(recordedAudioBlob);
          const transRes = await api.transcribeMeetingAudio({
            audioBase64: base64,
            liveTranscript: liveTranscript.trim(),
            meetingTitle: title,
          });
          if (transRes && transRes.transcriptText) {
            transcribedText = transRes.transcriptText;
          }
        } catch (err) {
          // If server fails or key missing, use live speech transcript
          if (!transcribedText && liveTranscript.trim()) {
            transcribedText = liveTranscript.trim();
          } else if (!transcribedText) {
            throw new Error('Transcription could not be completed. Please ensure speech was captured.');
          }
        }

        textToAnalyze = transcribedText;
        durationSec = recordingSeconds;
      }

      if (!textToAnalyze || textToAnalyze.trim().length === 0) {
        throw new Error('No transcript text available to analyze.');
      }

      // Step 3: Analyzing and extracting deliverables
      setAiProgressStep('Analyzing transcript and extracting action items...');

      // Gemini must use the real employees from the current company's database
      const analysis = await api.analyzeTranscript({
        meetingTitle: title,
        meetingDate,
        transcriptText: textToAnalyze,
        employees,
      });

      // Step 4: Extracting action items & Opening Task Review Modal
      setAiProgressStep('Extracting action items...');
      setTemporaryAnalysis(analysis);

      // Temporary transcript data (DO NOT SAVE TO SUPABASE YET)
      const tempTranscriptData = {
        meetingTitle: title,
        transcriptText: textToAnalyze,
        durationSeconds: durationSec,
        recordedAt: new Date().toISOString(),
        audioBlob: recordedAudioBlob || uploadedFile || null,
      };

      // 8. After AI analysis completes, automatically open the Task Review / Approval modal
      onOpenReview(
        analysis,
        title,
        meetingDate,
        undefined, // No transcriptId yet because it is not saved
        tempTranscriptData
      );

      onShowToast('AI Analysis Complete', 'Review detected tasks and confirm assignments.', 'success');
    } catch (err) {
      console.error('Transcribe & Analyze failed:', err);
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      onShowToast('Analysis Failed', msg, 'warning');
    } finally {
      setIsTranscribingAndAnalyzing(false);
      setAiProgressStep('');
    }
  };

  // Delete transcript
  const handleDeleteTranscript = async (id: string, title: string) => {
    try {
      await transcriptStorage.deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      onShowToast('Transcript Deleted', `Removed "${title}".`, 'info');
      if (selectedTranscript?.id === id) {
        setSelectedTranscript(null);
      }
    } catch (err) {
      onShowToast('Delete Failed', 'Could not delete transcript.', 'warning');
    }
  };

  // Helper to get AI status
  const getAiStatus = (
    t: TranscriptRecord
  ): 'NOT ANALYZED' | 'AI ANALYZED' | 'AI ANALYSIS FAILED' => {
    if (t.aiStatus) return t.aiStatus;
    if (t.actionItems && t.actionItems.length > 0) return 'AI ANALYZED';
    return 'NOT ANALYZED';
  };

  // Analyze an existing previously saved transcript (on demand)
  const handleProceedWithExistingAIAnalysis = async () => {
    if (!selectedTranscript) return;

    try {
      setIsAnalyzingExisting(true);
      setConfirmAnalysisModalOpen(false);
      onShowToast('Analysis Active', 'Analyzing transcript and extracting deliverables...', 'info');

      const dateContext = selectedTranscript.recordedAt.split('T')[0];

      const analysis = await api.analyzeTranscript({
        meetingTitle: selectedTranscript.meetingTitle,
        meetingDate: dateContext,
        transcriptText: selectedTranscript.transcriptText,
        employees,
      });

      // Update record in Supabase as AI ANALYZED
      await transcriptStorage.updateTranscript(selectedTranscript.id, {
        summary: analysis.meetingSummary,
        keyPoints: analysis.keyDiscussionPoints,
        actionItems: analysis.actionItems,
        aiStatus: 'AI ANALYZED',
      });

      await loadTranscripts();

      const updatedTranscript = {
        ...selectedTranscript,
        summary: analysis.meetingSummary,
        keyPoints: analysis.keyDiscussionPoints,
        actionItems: analysis.actionItems,
        aiStatus: 'AI ANALYZED' as const,
      };
      setSelectedTranscript(null);

      onOpenReview(
        analysis,
        updatedTranscript.meetingTitle,
        dateContext,
        updatedTranscript.id
      );

      onShowToast('AI Analysis Complete', 'Review extracted tasks and confirm assignments.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI analysis failed.';
      onShowToast('AI Analysis Failed', msg, 'warning');

      if (selectedTranscript) {
        await transcriptStorage.updateTranscript(selectedTranscript.id, {
          aiStatus: 'AI ANALYSIS FAILED',
        });
        await loadTranscripts();
      }
    } finally {
      setIsAnalyzingExisting(false);
    }
  };

  // Copy transcript text
  const handleCopyTranscript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast('Copied', 'Transcript copied to clipboard.', 'success');
  };

  // Download .TXT file
  const handleDownloadTxt = (title: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast('Downloaded', 'Transcript text file downloaded.', 'info');
  };

  const filteredTranscripts = transcripts.filter(
    (t) =>
      t.meetingTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.transcriptText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="transcripts-page-root" className="space-y-6 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & ACTIONS                                   */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-violet-900/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Meeting Transcripts</span>
          </h1>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1">
            Capture meetings, extract grounded action items, and dispatch tasks to employees.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadTranscripts}
            className="p-2.5 rounded-xl border border-violet-800/40 text-violet-300 hover:text-white hover:bg-violet-900/30 transition cursor-pointer"
            title="Refresh transcripts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            id="open-recorder-transcripts-btn"
            onClick={handleOpenNewRecording}
            className="px-4 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record New</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. INTERACTIVE RECORDING & ACTION SECTION (Required Flow)  */}
      {/* ========================================================= */}
      {isRecordingPanelOpen && (
        <GlowingEdgeCard
          glowColor="#8b7cff"
          className="p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all"
        >
          {/* Header of recording section */}
          <div className="flex items-center justify-between pb-3 border-b border-violet-900/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  New Meeting Recording
                </h3>
                <p className="text-[11px] text-violet-300/70">
                  Record live discussion or upload meeting audio
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isRecording) handleStopRecording();
                setIsRecordingPanelOpen(false);
              }}
              className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="mt-4 flex rounded-xl p-1 bg-[#0e0a1c] border border-violet-900/40 max-w-md">
            <button
              type="button"
              onClick={() => setInputMode('record')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                inputMode === 'record'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-violet-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Mic</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                inputMode === 'upload'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-violet-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Audio</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                inputMode === 'text'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                  : 'text-violet-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Notes</span>
            </button>
          </div>

          {/* Mode 1: Live Mic Recording */}
          {inputMode === 'record' && (
            <div className="mt-4 p-6 rounded-2xl bg-[#120e24] border border-violet-900/30 text-center space-y-4">
              <div className="flex flex-col items-center justify-center gap-3">
                {/* Glowing Pulsing Ring */}
                <div className="relative">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-rose-500/20 border-2 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-pulse'
                        : recordedAudioBlob
                        ? 'bg-emerald-500/20 border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : 'bg-violet-600/10 border-2 border-violet-500/30'
                    }`}
                  >
                    <Mic
                      className={`w-8 h-8 ${
                        isRecording
                          ? 'text-rose-400'
                          : recordedAudioBlob
                          ? 'text-emerald-400'
                          : 'text-violet-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="font-mono text-2xl font-bold text-white tracking-widest">
                  {formatDuration(recordingSeconds)}
                </div>

                <div className="text-xs text-violet-300/70">
                  {isRecording
                    ? isPaused
                      ? 'Recording paused'
                      : 'Live recording in progress...'
                    : recordedAudioBlob
                    ? 'Recording finalized. Proceed to Transcribe & Analyze below.'
                    : 'Click "Start Recording" to capture meeting audio.'}
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {!isRecording && !recordedAudioBlob && (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="px-6 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Recording</span>
                  </button>
                )}

                {isRecording && (
                  <>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-4 py-2 rounded-xl bg-violet-900/40 hover:bg-violet-800/50 text-violet-200 text-xs font-semibold border border-violet-700/40 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center gap-2 transition cursor-pointer"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop Recording</span>
                    </button>
                  </>
                )}

                {recordedAudioBlob && !isRecording && (
                  <button
                    type="button"
                    onClick={handleResetRecording}
                    className="px-4 py-2 rounded-xl bg-[#1a1433] hover:bg-[#251d47] text-violet-300 border border-violet-800/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Record Again</span>
                  </button>
                )}
              </div>

              {/* Live Web Speech transcript text preview */}
              {liveTranscript && (
                <div className="mt-3 p-3 rounded-xl bg-[#0e0a1c] border border-violet-900/40 text-left text-xs text-violet-200/90 max-h-24 overflow-y-auto">
                  <span className="text-[10px] font-bold uppercase text-violet-400 block mb-1">
                    Live Speech Capture:
                  </span>
                  {liveTranscript}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Audio File Upload */}
          {inputMode === 'upload' && (
            <div className="mt-4 p-6 rounded-2xl bg-[#120e24] border border-dashed border-violet-800/60 text-center space-y-3">
              <Upload className="w-8 h-8 text-violet-400 mx-auto" />
              <div className="text-xs text-violet-300/80">
                Upload meeting audio (.mp3, .wav, .m4a, .webm)
              </div>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadedFile(e.target.files[0]);
                    onShowToast('File Selected', e.target.files[0].name, 'info');
                  }
                }}
                className="text-xs text-violet-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
              />
              {uploadedFile && (
                <div className="text-xs text-emerald-400 font-medium">
                  Selected: {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Manual Notes */}
          {inputMode === 'text' && (
            <div className="mt-4 space-y-2">
              <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider">
                Meeting Transcript / Notes
              </label>
              <textarea
                value={manualTranscriptText}
                onChange={(e) => setManualTranscriptText(e.target.value)}
                placeholder="Paste the full meeting transcript or discussion notes here..."
                rows={5}
                className="w-full p-3 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition resize-none font-mono"
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* CRITICAL: ACTION SECTION with "Transcribe & Analyze" Button */}
          {/* Automatically scrolled into view via actionSectionRef      */}
          {/* ========================================================= */}
          {(recordedAudioBlob || uploadedFile || manualTranscriptText.trim().length > 0) && !isRecording && (
            <div
              ref={actionSectionRef}
              id="transcribe-analyze-action-section"
              className="mt-5 pt-5 border-t border-violet-900/40 space-y-4 bg-[#0e0a1c]/60 p-4 rounded-xl border border-violet-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Recording Ready for AI Processing</span>
                </div>
                <span className="text-[10px] text-violet-400 font-mono">
                  Temporary state (Not saved to Supabase)
                </span>
              </div>

              {/* Audio Playback Player */}
              {audioUrl && (
                <div className="p-2.5 rounded-xl bg-[#140f2b] border border-violet-900/30">
                  <span className="text-[10px] text-violet-400 uppercase tracking-wider block mb-1">
                    Playback Audio Preview:
                  </span>
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              )}

              {/* Meeting Title & Association Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g., Sprint Planning & Roadmap Sync"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                    Link Scheduled Meeting (Optional)
                  </label>
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => setSelectedMeetingId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="" className="bg-[#120e24]">
                      -- Ad-Hoc Meeting --
                    </option>
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#120e24]">
                        {m.title} ({m.date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress State Banner */}
              {isTranscribingAndAnalyzing && (
                <div className="p-3.5 rounded-xl bg-violet-950/60 border border-violet-800/60 text-violet-200 text-xs flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
                  <span className="font-medium">{aiProgressStep || 'Processing meeting...'}</span>
                </div>
              )}

              {/* Temporary Analysis Preview if previously run */}
              {temporaryAnalysis && !isTranscribingAndAnalyzing && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Extracted {temporaryAnalysis.actionItems.length} action item(s).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenReview(
                        temporaryAnalysis,
                        getActiveMeetingTitle(),
                        meetingDate,
                        undefined,
                        {
                          meetingTitle: getActiveMeetingTitle(),
                          transcriptText: manualTranscriptText || liveTranscript,
                          durationSeconds: recordingSeconds,
                          audioBlob: recordedAudioBlob || uploadedFile,
                        }
                      )
                    }
                    className="text-xs font-semibold text-emerald-400 hover:text-white underline cursor-pointer"
                  >
                    Open Review Modal
                  </button>
                </div>
              )}

              {/* Action Buttons: Transcribe & Analyze */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetRecording}
                  disabled={isTranscribingAndAnalyzing}
                  className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Discard
                </button>

                <button
                  type="button"
                  id="transcribe-and-analyze-btn"
                  onClick={handleTranscribeAndAnalyze}
                  disabled={isTranscribingAndAnalyzing}
                  className="px-6 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_25px_rgba(109,93,245,0.5)] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isTranscribingAndAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{aiProgressStep || 'Analyzing meeting...'}</span>
                    </>
                  ) : (
                    <>
                      <ListChecks className="w-4 h-4 text-violet-200" />
                      <span>Transcribe & Analyze</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </GlowingEdgeCard>
      )}

      {/* ========================================================= */}
      {/* 3. SEARCH BAR                                             */}
      {/* ========================================================= */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-violet-400/60" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcripts by title or keywords..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#120e24] border border-violet-900/30 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* ========================================================= */}
      {/* 4. TRANSCRIPTS GRID                                       */}
      {/* ========================================================= */}
      {loading ? (
        <div className="py-20 text-center text-violet-400 space-y-3">
          <RefreshCw className="w-7 h-7 mx-auto animate-spin" />
          <p className="text-xs">Loading stored transcripts from Supabase...</p>
        </div>
      ) : filteredTranscripts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTranscripts.map((t) => {
            const aiStatus = getAiStatus(t);

            return (
              <GlowingEdgeCard
                key={t.id}
                glowColor={
                  aiStatus === 'AI ANALYZED'
                    ? '#10b981'
                    : aiStatus === 'AI ANALYSIS FAILED'
                    ? '#ef4444'
                    : '#8b7cff'
                }
                className="p-5 flex flex-col justify-between shadow-[0_15px_35px_rgba(0,0,0,0.5)]"
              >
                <div>
                  {/* Top Bar: AI Status Badge & Date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        aiStatus === 'AI ANALYZED'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : aiStatus === 'AI ANALYSIS FAILED'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {aiStatus}
                    </span>

                    <div className="flex items-center gap-1.5 text-[11px] text-violet-400 font-mono">
                      <Calendar className="w-3 h-3 text-violet-400" />
                      <span>{t.recordedAt.split('T')[0]}</span>
                    </div>
                  </div>

                  {/* Meeting Name */}
                  <h3 className="text-base font-bold text-white tracking-tight line-clamp-1 mb-1.5">
                    {t.meetingTitle}
                  </h3>

                  {/* Transcript Snippet */}
                  <p className="text-xs text-violet-300/70 line-clamp-2 mb-3 leading-relaxed">
                    {t.transcriptText}
                  </p>

                  {/* Created At & Cloud Stored status */}
                  <div className="flex items-center justify-between text-[11px] text-violet-400/80 font-mono py-2 border-t border-violet-900/30">
                    <span>
                      Created:{' '}
                      {new Date(t.recordedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400/80">
                      <Database className="w-3 h-3" />
                      Supabase Cloud Stored
                    </span>
                  </div>
                </div>

                {/* Card Actions: Open Transcript, Chat & Delete */}
                <div className="pt-3 mt-2 border-t border-violet-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTranscript(t)}
                      className="px-3 py-1.5 rounded-lg bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Transcript</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenChat(t)}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-900/40 hover:bg-violet-800/60 text-violet-200 border border-violet-700/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      title="Chat with Meeting AI"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-violet-300" />
                      <span>Chat</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTranscript(t.id, t.meetingTitle)}
                    className="p-1.5 rounded-lg text-violet-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                    title="Delete Transcript"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </GlowingEdgeCard>
            );
          })}
        </div>
      ) : (
        <GlowingEdgeCard glowColor="#6d5df5" className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No transcripts found</h3>
            <p className="text-xs text-violet-300/60">
              {searchQuery
                ? `No transcripts match "${searchQuery}".`
                : 'Start an audio recording session to generate raw meeting transcripts.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenNewRecording}
                className="px-4 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] inline-flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Meeting</span>
              </button>
            </div>
          </div>
        </GlowingEdgeCard>
      )}

      {/* ========================================================= */}
      {/* 5. VIEW TRANSCRIPT MODAL (Existing Transcripts)           */}
      {/* ========================================================= */}
      {selectedTranscript && (
        <div
          id="transcript-viewer-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <GlowingEdgeCard
            glowColor="#8b7cff"
            className="w-full max-w-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-violet-900/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      getAiStatus(selectedTranscript) === 'AI ANALYZED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : getAiStatus(selectedTranscript) === 'AI ANALYSIS FAILED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {getAiStatus(selectedTranscript)}
                  </span>
                  <span className="text-xs text-violet-400 font-mono">
                    {selectedTranscript.recordedAt.split('T')[0]}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedTranscript.meetingTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTranscript(null)}
                className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Summary Banner if analyzed */}
              {selectedTranscript.summary && (
                <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-800/40 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-violet-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    Meeting Summary & Takeaways
                  </h4>
                  <p className="text-xs text-violet-200/90 leading-relaxed">
                    {selectedTranscript.summary}
                  </p>
                  {selectedTranscript.keyPoints && selectedTranscript.keyPoints.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-xs text-violet-300/80 pt-1">
                      {selectedTranscript.keyPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Raw Transcript Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                    Full Transcript
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenChat(selectedTranscript)}
                      className="text-xs text-violet-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer px-2.5 py-1 rounded-lg bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/40 shadow-sm"
                      title="Chat with Meeting AI"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-violet-300" />
                      <span>Chat with Meeting</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyTranscript(selectedTranscript.transcriptText)}
                      className="text-xs text-violet-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadTxt(
                          selectedTranscript.meetingTitle,
                          selectedTranscript.transcriptText
                        )
                      }
                      className="text-xs text-violet-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0e0a1c] border border-violet-900/40 text-xs text-violet-200/90 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-mono">
                  {selectedTranscript.transcriptText}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-violet-900/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedTranscript(null)}
                className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenChat(selectedTranscript)}
                  className="px-3.5 py-2 rounded-xl bg-violet-900/40 hover:bg-violet-800/60 text-violet-200 border border-violet-700/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Chat with Meeting AI"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-violet-300" />
                  <span>Chat with Meeting</span>
                </button>

                {getAiStatus(selectedTranscript) !== 'AI ANALYZED' ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAnalysisModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_15px_rgba(109,93,245,0.4)] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    <span>Extract Action Items</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenReview(
                        {
                          meetingSummary: selectedTranscript.summary || '',
                          keyDiscussionPoints: selectedTranscript.keyPoints || [],
                          actionItems: selectedTranscript.actionItems || [],
                        },
                        selectedTranscript.meetingTitle,
                        selectedTranscript.recordedAt.split('T')[0],
                        selectedTranscript.id
                      );
                      setSelectedTranscript(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Review Tasks</span>
                  </button>
                )}
              </div>
            </div>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. AI CONFIRMATION MODAL (For existing transcripts)        */}
      {/* ========================================================= */}
      {confirmAnalysisModalOpen && selectedTranscript && (
        <div
          id="ai-confirm-dialog-backdrop"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <GlowingEdgeCard
            glowColor="#6d5df5"
            className="w-full max-w-md p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <ListChecks className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Confirm Action Item Extraction</h3>
                <p className="text-xs text-violet-300/70">Analyze meeting transcript</p>
              </div>
            </div>

            <p className="text-xs text-violet-200/90 leading-relaxed">
              Are you sure you want to extract action items from{' '}
              <span className="font-semibold text-white">"{selectedTranscript.meetingTitle}"</span>?
              This will extract action items and deliverables for review.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAnalysisModalOpen(false)}
                disabled={isAnalyzingExisting}
                className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProceedWithExistingAIAnalysis}
                disabled={isAnalyzingExisting}
                className="px-5 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {isAnalyzingExisting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <ListChecks className="w-4 h-4" />
                    <span>Confirm & Extract</span>
                  </>
                )}
              </button>
            </div>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. CHAT WITH MEETING MODAL (AI Meeting Assistant)         */}
      {/* ========================================================= */}
      <MeetingChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setChatTranscript(null);
        }}
        transcript={chatTranscript}
        onShowToast={onShowToast}
      />
    </div>
  );
};
