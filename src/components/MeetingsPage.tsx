import React, { useState } from 'react';
import { MeetingItem, AuthUser } from '../types';
import {
  Plus,
  Calendar,
  Clock,
  Video,
  X,
  Check,
  Loader2,
  CalendarDays,
  Search,
  Mic,
  Play,
  FileText,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';
import { useTheme } from '../context/ThemeContext';

interface MeetingsPageProps {
  user: AuthUser;
  meetings: MeetingItem[];
  onRefreshMeetings: () => void;
  onOpenRecorder?: (meetingId?: string) => void;
  onNavigateTranscripts?: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const MeetingsPage: React.FC<MeetingsPageProps> = ({
  user,
  meetings,
  onRefreshMeetings,
  onOpenRecorder,
  onNavigateTranscripts,
  onShowToast,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [saving, setSaving] = useState(false);

  // Delete meeting state
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    try {
      setDeletingId(meetingId);
      await api.deleteMeeting(meetingId);
      onShowToast('Meeting Deleted', `"${meetingTitle}" was removed from the schedule.`, 'success');
      setMeetingToDelete(null);
      onRefreshMeetings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete meeting.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      onShowToast('Incomplete Fields', 'Please provide a title, date, and time.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await api.addMeeting({
        title: title.trim(),
        date,
        time,
        durationMinutes: Number(durationMinutes) || 30,
      });

      onShowToast('Meeting Scheduled', `"${title}" was added to your calendar.`, 'success');
      setShowScheduleModal(false);
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('10:00');
      onRefreshMeetings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule meeting.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setSaving(false);
    }
  };

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="meetings-page-root" className="space-y-6 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & ACTIONS                                   */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-violet-900/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Meetings</span>
          </h1>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1">
            Conduct discussions, record live audio, and extract accountable action items for {user.companyName}.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {onOpenRecorder && (
            <button
              type="button"
              id="record-meeting-header-btn"
              onClick={() => onOpenRecorder()}
              className="px-4 py-2.5 rounded-xl bg-violet-900/40 hover:bg-violet-800/60 text-violet-200 hover:text-white text-xs font-semibold border border-violet-700/40 flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Mic className="w-4 h-4 text-violet-400" />
              <span>Record & Transcribe</span>
            </button>
          )}

          <button
            type="button"
            id="schedule-meeting-btn"
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 3D FEATURED MEETING HERO: START MEETING                */}
      {/* ========================================================= */}
      <GlowingEdgeCard
        tilt={true}
        glowColor="#8b7cff"
        className="p-6 sm:p-7 relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 border border-violet-500/30 text-violet-300">
              <Mic className="w-3.5 h-3.5 text-violet-400" />
              <span>Interactive Session Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Ready to start your next meeting?
            </h2>
            <p className="text-xs sm:text-sm text-violet-300/70 leading-relaxed">
              Launch our live audio recorder to capture speaking turns with speech recognition. Raw transcripts are preserved in cloud storage for transparent review.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {onOpenRecorder && (
              <button
                type="button"
                onClick={() => onOpenRecorder()}
                className="px-6 py-3 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_25px_rgba(109,93,245,0.5)] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Live Meeting</span>
              </button>
            )}

            {onNavigateTranscripts && (
              <button
                type="button"
                onClick={onNavigateTranscripts}
                className="px-5 py-3 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-200 text-xs font-semibold border border-violet-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-violet-400" />
                <span>View Transcripts</span>
              </button>
            )}
          </div>
        </div>
      </GlowingEdgeCard>

      {/* ========================================================= */}
      {/* 3. SEARCH INPUT                                           */}
      {/* ========================================================= */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-violet-400/60" />
        <input
          type="text"
          id="meetings-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search scheduled meetings by title..."
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#120e24] border border-violet-900/30 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* ========================================================= */}
      {/* 4. MEETINGS GRID WITH 3D GLOWING EDGE CARDS               */}
      {/* ========================================================= */}
      {filteredMeetings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMeetings.map((mtg) => (
            <GlowingEdgeCard
              key={mtg.id}
              tilt={true}
              glowColor="#8b7cff"
              className="p-5 flex flex-col justify-between shadow-[0_15px_35px_rgba(0,0,0,0.5)]"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-300 border border-violet-500/30">
                    SCHEDULED
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-violet-300/80 font-mono">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span>{mtg.durationMinutes} min</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight line-clamp-2 mb-3">
                  {mtg.title}
                </h3>

                <div className="space-y-1.5 py-2.5 border-t border-violet-900/30 text-xs text-violet-300/80 font-mono">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    <span>{mtg.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span>{mtg.time}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-violet-900/20 flex items-center justify-between gap-2">
                {onOpenRecorder ? (
                  <button
                    type="button"
                    onClick={() => onOpenRecorder(mtg.id)}
                    className="text-xs text-[#a78bfa] hover:text-white flex items-center gap-1.5 font-semibold transition cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Record Audio</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-violet-400/60">Ready</span>
                )}

                <button
                  type="button"
                  id={`delete-meeting-${mtg.id}-btn`}
                  onClick={() => setMeetingToDelete({ id: mtg.id, title: mtg.title })}
                  disabled={deletingId === mtg.id}
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                    isLight
                      ? 'text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEF2F2] border border-[#FEE2E2]'
                      : 'text-rose-400 hover:text-rose-200 hover:bg-rose-500/15 border border-rose-500/20'
                  }`}
                  title="Delete scheduled meeting"
                  aria-label="Delete scheduled meeting"
                >
                  {deletingId === mtg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete</span>
                </button>
              </div>
            </GlowingEdgeCard>
          ))}
        </div>
      ) : (
        <GlowingEdgeCard glowColor="#6d5df5" className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No scheduled sessions</h3>
            <p className="text-xs text-violet-300/60">
              Schedule future syncs or launch an ad-hoc live recording session to generate accountable transcripts.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] inline-flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule First Meeting</span>
              </button>
            </div>
          </div>
        </GlowingEdgeCard>
      )}

      {/* ========================================================= */}
      {/* 5. SCHEDULE MEETING MODAL                                 */}
      {/* ========================================================= */}
      {showScheduleModal && (
        <div
          id="schedule-meeting-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <GlowingEdgeCard
            glowColor="#8b7cff"
            className="w-full max-w-md p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Schedule Meeting</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMeeting} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Meeting Title / Purpose
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Deliverables & Roadmapping"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-violet-900/30">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Schedule Session</span>
                  )}
                </button>
              </div>
            </form>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. DELETE MEETING CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {meetingToDelete && (
        <div
          id="delete-meeting-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 ${
              isLight
                ? 'bg-white border-[#E5E7EB] text-[#111827]'
                : 'bg-[#0f0b21] border-rose-900/40 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-[#111827]' : 'text-white'}`}>
                  Delete Scheduled Meeting
                </h3>
                <p className={`text-xs ${isLight ? 'text-[#6B7280]' : 'text-rose-300/80'}`}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isLight ? 'text-[#374151]' : 'text-violet-200/80'}`}>
              Are you sure you want to delete the meeting{' '}
              <strong className={isLight ? 'text-[#111827]' : 'text-white'}>
                "{meetingToDelete.title}"
              </strong>
              ? It will be removed from your upcoming schedule and calendar.
            </p>

            <div className={`flex items-center justify-end gap-3 pt-3 border-t ${isLight ? 'border-[#E5E7EB]' : 'border-violet-900/30'}`}>
              <button
                type="button"
                onClick={() => setMeetingToDelete(null)}
                disabled={Boolean(deletingId)}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition cursor-pointer disabled:opacity-50 ${
                  isLight
                    ? 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border-[#D1D5DB]'
                    : 'bg-violet-900/40 hover:bg-violet-800/60 text-violet-200 border-violet-700/40'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-meeting-btn"
                onClick={() => handleDeleteMeeting(meetingToDelete.id, meetingToDelete.title)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Meeting</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
