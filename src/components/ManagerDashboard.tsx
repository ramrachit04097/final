import React, { useState, useEffect } from 'react';
import {
  AuthUser,
  TaskStats,
  MeetingItem,
  WorkloadData,
  MeetingDistributionData,
  TaskItem,
  AppPage,
} from '../types';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Clock3,
  ListTodo,
  AlertCircle,
  Plus,
  BarChart3,
  PieChart as PieChartIcon,
  Video,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { GlowingEdgeCard } from './GlowingEdgeCard';
import { useTheme } from '../context/ThemeContext';

interface ManagerDashboardProps {
  user: AuthUser;
  stats: {
    totalEmployees?: number;
    taskStats: TaskStats;
    upcomingMeeting?: MeetingItem | null;
    workload?: WorkloadData[];
    meetingDistribution?: MeetingDistributionData[];
    recentTasks: TaskItem[];
  };
  onNavigate: (page: AppPage) => void;
}

const DONUT_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  user,
  stats,
  onNavigate,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const {
    totalEmployees = 0,
    taskStats = { total: 0, pending: 0, completed: 0, overdue: 0 },
    upcomingMeeting,
    workload = [],
    meetingDistribution = [],
  } = stats;

  // Live Date & Time Clock
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Greeting
  const hour = currentDateTime.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17) {
    greeting = 'Good evening';
  }

  // Format Date & Time strings
  const formattedDate = currentDateTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = currentDateTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 1. Normalized meeting distribution data for AreaChart
  const meetingChartData = (meetingDistribution || []).map((m: any, idx: number) => ({
    name: m.name || m.label || `Meeting ${idx + 1}`,
    durationMinutes: Number(m.durationMinutes ?? m.minutes ?? 0),
  }));

  // 2. Normalized employee workload data for BarChart
  const workloadChartData = (workload || []).map((w: any) => ({
    employeeId: w.employeeId,
    name: w.employeeName || w.name || w.employeeId || 'Staff',
    taskCount: Number(w.taskCount ?? w.tasks ?? 0),
  }));

  // 3. Task distribution data for donut chart
  const taskDistributionData = [
    { name: 'Pending', value: Number(taskStats.pending || 0), color: '#f59e0b' },
    { name: 'Completed', value: Number(taskStats.completed || 0), color: '#10b981' },
    { name: 'Overdue', value: Number(taskStats.overdue || 0), color: '#ef4444' },
  ].filter((item) => item.value > 0);

  // Fallback data for chart if all 0
  const hasTaskData = taskDistributionData.length > 0;

  return (
    <div id="manager-dashboard-root" className="space-y-7 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. HEADER: GREETING, COMPANY NAME, LIVE DATE & TIME        */}
      {/* ========================================================= */}
      <div
        id="dashboard-header-block"
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-violet-900/20"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {greeting}, <span className="text-[#a78bfa]">{user.name}</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1 flex items-center gap-2">
            <span>Workspace:</span>
            <span className="font-semibold text-violet-200">{user.companyName}</span>
            <span className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="font-mono text-violet-300/60">ID: {user.userId}</span>
          </p>
        </div>

        {/* Live Date & Time Display & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#120e24] border border-violet-900/30 flex items-center gap-3 shadow-inner">
            <Clock className="w-4 h-4 text-violet-400" />
            <div className="text-right">
              <div className="text-xs font-bold text-white tracking-wide font-mono">
                {formattedTime}
              </div>
              <div className="text-[10px] text-violet-400/80 font-medium">{formattedDate}</div>
            </div>
          </div>

          <button
            type="button"
            id="dash-quick-add-task-btn"
            onClick={() => onNavigate('tasks')}
            className="px-3.5 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP KPI SECTION: 5 GLOWING EDGE CARDS                   */}
      {/* 1. Total Employees, 2. Total Tasks, 3. Pending Tasks,     */}
      {/* 4. Completed Tasks, 5. Overdue Tasks                      */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* KPI 1: Total Employees */}
        <GlowingEdgeCard
          glowColor="#8b7cff"
          className="p-4"
          onClick={() => onNavigate('employees')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-violet-300/70 uppercase tracking-wider">
              Total Employees
            </span>
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {totalEmployees}
            </span>
            <span className="text-[10px] text-violet-400/80">registered</span>
          </div>
        </GlowingEdgeCard>

        {/* KPI 2: Total Tasks */}
        <GlowingEdgeCard
          glowColor="#8b7cff"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-violet-300/70 uppercase tracking-wider">
              Total Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <ListTodo className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {taskStats.total}
            </span>
            <span className="text-[10px] text-violet-400/80">in pipeline</span>
          </div>
        </GlowingEdgeCard>

        {/* KPI 3: Pending Tasks */}
        <GlowingEdgeCard
          glowColor="#f59e0b"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-300/70 uppercase tracking-wider">
              Pending Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-300 font-mono">
              {taskStats.pending}
            </span>
            <span className="text-[10px] text-amber-400/80">awaiting</span>
          </div>
        </GlowingEdgeCard>

        {/* KPI 4: Completed Tasks */}
        <GlowingEdgeCard
          glowColor="#10b981"
          className="p-4"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300/70 uppercase tracking-wider">
              Completed Tasks
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

        {/* KPI 5: Overdue Tasks */}
        <GlowingEdgeCard
          glowColor="#ef4444"
          className="p-4 col-span-2 sm:col-span-1"
          onClick={() => onNavigate('tasks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-300/70 uppercase tracking-wider">
              Overdue Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-400 font-mono">
              {taskStats.overdue}
            </span>
            <span className="text-[10px] text-rose-400/80">requires review</span>
          </div>
        </GlowingEdgeCard>
      </div>

      {/* ========================================================= */}
      {/* 3. FEATURED "NEXT MEETING" 3D VOLUMETRIC CARD             */}
      {/* ========================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider text-violet-300 uppercase flex items-center gap-2">
            <Video className="w-4 h-4 text-violet-400" />
            Next Scheduled Meeting
          </h2>
          <button
            onClick={() => onNavigate('meetings')}
            className="text-xs text-violet-400 hover:text-white flex items-center gap-1 transition"
          >
            <span>View All Meetings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {upcomingMeeting ? (
          <GlowingEdgeCard
            tilt={true}
            volumetric={true}
            glowColor="#8b7cff"
            className="p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            onClick={() => onNavigate('meetings')}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-300 border border-violet-500/30">
                    UPCOMING
                  </span>
                  <span className="text-xs text-violet-400/70">Meeting ID: {upcomingMeeting.id}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {upcomingMeeting.title}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-violet-300/80 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    <span>{upcomingMeeting.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span>{upcomingMeeting.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-violet-400" />
                    <span>{upcomingMeeting.durationMinutes} Minutes</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('meetings');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Enter Meeting Room</span>
                </button>
              </div>
            </div>
          </GlowingEdgeCard>
        ) : (
          <GlowingEdgeCard glowColor="#6d5df5" className="p-7 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">No upcoming meetings</h3>
              <p className="text-xs text-violet-300/60">
                There are currently no scheduled meetings for this workspace. You can schedule a new meeting or start an ad-hoc session anytime.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  id="empty-schedule-meeting-btn"
                  onClick={() => onNavigate('meetings')}
                  className="px-4 py-2 rounded-xl bg-[#1d163a] hover:bg-[#281f50] border border-violet-800/40 text-violet-200 text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-400" />
                  <span>Schedule Meeting</span>
                </button>
              </div>
            </div>
          </GlowingEdgeCard>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. CHARTS SECTION                                         */}
      {/* 1. Meeting Time Analytics, 2. Employee Workload,          */}
      {/* 3. Task Distribution Donut Chart                         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Meeting Time Trends */}
        <GlowingEdgeCard glowColor="#8b7cff" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#8b7cff]" />
                Meeting Minutes Analyzed
              </h3>
              <span className="text-[10px] text-violet-400 font-mono">Past 7 Days</span>
            </div>
            <p className="text-xs text-violet-300/60 mb-4">
              Total session minutes processed with audio grounding
            </p>
          </div>

          <div className="h-52 w-full min-w-0">
            {meetingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={meetingChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="meetingMinutesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isLight ? '#6366F1' : '#6d5df5'} stopOpacity={isLight ? 0.3 : 0.5} />
                      <stop offset="95%" stopColor={isLight ? '#6366F1' : '#6d5df5'} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#E5E7EB' : '#251a4a'} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={isLight ? '#6B7280' : '#7c6f9f'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isLight ? '#E5E7EB' : '#251a4a' }}
                    tickFormatter={(val) => (val && val.length > 10 ? `${val.slice(0, 9)}…` : val || '')}
                  />
                  <YAxis
                    stroke={isLight ? '#6B7280' : '#7c6f9f'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isLight ? '#E5E7EB' : '#251a4a' }}
                    unit="m"
                  />
                  <RechartsTooltip
                    contentStyle={
                      isLight
                        ? {
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                            fontSize: '11px',
                            color: '#111827',
                          }
                        : {
                            backgroundColor: '#120e24',
                            borderColor: '#4c3a7a',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#FFFFFF',
                          }
                    }
                    formatter={(val: any) => [`${val} minutes`, 'Duration']}
                    labelFormatter={(label: any) => `Meeting: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="durationMinutes"
                    stroke={isLight ? '#6366F1' : '#8b7cff'}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#meetingMinutesGrad)"
                    name="Minutes"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={`h-full flex flex-col items-center justify-center text-xs ${isLight ? 'text-[#9CA3AF]' : 'text-violet-400/50'}`}>
                <span>No meeting minutes recorded yet</span>
              </div>
            )}
          </div>
        </GlowingEdgeCard>

        {/* Chart 2: Employee Workload Distribution */}
        <GlowingEdgeCard glowColor="#6d5df5" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className={`w-4 h-4 ${isLight ? 'text-[#6366F1]' : 'text-[#a78bfa]'}`} />
                Employee Workload
              </h3>
              <span className={`text-[10px] font-mono ${isLight ? 'text-[#6366F1]' : 'text-violet-400'}`}>Live</span>
            </div>
            <p className={`text-xs mb-4 ${isLight ? 'text-[#6B7280]' : 'text-violet-300/60'}`}>
              Assigned tasks breakdown per registered employee
            </p>
          </div>

          <div className="h-52 w-full min-w-0">
            {workloadChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workloadChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#E5E7EB' : '#251a4a'} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={isLight ? '#6B7280' : '#7c6f9f'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isLight ? '#E5E7EB' : '#251a4a' }}
                    tickFormatter={(val) => (val ? String(val).split(' ')[0] : '')}
                  />
                  <YAxis
                    stroke={isLight ? '#6B7280' : '#7c6f9f'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isLight ? '#E5E7EB' : '#251a4a' }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={
                      isLight
                        ? {
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                            fontSize: '11px',
                            color: '#111827',
                          }
                        : {
                            backgroundColor: '#120e24',
                            borderColor: '#4c3a7a',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#FFFFFF',
                          }
                    }
                    formatter={(val: any) => [`${val} task(s)`, 'Assigned Tasks']}
                    labelFormatter={(label: any) => `Employee: ${label}`}
                  />
                  <Bar dataKey="taskCount" fill={isLight ? '#6366F1' : '#8b7cff'} radius={[4, 4, 0, 0]} name="Tasks" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`h-full flex flex-col items-center justify-center text-xs ${isLight ? 'text-[#9CA3AF]' : 'text-violet-400/50'}`}>
                <span>No employee workload assigned</span>
              </div>
            )}
          </div>
        </GlowingEdgeCard>

        {/* Chart 3: Task Status Distribution */}
        <GlowingEdgeCard glowColor="#ec4899" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PieChartIcon className={`w-4 h-4 ${isLight ? 'text-[#EC4899]' : 'text-[#f472b6]'}`} />
                Task Distribution
              </h3>
              <span className={`text-[10px] font-mono ${isLight ? 'text-[#6366F1]' : 'text-violet-400'}`}>Status</span>
            </div>
            <p className={`text-xs mb-2 ${isLight ? 'text-[#6B7280]' : 'text-violet-300/60'}`}>
              Ratio of pending, completed, and overdue tasks
            </p>
          </div>

          <div className="h-36 w-full flex items-center justify-center relative min-w-0">
            {hasTaskData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={
                      isLight
                        ? {
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                            fontSize: '11px',
                            color: '#111827',
                          }
                        : {
                            backgroundColor: '#120e24',
                            borderColor: '#4c3a7a',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#FFFFFF',
                          }
                    }
                    formatter={(val: any, name: any) => [`${val} task(s)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={`h-full flex flex-col items-center justify-center text-xs ${isLight ? 'text-[#9CA3AF]' : 'text-violet-400/50'}`}>
                <span>No tasks to distribute</span>
              </div>
            )}
          </div>

          {/* Visual Legend for task distribution */}
          <div className="mt-2 pt-2 border-t border-violet-900/20 grid grid-cols-3 gap-1 text-[11px] text-center">
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {taskStats.pending}
              </span>
              <span className="text-[10px] text-violet-400/70">Pending</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {taskStats.completed}
              </span>
              <span className="text-[10px] text-violet-400/70">Completed</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                {taskStats.overdue}
              </span>
              <span className="text-[10px] text-violet-400/70">Overdue</span>
            </div>
          </div>
        </GlowingEdgeCard>
      </div>
    </div>
  );
};
