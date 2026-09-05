/**
 * MeetFlow - Full-Stack Meeting Accountability & Task Platform
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TasksPage } from './components/TasksPage';
import { EmployeesPage } from './components/EmployeesPage';
import { MeetingsPage } from './components/MeetingsPage';
import { AlertsPage } from './components/AlertsPage';
import { TranscriptsPage } from './components/TranscriptsPage';
import { MeetingRecorderModal } from './components/MeetingRecorderModal';
import { TaskReviewModal } from './components/TaskReviewModal';
import { LogoutModal } from './components/LogoutModal';
import { ToastContainer } from './components/Toast';
import {
  AuthUser,
  AppPage,
  TaskItem,
  EmployeeUser,
  MeetingItem,
  AlertItem,
  ToastMessage,
  TaskStats,
  WorkloadData,
  MeetingDistributionData,
  AIAnalysisResult,
} from './types';
import { api, getStoredToken, getStoredUser } from './services/api';
import { Loader2 } from 'lucide-react';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser());
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Navigation
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Modals & Feedback
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Meeting Recording & AI Review Modals
  const [recorderOpen, setRecorderOpen] = useState<boolean>(false);
  const [recorderPreselectedMeetingId, setRecorderPreselectedMeetingId] = useState<string>('');

  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [reviewAnalysis, setReviewAnalysis] = useState<AIAnalysisResult | null>(null);
  const [reviewMeetingTitle, setReviewMeetingTitle] = useState<string>('');
  const [reviewMeetingDate, setReviewMeetingDate] = useState<string>('');
  const [reviewTranscriptId, setReviewTranscriptId] = useState<string | undefined>(undefined);
  const [reviewTempTranscriptData, setReviewTempTranscriptData] = useState<{
    meetingTitle: string;
    transcriptText: string;
    durationSeconds: number;
    recordedAt?: string;
    audioBlob?: Blob | null;
  } | undefined>(undefined);

  // Workspace Data Collections
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<{
    totalEmployees?: number;
    taskStats: TaskStats;
    upcomingMeeting?: MeetingItem | null;
    workload?: WorkloadData[];
    meetingDistribution?: MeetingDistributionData[];
    recentTasks: TaskItem[];
  }>({
    taskStats: { total: 0, pending: 0, completed: 0, overdue: 0 },
    recentTasks: [],
  });

  const showToast = useCallback(
    (title: string, description?: string, type: 'info' | 'warning' | 'success' = 'info') => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      const newToast: ToastMessage = { id, title, description, type };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch all workspace data according to current role
  const refreshWorkspaceData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch tasks & stats (available for both roles)
      const [fetchedTasks, fetchedAlerts, fetchedStats] = await Promise.all([
        api.getTasks(),
        api.getAlerts(),
        api.getStats(),
      ]);

      setTasks(fetchedTasks);
      setAlerts(fetchedAlerts);
      setStats(fetchedStats);

      // 2. Fetch manager-only resources
      if (currentUser.role === 'Manager') {
        const [fetchedEmployees, fetchedMeetings] = await Promise.all([
          api.getEmployees(),
          api.getMeetings(),
        ]);
        setEmployees(fetchedEmployees);
        setMeetings(fetchedMeetings);
      }
    } catch (err) {
      console.error('Failed to sync workspace data:', err);
    }
  }, [currentUser]);

  // Verify stored session on app mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsInitializing(false);
      return;
    }

    api
      .getMe()
      .then((user) => {
        setCurrentUser(user);
      })
      .catch((err) => {
        console.warn('Session expired or invalid, please sign in:', err);
        setCurrentUser(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  // Sync workspace data whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      refreshWorkspaceData();
    }
  }, [currentUser, refreshWorkspaceData]);

  // Role Protection: Guard against employee accessing Manager pages
  useEffect(() => {
    if (currentUser && currentUser.role === 'Employee') {
      if (activePage === 'meetings' || activePage === 'employees' || activePage === 'transcripts') {
        setActivePage('dashboard');
      }
    }
  }, [currentUser, activePage]);

  // Recorder and Review Handlers
  const handleOpenRecorder = (meetingId?: string) => {
    setRecorderPreselectedMeetingId(meetingId || '');
    setRecorderOpen(true);
  };

  const handleAnalysisReady = (
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
  ) => {
    setReviewAnalysis(analysis);
    setReviewMeetingTitle(meetingTitle);
    setReviewMeetingDate(meetingDate);
    setReviewTranscriptId(transcriptId);
    setReviewTempTranscriptData(tempTranscriptData);
    setReviewModalOpen(true);
  };

  const handleOpenReviewFromTranscript = (
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
  ) => {
    setReviewAnalysis(analysis);
    setReviewMeetingTitle(meetingTitle);
    setReviewMeetingDate(meetingDate);
    setReviewTranscriptId(transcriptId);
    setReviewTempTranscriptData(tempTranscriptData);
    setReviewModalOpen(true);
  };

  const handleTasksApproved = (count: number) => {
    refreshWorkspaceData();
  };

  // Login handler
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActivePage('dashboard');
  };

  // Logout handler
  const handleConfirmLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      setCurrentUser(null);
      setActivePage('dashboard');
      setLogoutModalOpen(false);
      setTasks([]);
      setEmployees([]);
      setMeetings([]);
      setAlerts([]);
      showToast('Signed Out', 'You have been safely signed out.', 'info');
    }
  };

  // Loading spinner during initial session check
  if (isInitializing) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${isLight ? 'bg-white text-[#111827]' : 'bg-[#0d091b] text-white'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/25">
            M
          </div>
          <Loader2 className="w-6 h-6 text-[#6366F1] animate-spin" />
          <span className={`text-xs font-semibold ${isLight ? 'text-[#6B7280]' : 'text-violet-300'}`}>Initializing MeetFlow...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} onShowToast={showToast} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Dynamic unread count for sidebar
  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  return (
    <div
      id="meetflow-app-root"
      className={`h-screen w-full flex overflow-hidden font-sans antialiased ${
        isLight ? 'bg-white text-[#111827]' : 'bg-[#0d091b] text-white'
      }`}
    >
      {/* Navigation Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        activePage={activePage}
        userRole={currentUser.role}
        unreadAlertsCount={unreadAlertsCount}
        onNavigate={(page) => setActivePage(page)}
        onLogoutClick={() => setLogoutModalOpen(true)}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isLight ? 'bg-white' : 'bg-[#0d091b]'}`}>
        {/* Top Header */}
        <Header
          user={currentUser}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onLogoutClick={() => setLogoutModalOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main
          id="main-content-viewport"
          className={`flex-1 overflow-y-auto p-4 sm:p-7 lg:p-9 ${
            isLight ? 'bg-[#FAFAFC]' : 'bg-gradient-to-b from-[#110a24] to-[#0d091b]'
          }`}
        >
          {activePage === 'dashboard' && (
            <Dashboard
              user={currentUser}
              stats={stats}
              onNavigate={(page) => setActivePage(page)}
              onShowToast={showToast}
            />
          )}

          {activePage === 'tasks' && (
            <TasksPage
              user={currentUser}
              tasks={tasks}
              employees={employees}
              onRefreshTasks={refreshWorkspaceData}
              onShowToast={showToast}
            />
          )}

          {activePage === 'employees' && currentUser.role === 'Manager' && (
            <EmployeesPage
              user={currentUser}
              employees={employees}
              onRefreshEmployees={refreshWorkspaceData}
              onShowToast={showToast}
            />
          )}

          {activePage === 'meetings' && currentUser.role === 'Manager' && (
            <MeetingsPage
              user={currentUser}
              meetings={meetings}
              onRefreshMeetings={refreshWorkspaceData}
              onOpenRecorder={handleOpenRecorder}
              onShowToast={showToast}
            />
          )}

          {activePage === 'transcripts' && currentUser.role === 'Manager' && (
            <TranscriptsPage
              user={currentUser}
              employees={employees}
              meetings={meetings}
              onOpenRecorder={() => handleOpenRecorder()}
              onOpenReview={handleOpenReviewFromTranscript}
              onShowToast={showToast}
            />
          )}

          {activePage === 'alerts' && (
            <AlertsPage
              user={currentUser}
              alerts={alerts}
              onRefreshAlerts={refreshWorkspaceData}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Meeting Recorder Modal (MediaRecorder + Web Speech + AssemblyAI) */}
      {currentUser.role === 'Manager' && (
        <MeetingRecorderModal
          isOpen={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          meetings={meetings}
          employees={employees}
          onAnalysisReady={handleAnalysisReady}
          onShowToast={showToast}
        />
      )}

      {/* Task Review Modal (AI Suggests -> Manager Reviews -> Manager Approves) */}
      {currentUser.role === 'Manager' && reviewAnalysis && (
        <TaskReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewTempTranscriptData(undefined);
          }}
          meetingTitle={reviewMeetingTitle}
          meetingDate={reviewMeetingDate}
          analysisResult={reviewAnalysis}
          transcriptId={reviewTranscriptId}
          tempTranscriptData={reviewTempTranscriptData}
          employees={employees}
          onTasksApproved={handleTasksApproved}
          onTranscriptSaved={() => {
            refreshWorkspaceData();
          }}
          onShowToast={showToast}
        />
      )}

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        userName={currentUser.name}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
