import React, { useState, useEffect } from 'react';
import {
  AITaskSuggestion,
  EmployeeUser,
  AIAnalysisResult,
  TranscriptRecord,
} from '../types';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Calendar,
  FileText,
  Check,
  Briefcase,
  Hash,
  Loader2,
  ListChecks,
} from 'lucide-react';
import { api } from '../services/api';
import { transcriptStorage } from '../services/transcriptStorage';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface TaskReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTitle: string;
  meetingDate?: string;
  analysisResult: AIAnalysisResult;
  transcriptId?: string;
  tempTranscriptData?: {
    meetingTitle: string;
    transcriptText: string;
    durationSeconds: number;
    recordedAt?: string;
    audioBlob?: Blob | null;
  };
  employees: EmployeeUser[];
  isLoadingEmployees?: boolean;
  onTasksApproved: (count: number) => void;
  onTranscriptSaved?: (saved: TranscriptRecord) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const TaskReviewModal: React.FC<TaskReviewModalProps> = ({
  isOpen,
  onClose,
  meetingTitle,
  meetingDate = new Date().toISOString().split('T')[0],
  analysisResult,
  transcriptId,
  tempTranscriptData,
  employees,
  isLoadingEmployees = false,
  onTasksApproved,
  onTranscriptSaved,
  onShowToast,
}) => {
  // Initialize tasks with selected = true by default
  const [tasks, setTasks] = useState<AITaskSuggestion[]>(
    (analysisResult.actionItems || []).map((item) => ({
      ...item,
      selected: item.selected !== undefined ? item.selected : true,
    }))
  );

  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync tasks when analysisResult changes
  useEffect(() => {
    if (isOpen) {
      setTasks(
        (analysisResult?.actionItems || []).map((item) => ({
          ...item,
          selected: item.selected !== undefined ? item.selected : true,
        }))
      );
      setValidationError(null);
    }
  }, [isOpen, analysisResult]);

  // Lock background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedTasks = tasks.filter((t) => t.selected);
  const selectedCount = selectedTasks.length;

  const handleToggleSelectAll = () => {
    const allSelected = tasks.every((t) => t.selected);
    setTasks((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const handleToggleTaskSelect = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleUpdateTask = (id: string, updates: Partial<AITaskSuggestion>) => {
    setValidationError(null);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        if (updates.suggestedEmployeeId !== undefined) {
          const matchedEmp = employees.find(
            (e) => e.employeeId.toLowerCase() === updates.suggestedEmployeeId?.toLowerCase()
          );
          if (matchedEmp) {
            updated.suggestedEmployeeName = matchedEmp.employeeName;
          } else {
            updated.suggestedEmployeeName = '';
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddNewTask = () => {
    const newTask: AITaskSuggestion = {
      id: `manual_task_${Date.now()}`,
      subject: '',
      description: '',
      suggestedEmployeeId: '',
      suggestedEmployeeName: '',
      suggestedDeadline: meetingDate,
      priority: 'Medium',
      confidence: 100,
      transcriptQuote: 'Manually added during review.',
      selected: true,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleApproveAndSend = async () => {
    setValidationError(null);

    if (selectedCount === 0) {
      setValidationError('Please select at least one task to approve and dispatch.');
      onShowToast('No Tasks Selected', 'Please select at least one task to send.', 'warning');
      return;
    }

    // Validation: All selected tasks must have an assigned employee
    const unassignedTasks = selectedTasks.filter(
      (t) => !t.suggestedEmployeeId || t.suggestedEmployeeId === 'UNASSIGNED' || t.suggestedEmployeeId.trim() === ''
    );

    if (unassignedTasks.length > 0) {
      setValidationError('Please assign an employee to all selected tasks before sending.');
      onShowToast(
        'Assignee Required',
        'Please assign an employee to all selected tasks before sending.',
        'warning'
      );
      return;
    }

    // Validation: All selected tasks must have a valid task subject
    for (const t of selectedTasks) {
      if (!t.subject.trim()) {
        setValidationError('All selected tasks must have a valid task subject.');
        onShowToast('Missing Subject', 'Please enter a subject for each selected task.', 'warning');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // 1. Save approved tasks to Supabase
      const payload = selectedTasks.map((t) => ({
        employeeId: t.suggestedEmployeeId,
        subject: t.subject.trim(),
        assignedDate: meetingDate,
        deadline: t.suggestedDeadline || meetingDate,
        priority: t.priority,
      }));

      const taskRes = await api.bulkCreateTasks(payload);

      // 2. Save or update meeting transcript and AI analysis to Supabase
      if (tempTranscriptData) {
        let audioStoragePath: string | null = null;
        if (tempTranscriptData.audioBlob) {
          try {
            audioStoragePath = await transcriptStorage.uploadAudio(
              tempTranscriptData.audioBlob,
              `meeting_${Date.now()}.webm`
            );
          } catch (err) {
            console.warn('Audio storage upload notice:', err);
          }
        }

        const saved = await transcriptStorage.saveTranscript({
          companyId: 'current',
          meetingTitle: tempTranscriptData.meetingTitle || meetingTitle,
          transcriptText: tempTranscriptData.transcriptText,
          durationSeconds: tempTranscriptData.durationSeconds || 0,
          recordedAt: tempTranscriptData.recordedAt || new Date().toISOString(),
          summary: analysisResult.meetingSummary,
          keyPoints: analysisResult.keyDiscussionPoints,
          actionItems: tasks.filter((t) => t.selected),
          status: 'reviewed',
          aiStatus: 'AI ANALYZED',
          audioStoragePath: audioStoragePath || undefined,
        });

        if (onTranscriptSaved) {
          onTranscriptSaved(saved);
        }
      } else if (transcriptId) {
        const updated = await transcriptStorage.updateTranscript(transcriptId, {
          summary: analysisResult.meetingSummary,
          keyPoints: analysisResult.keyDiscussionPoints,
          actionItems: tasks.filter((t) => t.selected),
          status: 'reviewed',
          aiStatus: 'AI ANALYZED',
        });
        if (updated && onTranscriptSaved) {
          onTranscriptSaved(updated);
        }
      }

      onShowToast(
        'Tasks Dispatched & Saved',
        `Successfully delegated ${taskRes.count} task${taskRes.count > 1 ? 's' : ''} and saved meeting analysis to Supabase.`,
        'success'
      );
      onTasksApproved(taskRes.count);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save tasks and transcript.';
      onShowToast('Error Saving Tasks', msg, 'warning');
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="task-review-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-hidden"
    >
      <GlowingEdgeCard
        glowColor="#8b7cff"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.85)]"
        contentClassName="flex flex-col h-full max-h-[90vh] min-h-0 overflow-hidden p-5 sm:p-7"
      >
        {/* ========================================================= */}
        {/* 1. MODAL HEADER (Pinned top, accessible)                   */}
        {/* ========================================================= */}
        <div className="flex-shrink-0 flex items-start justify-between pb-4 border-b border-violet-900/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-300 border border-violet-500/30">
                <ListChecks className="w-3.5 h-3.5 text-violet-400" />
                Action Items Extraction
              </span>
              <span className="text-xs text-violet-400/60 font-mono">• {meetingTitle}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Review Extracted Action Items
            </h2>
            <p className="text-xs text-violet-300/70">
              Review and customize the action items detected from this meeting before dispatching to employees.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
            title="Close review modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation error notice (Pinned) */}
        {validationError && (
          <div className="flex-shrink-0 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. MODAL SCROLLABLE BODY (Scrollable only here)            */}
        {/* ========================================================= */}
        <div
          id="task-review-scroll-area"
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden my-3 pr-2.5 sm:pr-3.5 space-y-4 pb-4 custom-modal-scrollbar focus:outline-none"
        >
          {/* Executive Meeting Summary Collapsible */}
          {analysisResult.meetingSummary && (
            <div className="p-3.5 rounded-xl bg-[#120e24] border border-violet-900/30">
              <button
                type="button"
                onClick={() => setSummaryExpanded(!summaryExpanded)}
                className="w-full flex items-center justify-between text-left text-xs font-semibold text-violet-200"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                  Meeting Summary & Key Points
                </span>
                {summaryExpanded ? <ChevronUp className="w-4 h-4 text-violet-400" /> : <ChevronDown className="w-4 h-4 text-violet-400" />}
              </button>
              {summaryExpanded && (
                <div className="mt-2.5 pt-2.5 border-t border-violet-900/30 text-xs text-violet-300/80 leading-relaxed space-y-2">
                  <p>{analysisResult.meetingSummary}</p>
                  {analysisResult.keyDiscussionPoints && analysisResult.keyDiscussionPoints.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-violet-300/70 pt-1">
                      {analysisResult.keyDiscussionPoints.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Controls Bar: Select All & Add Task */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-violet-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    tasks.length > 0 && tasks.every((t) => t.selected)
                      ? 'bg-[#6d5df5] border-[#6d5df5] text-white'
                      : 'border-violet-700 bg-transparent'
                  }`}
                >
                  {tasks.length > 0 && tasks.every((t) => t.selected) && <Check className="w-3 h-3" />}
                </div>
                <span>Select All ({tasks.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddNewTask}
              className="text-xs font-semibold text-[#a78bfa] hover:text-white flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Task</span>
            </button>
          </div>

          {/* Tasks List */}
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-violet-400/60 text-xs rounded-xl bg-[#0f0b1e]/40 border border-violet-900/20">
              No action items detected. Click "Add Custom Task" to create one manually.
            </div>
          ) : (
            <div className="space-y-3.5">
              {tasks.map((task) => {
                const assignedEmployee = employees.find(
                  (e) => e.employeeId.toLowerCase() === task.suggestedEmployeeId?.toLowerCase()
                );
                const isAssigned = !!assignedEmployee;

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all ${
                      task.selected
                        ? 'bg-[#140f2b] border-violet-700/60 shadow-sm'
                        : 'bg-[#0f0b1e]/60 border-violet-900/30 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox (selected by default) */}
                      <button
                        type="button"
                        onClick={() => handleToggleTaskSelect(task.id)}
                        className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer flex-shrink-0 ${
                          task.selected
                            ? 'bg-[#6d5df5] border-[#6d5df5] text-white shadow-sm'
                            : 'border-violet-700 bg-transparent'
                        }`}
                        title={task.selected ? 'Deselect task' : 'Select task'}
                      >
                        {task.selected && <Check className="w-3.5 h-3.5" />}
                      </button>

                      {/* Main Editable Fields */}
                      <div className="flex-1 space-y-3">
                        {/* Task Subject */}
                        <div>
                          <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                            Task Subject
                          </label>
                          <input
                            type="text"
                            value={task.subject}
                            onChange={(e) => handleUpdateTask(task.id, { subject: e.target.value })}
                            placeholder="Task Subject (e.g., Deliver redesigned auth flow)"
                            className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-[#120e24] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        {/* Task Description */}
                        <div>
                          <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                            Description & Deliverables
                          </label>
                          <textarea
                            value={task.description}
                            onChange={(e) => handleUpdateTask(task.id, { description: e.target.value })}
                            placeholder="Deliverable description or context..."
                            rows={2}
                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#120e24] border border-violet-900/40 text-violet-200/90 placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 resize-none"
                          />
                        </div>

                        {/* Assignee Details Row: Dropdown, ID, Post */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          {/* Employee dropdown populated strictly from registered company employees */}
                          <div>
                            <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                              Assignee
                            </label>
                            {isLoadingEmployees ? (
                              <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-[#120e24] border border-violet-900/40 text-violet-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Loading employees...</span>
                              </div>
                            ) : employees.length === 0 ? (
                              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 text-[11px] leading-tight">
                                No employees available. Add an employee before assigning tasks.
                              </div>
                            ) : (
                              <select
                                value={task.suggestedEmployeeId || ''}
                                onChange={(e) =>
                                  handleUpdateTask(task.id, { suggestedEmployeeId: e.target.value })
                                }
                                className={`w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#120e24] border text-white focus:outline-none focus:border-violet-500 cursor-pointer ${
                                  !isAssigned ? 'border-amber-500/60' : 'border-violet-900/40'
                                }`}
                              >
                                <option value="" className="bg-[#120e24]">
                                  -- Select Employee --
                                </option>
                                {employees.map((emp) => (
                                  <option key={emp.employeeId} value={emp.employeeId} className="bg-[#120e24]">
                                    {emp.employeeName}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Employee ID Display */}
                          <div className="p-2 rounded-lg bg-[#0e0a1c] border border-violet-900/30 flex flex-col justify-center">
                            <span className="text-[10px] text-violet-400 uppercase tracking-wider flex items-center gap-1">
                              <Hash className="w-3 h-3" /> Employee ID
                            </span>
                            <span className="font-mono text-xs font-semibold text-violet-200">
                              {isAssigned ? assignedEmployee.employeeId : '-'}
                            </span>
                          </div>

                          {/* Employee Post Display */}
                          <div className="p-2 rounded-lg bg-[#0e0a1c] border border-violet-900/30 flex flex-col justify-center">
                            <span className="text-[10px] text-violet-400 uppercase tracking-wider flex items-center gap-1">
                              <Briefcase className="w-3 h-3" /> Post
                            </span>
                            <span className="text-xs font-semibold text-violet-200 truncate">
                              {isAssigned ? assignedEmployee.employeePost : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Priority & Deadline Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                              Priority
                            </label>
                            <select
                              value={task.priority}
                              onChange={(e) =>
                                handleUpdateTask(task.id, {
                                  priority: e.target.value as 'High' | 'Medium' | 'Low',
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#120e24] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                            >
                              <option value="High" className="bg-[#120e24]">
                                High
                              </option>
                              <option value="Medium" className="bg-[#120e24]">
                                Medium
                              </option>
                              <option value="Low" className="bg-[#120e24]">
                                Low
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-violet-300 uppercase tracking-wider mb-1">
                              Deadline
                            </label>
                            <input
                              type="date"
                              value={task.suggestedDeadline || meetingDate}
                              onChange={(e) =>
                                handleUpdateTask(task.id, { suggestedDeadline: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#120e24] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                            />
                          </div>
                        </div>

                        {/* Transcript Supporting Evidence Quote */}
                        {task.transcriptQuote && (
                          <div className="p-2 rounded-lg bg-[#0e0a1c]/70 border border-violet-900/20 text-[11px] text-violet-300/60 italic">
                            <span className="font-semibold not-italic text-violet-400 text-[10px] uppercase block mb-0.5">
                              Evidence from Meeting:
                            </span>
                            "{task.transcriptQuote}"
                          </div>
                        )}
                      </div>

                      {/* Remove Task Action */}
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(task.id)}
                        className="p-1.5 rounded-lg text-violet-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. MODAL FOOTER (Pinned bottom, accessible)                */}
        {/* ========================================================= */}
        <div className="flex-shrink-0 pt-4 border-t border-violet-900/30 flex items-center justify-between mt-auto bg-transparent">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApproveAndSend}
            disabled={isSubmitting || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Supabase...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>SEND {selectedCount} SELECTED TASK{selectedCount !== 1 ? 'S' : ''}</span>
              </>
            )}
          </button>
        </div>
      </GlowingEdgeCard>
    </div>
  );
};
