import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  FileText,
  Play,
  Pause,
  Clock,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  MeetingItem,
  EmployeeUser,
  SpeakerUtterance,
  AIAnalysisResult,
  TranscriptRecord,
  AuthUser,
} from '../types';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface MeetingRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMeetingId?: string;
  meetings: MeetingItem[];
  employees: EmployeeUser[];
  onAnalysisReady: (
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

export const MeetingRecorderModal: React.FC<MeetingRecorderModalProps> = ({
  isOpen,
  onClose,
  preselectedMeetingId,
  meetings,
  employees,
  onAnalysisReady,
  onShowToast,
}) => {
  // Mode: Record live mic, Upload file, or Paste text notes
  const [inputMode, setInputMode] = useState<'record' | 'upload' | 'text'>('record');

  // Meeting association
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(preselectedMeetingId || '');
  const [customMeetingTitle, setCustomMeetingTitle] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Live Speech Recognition Preview (Web Speech API)
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean>(false);

  // Uploaded Audio State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Direct Text State
  const [manualTranscriptText, setManualTranscriptText] = useState<string>('');

  // Processing States
  const [isTranscribingAndAnalyzing, setIsTranscribingAndAnalyzing] = useState<boolean>(false);
  const [aiProgressStep, setAiProgressStep] = useState<string>('');

  // MediaRecorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // CRITICAL: Action Section Ref for Smooth Auto-Scroll
  const actionSectionRef = useRef<HTMLDivElement>(null);

  // Check speech recognition support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechRecognitionSupported(true);
      }
    }
  }, []);

  // Update selected meeting if prop changes
  useEffect(() => {
    if (preselectedMeetingId) {
      setSelectedMeetingId(preselectedMeetingId);
    }
  }, [preselectedMeetingId]);

  // CRITICAL BUG FIX: Smooth Auto-Scroll to Action Section
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

  // Clean up when unmounting or closing
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (!isOpen) return null;

  // Format seconds to MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get active meeting title
  const getActiveTitle = (): string => {
    if (selectedMeetingId) {
      const found = meetings.find((m) => m.id === selectedMeetingId);
      if (found) return found.title;
    }
    return customMeetingTitle.trim() || `Executive Sync - ${new Date().toLocaleDateString()}`;
  };

  // Start live microphone recording
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

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
        const audioBlob = new Blob(audioChunksRef.current, { type });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start(1000); // chunk every second
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setRecordedAudioBlob(null);
      setAudioUrl(null);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Start Web Speech API live preview if supported
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
            console.warn('Speech recognition notice:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('Could not start live speech recognition:', e);
        }
      }

      onShowToast('Microphone Active', 'Recording meeting audio...', 'info');
    } catch (err) {
      console.error('Microphone access denied:', err);
      onShowToast('Microphone Access Needed', 'Please allow microphone access in your browser.', 'warning');
    }
  };

  // Pause / Resume recording
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
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    }
  };

  // Stop recording cleanly
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
    onShowToast('Recording Completed', 'Ready for AI transcription and analysis.', 'info');
  };

  // Discard & Reset Recording
  const handleResetRecording = () => {
    if (isRecording) {
      handleStopRecording();
    }
    setRecordedAudioBlob(null);
    setAudioUrl(null);
    setLiveTranscript('');
    setRecordingSeconds(0);
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
  // TRANSCRIBE & ANALYZE (DO NOT AUTO-SAVE TO SUPABASE)
  // =========================================================
  const handleTranscribeAndAnalyze = async () => {
    const title = getActiveTitle();
    let textToAnalyze = '';
    let durationSec = recordingSeconds;

    try {
      setIsTranscribingAndAnalyzing(true);
      setAiProgressStep('Preparing recording...');

      if (inputMode === 'text') {
        if (!manualTranscriptText.trim()) {
          onShowToast('Transcript Needed', 'Please paste meeting notes or text.', 'warning');
          setIsTranscribingAndAnalyzing(false);
          return;
        }
        textToAnalyze = manualTranscriptText.trim();
        durationSec = 0;
      } else if (inputMode === 'upload' && uploadedFile) {
        setAiProgressStep('Transcribing audio file...');
        const base64 = await blobToBase64(uploadedFile);
        try {
          const transRes = await api.transcribeMeetingAudio({
            audioBase64: base64,
            meetingTitle: title,
          });
          textToAnalyze = transRes.transcriptText;
          durationSec = transRes.durationSeconds || 0;
        } catch (err) {
          if (liveTranscript.trim()) {
            textToAnalyze = liveTranscript.trim();
          } else {
            throw err;
          }
        }
      } else if (recordedAudioBlob) {
        setAiProgressStep('Transcribing recorded audio...');
        let transcribedText = '';

        if (liveTranscript.trim().length > 0) {
          transcribedText = liveTranscript.trim();
        }

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
          if (!transcribedText && liveTranscript.trim()) {
            transcribedText = liveTranscript.trim();
          } else if (!transcribedText) {
            throw new Error('Transcription could not be completed.');
          }
        }

        textToAnalyze = transcribedText;
        durationSec = recordingSeconds;
      }

      if (!textToAnalyze || textToAnalyze.trim().length === 0) {
        throw new Error('No transcript text available to analyze.');
      }

      setAiProgressStep('Analyzing transcript and extracting deliverables...');

      // Gemini AI Analysis using real company employees
      const analysis = await api.analyzeTranscript({
        meetingTitle: title,
        meetingDate,
        transcriptText: textToAnalyze,
        employees,
      });

      setAiProgressStep('Opening task approval review...');

      const tempTranscriptData = {
        meetingTitle: title,
        transcriptText: textToAnalyze,
        durationSeconds: durationSec,
        recordedAt: new Date().toISOString(),
        audioBlob: recordedAudioBlob || uploadedFile || null,
      };

      // Automatically open Task Review Modal
      onAnalysisReady(
        analysis,
        title,
        meetingDate,
        undefined, // Unsaved
        tempTranscriptData
      );

      // Close recorder modal so manager sees review modal
      onClose();
      onShowToast('Analysis Ready', 'Review AI extracted tasks before dispatching.', 'success');
    } catch (err) {
      console.error('Transcribe & Analyze failed:', err);
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      onShowToast('Failed', msg, 'warning');
    } finally {
      setIsTranscribingAndAnalyzing(false);
      setAiProgressStep('');
    }
  };

  return (
    <div
      id="meeting-recorder-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <GlowingEdgeCard
        glowColor="#8b7cff"
        className="w-full max-w-2xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85)] max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-violet-900/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-300 border border-violet-500/30">
                <Mic className="w-3.5 h-3.5 text-violet-400" />
                Live Audio Session
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Meeting Audio Capture
            </h2>
            <p className="text-xs text-violet-300/70">
              Record live discussion, process audio, and delegate AI action items.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isRecording) handleStopRecording();
              onClose();
            }}
            className="p-1.5 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Mode Selector */}
          <div className="flex rounded-xl p-1 bg-[#0e0a1c] border border-violet-900/40">
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
              <span>Microphone</span>
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

          {/* Mode 1: Live Microphone */}
          {inputMode === 'record' && (
            <div className="p-6 rounded-2xl bg-[#120e24] border border-violet-900/30 text-center space-y-4">
              <div className="flex flex-col items-center justify-center gap-3">
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
                      : 'Live microphone recording in progress...'
                    : recordedAudioBlob
                    ? 'Recording finalized. Ready to Transcribe & Analyze.'
                    : 'Click "Start Recording" to capture your meeting.'}
                </div>
              </div>

              {/* Controls */}
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
            <div className="p-6 rounded-2xl bg-[#120e24] border border-dashed border-violet-800/60 text-center space-y-3">
              <Upload className="w-8 h-8 text-violet-400 mx-auto" />
              <div className="text-xs text-violet-300/80">
                Select an audio file (.mp3, .wav, .m4a, .webm)
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
            <div className="space-y-2">
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
              id="modal-transcribe-analyze-action-section"
              className="mt-4 pt-4 border-t border-violet-900/40 space-y-4 bg-[#0e0a1c]/60 p-4 rounded-xl border border-violet-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Recording Ready</span>
                </div>
                <span className="text-[10px] text-violet-400 font-mono">
                  Temporary state (Not saved to Supabase)
                </span>
              </div>

              {/* Audio Playback Player */}
              {audioUrl && (
                <div className="p-2.5 rounded-xl bg-[#140f2b] border border-violet-900/30">
                  <span className="text-[10px] text-violet-400 uppercase tracking-wider block mb-1">
                    Playback Audio:
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
                    value={customMeetingTitle}
                    onChange={(e) => setCustomMeetingTitle(e.target.value)}
                    placeholder="e.g., Q3 Strategy Review"
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

              {/* Action Buttons */}
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
                  onClick={handleTranscribeAndAnalyze}
                  disabled={isTranscribingAndAnalyzing}
                  className="px-6 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_25px_rgba(109,93,245,0.5)] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isTranscribingAndAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{aiProgressStep || 'Processing meeting...'}</span>
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
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-violet-900/30 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              if (isRecording) handleStopRecording();
              onClose();
            }}
            disabled={isTranscribingAndAnalyzing}
            className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </GlowingEdgeCard>
    </div>
  );
};
