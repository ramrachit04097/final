import React from 'react';
import { CheckSquare } from 'lucide-react';

interface RecentTasksProps {
  onViewAllTasks: () => void;
}

export const RecentTasks: React.FC<RecentTasksProps> = ({ onViewAllTasks }) => {
  return (
    <div
      id="recent-tasks-section"
      className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Recent Tasks
        </h3>
        <button
          id="view-all-tasks-link-btn"
          onClick={onViewAllTasks}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold transition-colors cursor-pointer"
        >
          View all tasks
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-10 sm:py-12">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
          <CheckSquare className="w-8 h-8 text-slate-400" strokeWidth={1.8} />
        </div>
        <p className="text-lg font-bold text-slate-900">No recent tasks</p>
        <p className="text-sm text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
          Tasks approved from meetings or added manually will appear here in the dashboard.
        </p>
      </div>
    </div>
  );
};
