import React from 'react';
import { AuthUser, TaskStats, TaskItem, AppPage } from '../types';
import {
  User,
  Briefcase,
  Building2,
  ListTodo,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { GlowingEdgeCard } from './GlowingEdgeCard';
import { useTheme } from '../context/ThemeContext';

interface EmployeeDashboardProps {
  user: AuthUser;
  stats: {
    taskStats: TaskStats;
    recentTasks: TaskItem[];
  };
  onNavigate: (page: AppPage) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  user,
  stats,
  onNavigate,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const {
    taskStats = { total: 0, pending: 0, completed: 0, overdue: 0 },
    recentTasks = [],
  } = stats;

  // Filter pending / in-progress tasks for upcoming deadlines
  const activeTasks = recentTasks
    .filter((t) => t.status !== 'Completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  return (
    <div id="employee-dashboard-root" className={`space-y-7 max-w-7xl mx-auto ${isLight ? 'text-[#111827]' : 'text-white'}`}>
      {/* ========================================================= */}
      {/* 1. HEADER: EMPLOYEE WELCOME / IDENTITY                     */}
      {/* ========================================================= */}
      <div
        id="employee-header-block"
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b ${
          isLight ? 'border-[#E5E7EB]' : 'border-violet-900/20'
        }`}
      >
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLight ? 'text-[#111827]' : 'text-white'}`}>
            Welcome back, <span className={isLight ? 'text-[#4F46E5]' : 'text-[#a78bfa]'}>{user.name}</span>
          </h1>
          <p className={`text-xs sm:text-sm mt-1 flex items-center gap-2 ${isLight ? 'text-[#6B7280]' : 'text-violet-300/70'}`}>
            <span>Workspace:</span>
            <span className={`font-semibold ${isLight ? 'text-[#111827]' : 'text-violet-200'}`}>{user.companyName}</span>
            <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-indigo-400' : 'bg-violet-400'}`} />
            <span className={`font-mono ${isLight ? 'text-[#6B7280]' : 'text-violet-300/60'}`}>ID: {user.userId}</span>
            {user.post && (
              <>
                <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-indigo-400' : 'bg-violet-400'}`} />
                <span className={isLight ? 'text-[#4B5563]' : 'text-violet-300'}>{user.post}</span>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          id="emp-dash-view-tasks-btn"
          onClick={() => onNavigate('tasks')}
          className="px-4 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>My Assigned Tasks</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2. EMPLOYEE IDENTITY CARD                                 */}
      {/* ========================================================= */}
      <GlowingEdgeCard glowColor="#8b7cff" className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] border border-indigo-200/60 flex items-center justify-center text-white font-bold text-base shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-[#111827]' : 'text-white'}`}>{user.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-[#6B7280]' : 'text-violet-300/70'}`}>{user.post || 'Team Member'}</p>
            </div>
          </div>

          <div className={`flex items-center gap-2.5 text-xs px-3.5 py-2 rounded-xl border ${
            isLight
              ? 'bg-[#EEF2FF] border-[#E0E7FF] text-[#4F46E5]'
              : 'bg-[#120e24] border-violet-900/30 text-violet-400/80'
          }`}>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Scoped Access: Personal Deliverables Only</span>
          </div>
        </div>
      </GlowingEdgeCard>

      {/* ========================================================= */}
      {/* 3. MY TASKS SUMMARY: 4 GLOWING EDGE CARDS                 */}
      {/* Pending, In Progress, Completed, Overdue                  */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Pending */}
        <GlowingEdgeCard
          glowColor="#f59e0b"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-300/70 uppercase tracking-wider">
              Pending
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-300 font-mono">
              {taskStats.pending}
            </span>
            <span className="text-[10px] text-amber-400/80">awaiting start</span>
          </div>
        </GlowingEdgeCard>

        {/* In Progress */}
        <GlowingEdgeCard
          glowColor="#8b7cff"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-violet-300/70 uppercase tracking-wider">
              In Progress
            </span>
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <Clock3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-violet-300 font-mono">
              {Math.max(0, taskStats.total - taskStats.completed - taskStats.overdue - taskStats.pending)}
            </span>
            <span className="text-[10px] text-violet-400/80">in progress</span>
          </div>
        </GlowingEdgeCard>

        {/* Completed */}
        <GlowingEdgeCard
          glowColor="#10b981"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300/70 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-300 font-mono">
              {taskStats.completed}
            </span>
            <span className="text-[10px] text-emerald-400/80">resolved</span>
          </div>
        </GlowingEdgeCard>

        {/* Overdue */}
        <GlowingEdgeCard
          glowColor="#ef4444"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-300/70 uppercase tracking-wider">
              Overdue
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-400 font-mono">
              {taskStats.overdue}
            </span>
            <span className="text-[10px] text-rose-400/80">past deadline</span>
          </div>
        </GlowingEdgeCard>
      </div>

      {/* ========================================================= */}
      {/* 4. UPCOMING DEADLINES & DELIVERABLES                       */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider text-violet-300 uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            Upcoming Deliverables & Deadlines
          </h2>
          <button
            onClick={() => onNavigate('tasks')}
            className="text-xs text-violet-400 hover:text-white flex items-center gap-1 transition"
          >
            <span>Manage All Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTasks.map((task) => (
              <GlowingEdgeCard
                key={task.id}
                glowColor={task.status === 'Overdue' ? '#ef4444' : '#8b7cff'}
                className="p-5"
                onClick={() => onNavigate('tasks')}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      task.status === 'Overdue'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : task.status === 'Pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {task.status}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-violet-300/80 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    <span>Due {task.deadline}</span>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-white tracking-tight line-clamp-2 mt-1">
                  {task.subject}
                </h4>

                <div className="mt-4 pt-3 border-t border-violet-900/30 flex items-center justify-between text-xs text-violet-400/70">
                  <span>Assigned: {task.assignedDate}</span>
                  <span className="text-[#a78bfa] hover:underline flex items-center gap-1">
                    Update Status <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </GlowingEdgeCard>
            ))}
          </div>
        ) : (
          <GlowingEdgeCard glowColor="#6d5df5" className="p-8 text-center">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white">All caught up!</h3>
              <p className="text-xs text-violet-300/60">
                You have no pending or overdue deliverables at this time.
              </p>
            </div>
          </GlowingEdgeCard>
        )}
      </div>
    </div>
  );
};
