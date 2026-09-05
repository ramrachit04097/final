import {
  AuthUser,
  LoginFormData,
  ManagerRegisterFormData,
  EmployeeRegisterFormData,
  EmployeeRegistrationRequest,
  EmployeeUser,
  TaskItem,
  MeetingItem,
  AlertItem,
  TaskStats,
  WorkloadData,
  MeetingDistributionData,
  SpeakerUtterance,
  AIAnalysisResult,
  TranscriptRecord,
} from '../types';

import {
  authService,
  getStoredToken,
  getStoredUser,
  setStoredSession,
  clearStoredSession,
} from './authService';
import { employeeService } from './employeeService';
import { meetingService } from './meetingService';
import { taskService } from './taskService';
import { alertService } from './alertService';
import { aiService } from './aiService';
import { transcriptService } from './transcriptService';

export {
  getStoredToken,
  getStoredUser,
  setStoredSession,
  clearStoredSession,
};

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data as T;
}

export const api = {
  // Auth
  getCompanies: () => authService.getCompanies(),
  checkUserIdAvailability: (userId: string) => authService.checkUserIdAvailability(userId),
  checkUserExists: (userId: string) => authService.checkUserExists(userId),
  registerManager: (formData: ManagerRegisterFormData) => authService.registerManager(formData),
  registerEmployee: (formData: EmployeeRegisterFormData) => authService.registerEmployee(formData),
  login: (credentials: LoginFormData) => authService.login(credentials),
  logout: () => authService.logout(),
  getMe: () => authService.getMe(),

  // Forgot Password
  initiateForgotPassword: (userId: string) => authService.initiateForgotPassword(userId),
  verifyResetOtp: (sessionId: string, otp: string) => authService.verifyResetOtp(sessionId, otp),
  resendResetOtp: (sessionId: string) => authService.resendResetOtp(sessionId),
  resetPassword: (params: { resetToken: string; newPassword: string; confirmPassword: string }) =>
    authService.resetPassword(params),

  // Employee Registration Requests (Manager)
  getEmployeeRequests: () => authService.getEmployeeRequests(),
  approveEmployeeRequest: (requestId: string) => authService.approveEmployeeRequest(requestId),
  denyEmployeeRequest: (requestId: string) => authService.denyEmployeeRequest(requestId),

  // Employees
  getEmployees: () => employeeService.getEmployees(),
  addEmployee: (params: {
    employeeName: string;
    employeeId: string;
    employeePost: string;
    password: string;
  }) => employeeService.addEmployee(params),
  deleteEmployee: (employeeId: string) => employeeService.deleteEmployee(employeeId),

  // Tasks
  getTasks: () => taskService.getTasks(),
  addTask: (params: {
    employeeId: string;
    subject: string;
    description?: string;
    assignedDate: string;
    deadline: string;
    status?: string;
  }) => taskService.addTask(params),
  updateTask: (
    taskId: string,
    updates: {
      employeeId?: string;
      employeeName?: string;
      employeePost?: string;
      subject?: string;
      description?: string;
      assignedDate?: string;
      deadline?: string;
      status?: string;
    }
  ) => taskService.updateTask(taskId, updates),
  deleteTask: (taskId: string) => taskService.deleteTask(taskId),
  bulkCreateTasks: (
    tasks: Array<{
      employeeId: string;
      subject: string;
      assignedDate?: string;
      deadline: string;
      priority?: string;
    }>
  ) => taskService.bulkCreateTasks(tasks),

  // Meetings
  getMeetings: () => meetingService.getMeetings(),
  addMeeting: (params: {
    title: string;
    date: string;
    time: string;
    durationMinutes: number;
  }) => meetingService.addMeeting(params),
  deleteMeeting: (meetingId: string) => meetingService.deleteMeeting(meetingId),

  // Transcripts
  getTranscripts: (companyId?: string) => transcriptService.getTranscripts(companyId),
  saveTranscript: (data: Omit<TranscriptRecord, 'id' | 'recordedAt' | 'expiresAt'> & { id?: string; recordedAt?: string }) =>
    transcriptService.saveTranscript(data),
  getTranscriptById: (id: string) => transcriptService.getTranscriptById(id),
  updateTranscript: (id: string, updates: Partial<TranscriptRecord>) =>
    transcriptService.updateTranscript(id, updates),
  deleteTranscript: (id: string) => transcriptService.deleteTranscript(id),

  // Audio & AI Analysis (server-side Gemini)
  transcribeMeetingAudio: (params: {
    audioBase64?: string;
    liveTranscript?: string;
    meetingTitle?: string;
  }) => aiService.transcribeMeetingAudio(params),
  analyzeTranscript: (params: {
    meetingTitle: string;
    meetingDate?: string;
    transcriptText: string;
    employees?: EmployeeUser[];
    attendees?: string[];
  }) => aiService.analyzeTranscript(params),
  chatWithTranscript: (params: {
    transcriptId: string;
    question: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
    meetingTitle?: string;
    meetingDate?: string;
    durationSeconds?: number;
    rawTranscriptText?: string;
  }) => aiService.chatWithTranscript(params),
  chatWithAssistant: (params: {
    question: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
  }) => aiService.chatWithAssistant(params),

  // Alerts
  getAlerts: () => alertService.getAlerts(),
  markAlertRead: (alertId: string) => alertService.markAlertRead(alertId),

  // Dashboard Stats
  async getStats(): Promise<{
    totalEmployees?: number;
    taskStats: TaskStats;
    upcomingMeeting?: MeetingItem | null;
    workload?: WorkloadData[];
    meetingDistribution?: MeetingDistributionData[];
    recentTasks: TaskItem[];
  }> {
    return fetchAPI('/api/stats');
  },
};
