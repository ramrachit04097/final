export type UserRole = 'Manager' | 'Employee';

export type ManagerPage = 'dashboard' | 'meetings' | 'transcripts' | 'tasks' | 'employees' | 'alerts';
export type EmployeePage = 'dashboard' | 'tasks' | 'alerts';
export type AppPage = ManagerPage | EmployeePage;

export interface Company {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ManagerUser {
  id: string;
  managerId: string;
  managerName: string;
  companyId: string;
  companyEmail: string;
  role: 'Manager';
  createdAt: string;
}

export interface EmployeeUser {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePost: string;
  companyId: string;
  role: 'Employee';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLogin?: string;
  assignedTasksCount?: number;
}

export type AuthUser = {
  id: string;
  role: UserRole;
  name: string;
  userId: string;
  companyId: string;
  companyName: string;
  companyEmail: string;
  post?: string;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

export interface TaskItem {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeePost: string;
  subject: string;
  description?: string;
  assignedDate: string;
  deadline: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingItem {
  id: string;
  companyId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  createdAt: string;
}

export type AlertSeverity = 'info' | 'warning' | 'urgent';

export interface AlertItem {
  id: string;
  companyId: string;
  recipientRole: UserRole;
  recipientId?: string; // employeeId if employee-specific
  type: 'meeting' | 'task_deadline' | 'task_overdue' | 'task_completed';
  title: string;
  description: string;
  severity: AlertSeverity;
  createdAt: string;
  read: boolean;
  relatedTaskId?: string;
  relatedMeetingId?: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export interface WorkloadData {
  employeeId: string;
  employeeName: string;
  taskCount: number;
}

export interface MeetingDistributionData {
  name: string;
  durationMinutes: number;
}

export interface LoginFormData {
  companyEmail: string;
  userType: UserRole;
  userId: string;
  password: string;
}

export interface ManagerRegisterFormData {
  companyName: string;
  companyEmail: string;
  personalEmail: string;
  managerName: string;
  managerId: string;
  password: string;
  confirmPassword: string;
}

export interface EmployeeRegisterFormData {
  name: string;
  userId: string;
  password: string;
  confirmPassword: string;
  personalEmail: string;
  companyEmail: string;
  employeeId: string;
  employeePost: string;
  companyId: string;
}

export interface EmployeeRegistrationRequest {
  id: string;
  name: string;
  userId: string;
  personalEmail: string;
  companyEmail: string;
  employeeId: string;
  employeePost: string;
  companyId: string;
  companyName: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'warning' | 'success';
}

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

export interface AITaskSuggestion {
  id: string;
  subject: string;
  description: string;
  suggestedEmployeeId: string;
  suggestedEmployeeName: string;
  suggestedDeadline: string; // YYYY-MM-DD
  priority: 'High' | 'Medium' | 'Low';
  confidence: number; // 0-100
  transcriptQuote: string;
  selected?: boolean; // For manager approval checkbox
}

export interface AIAnalysisResult {
  meetingSummary: string;
  keyDiscussionPoints: string[];
  actionItems: AITaskSuggestion[];
}

export interface TranscriptRecord {
  id: string;
  meetingId?: string;
  meetingTitle: string;
  companyId: string;
  recordedAt: string; // ISO string
  expiresAt: string;  // ISO string (recordedAt + 7 days)
  durationSeconds: number;
  transcriptText: string;
  summary?: string;
  keyPoints?: string[];
  speakers?: SpeakerUtterance[];
  actionItems?: AITaskSuggestion[];
  status: 'pending_review' | 'reviewed' | 'archived';
  aiStatus?: 'NOT ANALYZED' | 'AI ANALYZED' | 'AI ANALYSIS FAILED';
  audioStoragePath?: string;
}
