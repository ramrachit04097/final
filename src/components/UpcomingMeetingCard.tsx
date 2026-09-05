import React from 'react';
import { Calendar } from 'lucide-react';

interface UpcomingMeetingCardProps {
  onScheduleClick?: () => void;
}

export const UpcomingMeetingCard: React.FC<UpcomingMeetingCardProps> = ({ onScheduleClick }) => {
  return (
    <div
      id="upcoming-meeting-card"
      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full"
    >
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">
          Upcoming Meeting
        </h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-2">
            <Calendar className="w-6 h-6 text-slate-400" strokeWidth={1.8} />
          </div>
          <p className="font-semibold text-slate-900 text-sm">No upcoming meetings</p>
          <p className="text-xs text-slate-400 mt-1">Schedule a meeting to see it here.</p>
        </div>
      </div>

      <button
        id="quick-schedule-meeting-btn"
        onClick={onScheduleClick}
        className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-semibold text-sm rounded-lg border border-slate-200 transition-colors cursor-pointer"
      >
        Schedule Meeting
      </button>
    </div>
  );
};
