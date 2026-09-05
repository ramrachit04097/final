import React, { useState } from 'react';
import { AlertItem, AuthUser } from '../types';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Filter,
  Check,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface AlertsPageProps {
  user: AuthUser;
  alerts: AlertItem[];
  onRefreshAlerts: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  user,
  alerts,
  onRefreshAlerts,
  onShowToast,
}) => {
  const isManager = user.role === 'Manager';
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'MEETINGS' | 'TASKS' | 'OVERDUE'>('ALL');

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await api.markAlertRead(alertId);
      onShowToast('Alert Dismissed', 'Notification marked as read.', 'info');
      onRefreshAlerts();
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  // Strictly filter: if employee, only recipientId === user.userId or alerts targeted to them
  const scopedAlerts = alerts.filter((alert) => {
    if (!isManager) {
      if (alert.recipientId && alert.recipientId !== user.userId) {
        return false;
      }
      // Employees only receive task-related alerts
      if (alert.type === 'meeting' && alert.recipientRole === 'Manager') {
        return false;
      }
    }
    return true;
  });

  const filteredAlerts = scopedAlerts.filter((alert) => {
    if (activeCategory === 'ALL') return true;
    if (activeCategory === 'MEETINGS') return alert.type === 'meeting';
    if (activeCategory === 'TASKS')
      return alert.type === 'task_deadline' || alert.type === 'task_completed';
    if (activeCategory === 'OVERDUE') return alert.type === 'task_overdue';
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'urgent':
        return {
          glowColor: '#ef4444',
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
        };
      case 'warning':
        return {
          glowColor: '#f59e0b',
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
        };
      default:
        return {
          glowColor: '#8b7cff',
          badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
          icon: <Info className="w-4 h-4 text-violet-400" />,
        };
    }
  };

  const categories = isManager
    ? [
        { id: 'ALL', label: 'All Alerts' },
        { id: 'MEETINGS', label: 'Upcoming Meetings' },
        { id: 'TASKS', label: 'Tasks Due Soon' },
        { id: 'OVERDUE', label: 'Overdue Tasks' },
      ]
    : [
        { id: 'ALL', label: 'My Alerts' },
        { id: 'TASKS', label: 'My Tasks Due' },
        { id: 'OVERDUE', label: 'Overdue Tasks' },
      ];

  return (
    <div id="alerts-page-root" className="space-y-6 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. PAGE HEADER                                            */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-violet-900/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Alerts & Notifications</span>
          </h1>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1">
            {isManager
              ? `Real-time activity alerts, upcoming sessions, and deliverable deadlines across ${user.companyName}.`
              : 'Personal notifications and milestone deadlines for your assigned tasks.'}
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CATEGORY TABS                                          */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(109,93,245,0.4)]'
                  : 'bg-[#120e24] text-violet-300/70 hover:bg-[#1a1433] hover:text-white border border-violet-900/30'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 3. ALERTS LIST (GLOWING EDGE CARDS)                       */}
      {/* ========================================================= */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-3.5">
          {filteredAlerts.map((alert) => {
            const config = getSeverityBadge(alert.severity);

            return (
              <GlowingEdgeCard
                key={alert.id}
                glowColor={config.glowColor}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition ${
                  alert.read ? 'opacity-65' : 'opacity-100'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">{config.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-white tracking-tight">
                        {alert.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${config.badge}`}
                      >
                        {alert.severity}
                      </span>
                      {alert.read && (
                        <span className="text-[10px] text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded font-mono">
                          Read
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-violet-200/80 leading-relaxed max-w-2xl">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <span className="text-[10px] text-violet-400/60 font-mono">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                  {!alert.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="px-3 py-1 text-xs rounded-lg bg-[#120e24] hover:bg-[#1a1433] text-violet-300 hover:text-white border border-violet-900/30 transition cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Dismiss</span>
                    </button>
                  )}
                </div>
              </GlowingEdgeCard>
            );
          })}
        </div>
      ) : (
        <GlowingEdgeCard glowColor="#6d5df5" className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">You're all caught up.</h3>
            <p className="text-xs text-violet-300/60">
              There are no pending alerts or urgent milestone reminders at this time.
            </p>
          </div>
        </GlowingEdgeCard>
      )}
    </div>
  );
};
