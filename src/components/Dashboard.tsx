import React from 'react';
import { AuthUser, TaskStats, MeetingItem, WorkloadData, MeetingDistributionData, TaskItem, AppPage } from '../types';
import { ManagerDashboard } from './ManagerDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';
import { FloatingAssistant } from './FloatingAssistant';

interface DashboardProps {
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
  onShowToast?: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, stats, onNavigate, onShowToast }) => {
  return (
    <div id="dashboard-wrapper" className="relative min-h-full">
      {user.role === 'Manager' ? (
        <ManagerDashboard user={user} stats={stats} onNavigate={onNavigate} />
      ) : (
        <EmployeeDashboard user={user} stats={stats} onNavigate={onNavigate} />
      )}

      {/* Global Floating AI Assistant (MAIN DASHBOARD ONLY) */}
      <FloatingAssistant user={user} onShowToast={onShowToast} />
    </div>
  );
};
