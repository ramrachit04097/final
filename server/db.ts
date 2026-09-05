import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DBCompany {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface DBManager {
  id: string;
  managerId: string;
  managerName: string;
  companyId: string;
  companyEmail: string;
  personalEmail: string;
  authUserId?: string;
  passwordHash: string;
  role: 'Manager';
  createdAt: string;
}

export interface DBEmployee {
  id: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  employeePost: string;
  companyId: string;
  personalEmail: string;
  companyEmail: string;
  authUserId?: string;
  passwordHash: string;
  role: 'Employee';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastLogin?: string;
}

export interface DBEmployeeRequest {
  id: string; // employee_request_id
  name: string;
  userId: string;
  personalEmail: string;
  companyEmail: string;
  employeeId: string;
  employeePost: string;
  companyId: string;
  companyName: string;
  passwordHash: string;
  authUserId?: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DBPasswordResetSession {
  id: string;
  userId: string;
  userRole: 'Manager' | 'Employee';
  targetId: string; // manager.id or employee.id
  personalEmail: string;
  maskedEmail: string;
  salt: string;
  otpHash: string; // HASH ONLY - Plaintext OTP is NEVER stored
  otpExpiresAt: string;
  attempts: number;
  verified: boolean;
  resetToken?: string;
  resetTokenExpiresAt?: string;
  createdAt: string;
  usedAt?: string;
  lastRequestedAt: number;
}

export interface DBTask {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeePost: string;
  subject: string;
  description?: string;
  assignedDate: string; // YYYY-MM-DD
  deadline: string;     // YYYY-MM-DD
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  createdAt: string;
  updatedAt: string;
}

export interface DBMeeting {
  id: string;
  companyId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  createdAt: string;
}

export interface DBAlert {
  id: string;
  companyId: string;
  recipientRole: 'Manager' | 'Employee';
  recipientId?: string; // employeeId if employee-specific
  type: 'meeting' | 'task_deadline' | 'task_overdue' | 'task_completed';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'urgent';
  createdAt: string;
  read: boolean;
  relatedTaskId?: string;
  relatedMeetingId?: string;
}

export interface DBTranscript {
  id: string;
  companyId: string;
  meetingId?: string;
  meetingTitle: string;
  transcriptText: string;
  durationSeconds: number;
  recordedAt: string;
  expiresAt: string;
  summary?: string;
  keyPoints?: string[];
  speakers?: any[];
  actionItems?: any[];
  status: 'pending_review' | 'reviewed' | 'archived';
  audioStoragePath?: string;
}

export interface DBSession {
  token: string;
  userId: string;
  role: 'Manager' | 'Employee';
  companyId: string;
  employeeId?: string;
  createdAt: string;
  expiresAt: string;
}

export interface DatabaseSchema {
  companies: DBCompany[];
  managers: DBManager[];
  employees: DBEmployee[];
  tasks: DBTask[];
  meetings: DBMeeting[];
  transcripts: DBTranscript[];
  alerts: DBAlert[];
  sessions: DBSession[];
  employeeRequests: DBEmployeeRequest[];
  resetSessions: DBPasswordResetSession[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'meetflow-db.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initialData: DatabaseSchema = {
  companies: [],
  managers: [],
  employees: [],
  tasks: [],
  meetings: [],
  transcripts: [],
  alerts: [],
  sessions: [],
  employeeRequests: [],
  resetSessions: [],
};

// Password hashing utilities using Node.js crypto
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

// Secure OTP hashing utilities - cryptographically hashes OTPs, plaintext is NEVER stored
export function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp.trim()).digest('hex');
}

export function verifyOtpHash(enteredOtp: string, storedHash: string, salt: string): boolean {
  try {
    const computed = hashOtp(enteredOtp, salt);
    if (computed.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

function getSeedData(): DatabaseSchema {
  const compId = 'comp_seed_acme';
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const in3Days = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  const in5Days = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];

  return {
    companies: [
      {
        id: compId,
        name: 'Acme Technologies',
        email: 'admin@acme.com',
        createdAt: now,
      },
    ],
    managers: [
      {
        id: 'mgr_seed_1',
        managerId: 'MGR-001',
        managerName: 'Sarah Jenkins',
        companyId: compId,
        companyEmail: 'admin@acme.com',
        personalEmail: 'sarah.jenkins@gmail.com',
        passwordHash: hashPassword('password123'),
        role: 'Manager',
        createdAt: now,
      },
    ],
    employees: [
      {
        id: 'emp_seed_1',
        userId: 'EMP-101',
        employeeId: 'EMP-101',
        employeeName: 'Alex Rivera',
        employeePost: 'Senior Fullstack Engineer',
        companyId: compId,
        personalEmail: 'alex.rivera@gmail.com',
        companyEmail: 'admin@acme.com',
        passwordHash: hashPassword('password123'),
        role: 'Employee',
        status: 'ACTIVE',
        createdAt: now,
        lastLogin: now,
      },
      {
        id: 'emp_seed_2',
        userId: 'EMP-102',
        employeeId: 'EMP-102',
        employeeName: 'Priya Sharma',
        employeePost: 'Product Designer',
        companyId: compId,
        personalEmail: 'priya.sharma@gmail.com',
        companyEmail: 'admin@acme.com',
        passwordHash: hashPassword('password123'),
        role: 'Employee',
        status: 'ACTIVE',
        createdAt: now,
      },
      {
        id: 'emp_seed_3',
        userId: 'EMP-103',
        employeeId: 'EMP-103',
        employeeName: 'Marcus Chen',
        employeePost: 'QA & Release Lead',
        companyId: compId,
        personalEmail: 'marcus.chen@gmail.com',
        companyEmail: 'admin@acme.com',
        passwordHash: hashPassword('password123'),
        role: 'Employee',
        status: 'INACTIVE',
        createdAt: now,
      },
    ],
    tasks: [
      {
        id: 'task_seed_1',
        companyId: compId,
        employeeId: 'EMP-101',
        employeeName: 'Alex Rivera',
        employeePost: 'Senior Fullstack Engineer',
        subject: 'Implement real-time audio chunk processor',
        assignedDate: today,
        deadline: in3Days,
        status: 'In Progress',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task_seed_2',
        companyId: compId,
        employeeId: 'EMP-102',
        employeeName: 'Priya Sharma',
        employeePost: 'Product Designer',
        subject: 'Design responsive meeting transcripts review modal',
        assignedDate: today,
        deadline: tomorrow,
        status: 'Completed',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'task_seed_3',
        companyId: compId,
        employeeId: 'EMP-103',
        employeeName: 'Marcus Chen',
        employeePost: 'QA & Release Lead',
        subject: 'End-to-end testing of Gemini task extraction endpoint',
        assignedDate: today,
        deadline: in5Days,
        status: 'Pending',
        createdAt: now,
        updatedAt: now,
      },
    ],
    meetings: [
      {
        id: 'mtg_seed_1',
        companyId: compId,
        title: 'Q3 Product Roadmap & Sprint Kickoff',
        date: today,
        time: '10:00',
        durationMinutes: 45,
        createdAt: now,
      },
      {
        id: 'mtg_seed_2',
        companyId: compId,
        title: 'Architecture Review: Cloud Migration',
        date: tomorrow,
        time: '14:30',
        durationMinutes: 60,
        createdAt: now,
      },
    ],
    transcripts: [],
    alerts: [],
    sessions: [],
    employeeRequests: [],
    resetSessions: [],
  };
}

function loadDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.companies) && parsed.companies.length > 0) {
        parsed.companies = parsed.companies || [];
        parsed.managers = parsed.managers || [];
        parsed.employees = parsed.employees || [];
        parsed.tasks = parsed.tasks || [];
        parsed.meetings = parsed.meetings || [];
        parsed.alerts = parsed.alerts || [];
        parsed.transcripts = parsed.transcripts || [];
        parsed.sessions = parsed.sessions || [];
        parsed.employeeRequests = parsed.employeeRequests || [];
        parsed.resetSessions = parsed.resetSessions || [];

        // Migrate seed/existing managers to have personalEmail
        for (const m of parsed.managers) {
          if (!m.personalEmail) {
            m.personalEmail = m.companyEmail || 'manager@gmail.com';
          }
        }

        // Migrate seed/existing employees to have userId, personalEmail, companyEmail
        for (const e of parsed.employees) {
          if (!e.userId) {
            e.userId = e.employeeId;
          }
          if (!e.personalEmail) {
            const cleanName = (e.employeeName || 'employee').toLowerCase().replace(/[^a-z0-9]/g, '.');
            e.personalEmail = `${cleanName}@gmail.com`;
          }
          if (!e.companyEmail) {
            const comp = parsed.companies.find((c: any) => c.id === e.companyId);
            e.companyEmail = comp?.email || 'admin@acme.com';
          }
        }

        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read db file, initializing fresh:', err);
  }
  const seed = getSeedData();
  saveDB(seed);
  return seed;
}

function saveDB(data: DatabaseSchema): void {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save db file:', err);
  }
}


export class DataStore {
  private db: DatabaseSchema;

  constructor() {
    this.db = loadDB();
  }

  private persist(): void {
    saveDB(this.db);
  }

  // Companies
  getAllCompanies(): { id: string; name: string; email: string }[] {
    return this.db.companies.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
    }));
  }

  findCompanyByEmail(email: string): DBCompany | undefined {
    return this.db.companies.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
  }

  findCompanyById(id: string): DBCompany | undefined {
    return this.db.companies.find((c) => c.id === id);
  }

  createCompany(name: string, email: string): DBCompany {
    const company: DBCompany = {
      id: `comp_${crypto.randomBytes(8).toString('hex')}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };
    this.db.companies.push(company);
    this.persist();
    return company;
  }

  // Globally unique User ID verification
  isUserIdTaken(userId: string): boolean {
    if (!userId || typeof userId !== 'string') return false;
    const normalized = userId.trim().toLowerCase();
    if (!normalized) return false;

    const inManagers = this.db.managers.some(
      (m) => m.managerId.toLowerCase() === normalized
    );
    const inEmployees = this.db.employees.some(
      (e) => (e.userId && e.userId.toLowerCase() === normalized) || e.employeeId.toLowerCase() === normalized
    );
    const inRequests = (this.db.employeeRequests || []).some(
      (r) => r.status === 'pending' && (r.userId.toLowerCase() === normalized || r.employeeId.toLowerCase() === normalized)
    );

    return inManagers || inEmployees || inRequests;
  }

  // Find user by User ID across Managers and Employees
  findUserByUserId(userId: string): {
    role: 'Manager' | 'Employee';
    id: string;
    userId: string;
    name: string;
    companyId: string;
    personalEmail: string;
    companyEmail: string;
    authUserId?: string;
  } | null {
    if (!userId || typeof userId !== 'string') return null;
    const normalized = userId.trim().toLowerCase();

    const manager = this.db.managers.find(
      (m) =>
        m.managerId.toLowerCase() === normalized ||
        (m.companyEmail && m.companyEmail.toLowerCase() === normalized) ||
        (m.personalEmail && m.personalEmail.toLowerCase() === normalized)
    );
    if (manager) {
      return {
        role: 'Manager',
        id: manager.id,
        userId: manager.managerId,
        name: manager.managerName,
        companyId: manager.companyId,
        personalEmail: manager.personalEmail || manager.companyEmail,
        companyEmail: manager.companyEmail,
        authUserId: manager.authUserId,
      };
    }

    const employee = this.db.employees.find(
      (e) =>
        (e.userId && e.userId.toLowerCase() === normalized) ||
        e.employeeId.toLowerCase() === normalized ||
        (e.companyEmail && e.companyEmail.toLowerCase() === normalized) ||
        (e.personalEmail && e.personalEmail.toLowerCase() === normalized)
    );
    if (employee) {
      return {
        role: 'Employee',
        id: employee.id,
        userId: employee.userId || employee.employeeId,
        name: employee.employeeName,
        companyId: employee.companyId,
        personalEmail: employee.personalEmail || employee.companyEmail,
        companyEmail: employee.companyEmail,
        authUserId: employee.authUserId,
      };
    }

    return null;
  }

  isEmployeeAccountActive(employeeDbIdOrUserId: string): boolean {
    const normalized = employeeDbIdOrUserId.trim().toLowerCase();
    const employee = this.db.employees.find(
      (e) =>
        e.id === employeeDbIdOrUserId ||
        (e.userId && e.userId.toLowerCase() === normalized) ||
        e.employeeId.toLowerCase() === normalized
    );
    return employee ? employee.status === 'ACTIVE' : false;
  }

  // Managers
  findManagerByManagerId(companyId: string, managerId: string): DBManager | undefined {
    return this.db.managers.find(
      (m) => m.companyId === companyId && m.managerId.toLowerCase() === managerId.trim().toLowerCase()
    );
  }

  findManagerById(id: string): DBManager | undefined {
    return this.db.managers.find((m) => m.id === id);
  }

  createManager(params: {
    managerId: string;
    managerName: string;
    companyId: string;
    companyEmail: string;
    personalEmail: string;
    authUserId?: string;
    passwordHash: string;
  }): DBManager {
    if (this.isUserIdTaken(params.managerId)) {
      throw new Error('This User ID is already taken. Please choose another User ID.');
    }

    const manager: DBManager = {
      id: `mgr_${crypto.randomBytes(8).toString('hex')}`,
      managerId: params.managerId.trim(),
      managerName: params.managerName.trim(),
      companyId: params.companyId,
      companyEmail: params.companyEmail.trim().toLowerCase(),
      personalEmail: params.personalEmail.trim().toLowerCase(),
      authUserId: params.authUserId,
      passwordHash: params.passwordHash,
      role: 'Manager',
      createdAt: new Date().toISOString(),
    };
    this.db.managers.push(manager);
    this.persist();
    return manager;
  }

  // Employees
  getEmployees(companyId: string): DBEmployee[] {
    return this.db.employees.filter((e) => e.companyId === companyId);
  }

  findEmployeeById(companyId: string, employeeIdOrUserId: string): DBEmployee | undefined {
    const normalized = employeeIdOrUserId.trim().toLowerCase();
    return this.db.employees.find(
      (e) =>
        e.companyId === companyId &&
        (e.employeeId.toLowerCase() === normalized || (e.userId && e.userId.toLowerCase() === normalized))
    );
  }

  findEmployeeByDbId(id: string): DBEmployee | undefined {
    return this.db.employees.find((e) => e.id === id);
  }

  createEmployee(params: {
    userId?: string;
    employeeId: string;
    employeeName: string;
    employeePost: string;
    companyId: string;
    personalEmail?: string;
    companyEmail?: string;
    authUserId?: string;
    passwordHash: string;
  }): DBEmployee {
    const employee: DBEmployee = {
      id: `emp_${crypto.randomBytes(8).toString('hex')}`,
      userId: (params.userId || params.employeeId).trim(),
      employeeId: params.employeeId.trim(),
      employeeName: params.employeeName.trim(),
      employeePost: params.employeePost.trim() || 'Team Member',
      companyId: params.companyId,
      personalEmail: (params.personalEmail || '').trim().toLowerCase(),
      companyEmail: (params.companyEmail || '').trim().toLowerCase(),
      authUserId: params.authUserId,
      passwordHash: params.passwordHash,
      role: 'Employee',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    this.db.employees.push(employee);
    this.persist();
    return employee;
  }

  updateEmployeeStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): void {
    const emp = this.db.employees.find((e) => e.id === id);
    if (emp) {
      emp.status = status;
      if (status === 'ACTIVE') {
        emp.lastLogin = new Date().toISOString();
      }
      this.persist();
    }
  }

  deleteEmployee(companyId: string, employeeId: string): boolean {
    const idx = this.db.employees.findIndex(
      (e) =>
        e.companyId === companyId &&
        (e.employeeId.toLowerCase() === employeeId.toLowerCase() ||
          (e.userId && e.userId.toLowerCase() === employeeId.toLowerCase()))
    );
    if (idx !== -1) {
      this.db.employees.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // Employee Registration Requests
  getEmployeeRequests(companyId: string): DBEmployeeRequest[] {
    const requests = (this.db.employeeRequests || []).filter((r) => r.companyId === companyId);
    return requests.sort((a, b) => {
      // Pending requests come first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  findEmployeeRequestById(companyId: string, requestId: string): DBEmployeeRequest | undefined {
    return (this.db.employeeRequests || []).find(
      (r) => r.id === requestId && r.companyId === companyId
    );
  }

  findPendingOrDeniedRequestByUserId(companyId: string, userIdOrEmployeeId: string): DBEmployeeRequest | undefined {
    const normalized = userIdOrEmployeeId.trim().toLowerCase();
    return (this.db.employeeRequests || []).find(
      (r) =>
        r.companyId === companyId &&
        (r.userId.toLowerCase() === normalized || r.employeeId.toLowerCase() === normalized)
    );
  }

  createEmployeeRequest(params: {
    name: string;
    userId: string;
    personalEmail: string;
    companyEmail: string;
    employeeId: string;
    employeePost: string;
    companyId: string;
    companyName: string;
    passwordHash: string;
    authUserId?: string;
  }): DBEmployeeRequest {
    if (this.isUserIdTaken(params.userId)) {
      throw new Error('This User ID is already taken. Please choose another User ID.');
    }

    // Check if there is already a pending request with same userId or employeeId
    const existingPending = (this.db.employeeRequests || []).find(
      (r) =>
        r.companyId === params.companyId &&
        r.status === 'pending' &&
        (r.employeeId.toLowerCase() === params.employeeId.trim().toLowerCase() ||
          r.userId.toLowerCase() === params.userId.trim().toLowerCase())
    );
    if (existingPending) {
      throw new Error('A registration request with this User ID or Employee ID is already pending.');
    }

    const req: DBEmployeeRequest = {
      id: `req_${crypto.randomBytes(8).toString('hex')}`,
      name: params.name.trim(),
      userId: params.userId.trim(),
      personalEmail: params.personalEmail.trim().toLowerCase(),
      companyEmail: params.companyEmail.trim().toLowerCase(),
      employeeId: params.employeeId.trim(),
      employeePost: params.employeePost.trim() || 'Team Member',
      companyId: params.companyId,
      companyName: params.companyName.trim(),
      passwordHash: params.passwordHash,
      authUserId: params.authUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (!this.db.employeeRequests) {
      this.db.employeeRequests = [];
    }
    this.db.employeeRequests.unshift(req);
    this.persist();
    return req;
  }

  approveEmployeeRequest(
    companyId: string,
    requestId: string,
    reviewerName: string
  ): { request: DBEmployeeRequest; employee: DBEmployee } {
    const req = this.findEmployeeRequestById(companyId, requestId);
    if (!req) {
      throw new Error('Employee registration request not found.');
    }

    // Idempotency: if already approved, return existing employee record
    if (req.status === 'approved') {
      const existingEmp = this.db.employees.find(
        (e) =>
          e.companyId === companyId &&
          (e.employeeId.toLowerCase() === req.employeeId.toLowerCase() ||
            e.userId.toLowerCase() === req.userId.toLowerCase())
      );
      if (existingEmp) {
        return { request: req, employee: existingEmp };
      }
    }

    req.status = 'approved';
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewerName;

    // Check if employee already exists in directory
    let employee = this.db.employees.find(
      (e) =>
        e.companyId === companyId &&
        (e.employeeId.toLowerCase() === req.employeeId.toLowerCase() ||
          e.userId.toLowerCase() === req.userId.toLowerCase())
    );

    if (employee) {
      employee.status = 'ACTIVE';
      employee.employeeName = req.name;
      employee.employeePost = req.employeePost;
      employee.personalEmail = req.personalEmail;
      employee.companyEmail = req.companyEmail;
      if (req.authUserId) employee.authUserId = req.authUserId;
    } else {
      employee = {
        id: `emp_${crypto.randomBytes(8).toString('hex')}`,
        userId: req.userId,
        employeeId: req.employeeId,
        employeeName: req.name,
        employeePost: req.employeePost,
        companyId: req.companyId,
        personalEmail: req.personalEmail,
        companyEmail: req.companyEmail,
        authUserId: req.authUserId,
        passwordHash: req.passwordHash,
        role: 'Employee',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      this.db.employees.push(employee);
    }

    this.persist();
    return { request: req, employee };
  }

  denyEmployeeRequest(
    companyId: string,
    requestId: string,
    reviewerName: string
  ): DBEmployeeRequest {
    const req = this.findEmployeeRequestById(companyId, requestId);
    if (!req) {
      throw new Error('Employee registration request not found.');
    }

    req.status = 'denied';
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewerName;
    this.persist();
    return req;
  }

  // Password Recovery Sessions
  canRequestNewOtp(userId: string): { allowed: boolean; waitSeconds?: number } {
    if (!this.db.resetSessions) return { allowed: true };
    const existing = this.db.resetSessions.find(
      (s) => s.userId.toLowerCase() === userId.toLowerCase() && !s.usedAt
    );
    if (!existing || !existing.lastRequestedAt) return { allowed: true };

    const elapsedMs = Date.now() - existing.lastRequestedAt;
    const cooldownMs = 60 * 1000; // 60 seconds cooldown
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return { allowed: false, waitSeconds };
    }
    return { allowed: true };
  }

  createResetSession(params: {
    userId: string;
    userRole: 'Manager' | 'Employee';
    targetId: string;
    personalEmail: string;
    salt: string;
    otpHash: string; // ONLY HASH - Plaintext is never stored
  }): DBPasswordResetSession {
    const [localPart, domain] = params.personalEmail.split('@');
    const maskedLocal =
      localPart.length > 2
        ? `${localPart[0]}***${localPart[localPart.length - 1]}`
        : `${localPart[0] || '*'}***`;
    const maskedEmail = `${maskedLocal}@${domain || 'gmail.com'}`;

    // 10 minutes OTP expiration
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const session: DBPasswordResetSession = {
      id: `reset_${crypto.randomBytes(16).toString('hex')}`,
      userId: params.userId,
      userRole: params.userRole,
      targetId: params.targetId,
      personalEmail: params.personalEmail,
      maskedEmail,
      salt: params.salt,
      otpHash: params.otpHash,
      otpExpiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date().toISOString(),
      lastRequestedAt: Date.now(),
    };

    if (!this.db.resetSessions) {
      this.db.resetSessions = [];
    }

    // Invalidate any previous reset session for this user to ensure single-use
    this.db.resetSessions = this.db.resetSessions.filter(
      (s) => s.userId.toLowerCase() !== params.userId.toLowerCase()
    );
    this.db.resetSessions.push(session);
    this.persist();
    return session;
  }

  getResetSession(id: string): DBPasswordResetSession | undefined {
    if (!this.db.resetSessions) return undefined;
    return this.db.resetSessions.find((s) => s.id === id);
  }

  verifyResetOtp(sessionId: string, enteredOtp: string): { success: boolean; error?: string; resetToken?: string } {
    const session = this.getResetSession(sessionId);
    if (!session) {
      return { success: false, error: 'Password reset session not found or expired. Please request a new OTP.' };
    }

    // Ensure session has not already been used (single use)
    if (session.usedAt || session.verified) {
      return { success: false, error: 'This verification code has already been used. Please request a new OTP.' };
    }

    // Rate limiting / attempt limit: maximum 5 attempts per session
    if (session.attempts >= 5) {
      session.usedAt = new Date().toISOString();
      session.verified = false;
      this.persist();
      return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    // Check expiration (10 minutes)
    if (new Date(session.otpExpiresAt).getTime() < Date.now()) {
      session.usedAt = new Date().toISOString();
      this.persist();
      return { success: false, error: 'This OTP has expired. Please request a new one.' };
    }

    session.attempts += 1;

    // Cryptographically verify OTP hash - constant-time comparison
    const isValid = enteredOtp ? verifyOtpHash(enteredOtp.trim(), session.otpHash, session.salt) : false;

    if (!isValid) {
      if (session.attempts >= 5) {
        session.usedAt = new Date().toISOString();
        session.verified = false;
        this.persist();
        return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
      }
      this.persist();
      return { success: false, error: 'Incorrect OTP. Please try again.' };
    }

    // Successfully verified - generate cryptographically secure reset token
    session.verified = true;
    session.resetToken = `rst_${crypto.randomBytes(32).toString('hex')}`;
    session.resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    this.persist();

    return { success: true, resetToken: session.resetToken };
  }

  getVerifiedResetSessionByToken(resetToken: string): DBPasswordResetSession | undefined {
    if (!this.db.resetSessions || !resetToken) return undefined;
    const session = this.db.resetSessions.find(
      (s) => s.verified && s.resetToken === resetToken && !s.usedAt
    );
    if (!session) return undefined;
    if (session.resetTokenExpiresAt && new Date(session.resetTokenExpiresAt).getTime() < Date.now()) {
      return undefined;
    }
    return session;
  }

  completePasswordReset(resetToken: string, newPasswordHash: string): boolean {
    const session = this.getVerifiedResetSessionByToken(resetToken);
    if (!session) return false;

    if (session.userRole === 'Manager') {
      const manager = this.db.managers.find((m) => m.id === session.targetId);
      if (manager) {
        manager.passwordHash = newPasswordHash;
      }
    } else {
      const employee = this.db.employees.find((e) => e.id === session.targetId);
      if (employee) {
        employee.passwordHash = newPasswordHash;
      }
    }

    // Invalidate session immediately - prevent replay
    session.usedAt = new Date().toISOString();
    session.verified = false;
    this.db.resetSessions = this.db.resetSessions.filter((s) => s.id !== session.id);
    this.persist();
    return true;
  }

  // Tasks
  getTasks(companyId: string, employeeId?: string): DBTask[] {
    const today = new Date().toISOString().split('T')[0];
    let tasks = this.db.tasks.filter((t) => t.companyId === companyId);
    if (employeeId) {
      tasks = tasks.filter((t) => t.employeeId.toLowerCase() === employeeId.toLowerCase());
    }

    // Dynamic overdue check
    tasks = tasks.map((t) => {
      if (t.status !== 'Completed' && t.deadline < today) {
        return { ...t, status: 'Overdue' };
      }
      return t;
    });

    return tasks;
  }

  findTaskById(taskId: string): DBTask | undefined {
    return this.db.tasks.find((t) => t.id === taskId);
  }

  createTask(params: {
    companyId: string;
    employeeId: string;
    employeeName: string;
    employeePost: string;
    subject: string;
    description?: string;
    assignedDate: string;
    deadline: string;
    status?: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  }): DBTask {
    const now = new Date().toISOString();
    const task: DBTask = {
      id: `task_${crypto.randomBytes(8).toString('hex')}`,
      companyId: params.companyId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      employeePost: params.employeePost,
      subject: params.subject.trim(),
      description: params.description ? params.description.trim() : undefined,
      assignedDate: params.assignedDate,
      deadline: params.deadline,
      status: params.status || 'Pending',
      createdAt: now,
      updatedAt: now,
    };
    this.db.tasks.unshift(task);
    this.persist();
    return task;
  }

  updateTask(
    taskId: string,
    companyId: string,
    updates: Partial<Pick<DBTask, 'employeeId' | 'employeeName' | 'employeePost' | 'subject' | 'description' | 'assignedDate' | 'deadline' | 'status'>>
  ): DBTask | null {
    const task = this.db.tasks.find((t) => t.id === taskId && t.companyId === companyId);
    if (!task) return null;

    if (updates.employeeId !== undefined) {
      task.employeeId = updates.employeeId;
    }
    if (updates.employeeName !== undefined) {
      task.employeeName = updates.employeeName;
    }
    if (updates.employeePost !== undefined) {
      task.employeePost = updates.employeePost;
    }
    if (updates.subject !== undefined) {
      task.subject = updates.subject.trim();
    }
    if (updates.description !== undefined) {
      task.description = updates.description.trim();
    }
    if (updates.assignedDate !== undefined) {
      task.assignedDate = updates.assignedDate;
    }
    if (updates.deadline !== undefined) {
      task.deadline = updates.deadline;
    }
    if (updates.status !== undefined) {
      task.status = updates.status;
    }
    task.updatedAt = new Date().toISOString();
    this.persist();
    return task;
  }

  deleteTask(taskId: string, companyId: string): boolean {
    const idx = this.db.tasks.findIndex((t) => t.id === taskId && t.companyId === companyId);
    if (idx !== -1) {
      this.db.tasks.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // Meetings
  getMeetings(companyId: string): DBMeeting[] {
    return this.db.meetings.filter((m) => m.companyId === companyId);
  }

  createMeeting(params: {
    companyId: string;
    title: string;
    date: string;
    time: string;
    durationMinutes: number;
  }): DBMeeting {
    const meeting: DBMeeting = {
      id: `mtg_${crypto.randomBytes(8).toString('hex')}`,
      companyId: params.companyId,
      title: params.title.trim(),
      date: params.date,
      time: params.time,
      durationMinutes: Number(params.durationMinutes) || 30,
      createdAt: new Date().toISOString(),
    };
    this.db.meetings.unshift(meeting);
    this.persist();
    return meeting;
  }

  deleteMeeting(meetingId: string, companyId: string): boolean {
    const idx = this.db.meetings.findIndex((m) => m.id === meetingId && m.companyId === companyId);
    if (idx !== -1) {
      this.db.meetings.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // Transcripts
  getTranscripts(companyId: string): DBTranscript[] {
    return (this.db.transcripts || [])
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  getTranscriptById(id: string): DBTranscript | undefined {
    return (this.db.transcripts || []).find((t) => t.id === id);
  }

  createTranscript(params: Omit<DBTranscript, 'id'> & { id?: string }): DBTranscript {
    const transcript: DBTranscript = {
      id: params.id || `tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      companyId: params.companyId,
      meetingId: params.meetingId,
      meetingTitle: params.meetingTitle,
      transcriptText: params.transcriptText,
      durationSeconds: params.durationSeconds || 0,
      recordedAt: params.recordedAt || new Date().toISOString(),
      expiresAt: params.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      summary: params.summary,
      keyPoints: params.keyPoints || [],
      speakers: params.speakers || [],
      actionItems: params.actionItems || [],
      status: params.status || 'pending_review',
      audioStoragePath: params.audioStoragePath,
    };
    if (!this.db.transcripts) this.db.transcripts = [];
    this.db.transcripts.unshift(transcript);
    this.persist();
    return transcript;
  }

  updateTranscript(id: string, updates: Partial<DBTranscript>): DBTranscript | undefined {
    if (!this.db.transcripts) this.db.transcripts = [];
    const t = this.db.transcripts.find((item) => item.id === id);
    if (!t) return undefined;
    Object.assign(t, updates);
    this.persist();
    return t;
  }

  deleteTranscript(id: string): boolean {
    if (!this.db.transcripts) return false;
    const idx = this.db.transcripts.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.db.transcripts.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // Dynamic Alerts Computation
  computeAlerts(companyId: string, role: 'Manager' | 'Employee', employeeId?: string): DBAlert[] {
    const alerts: DBAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = this.getTasks(companyId, role === 'Employee' ? employeeId : undefined);
    const meetings = this.getMeetings(companyId);

    // 1. Task deadline and overdue alerts
    for (const t of tasks) {
      const deadlineDate = new Date(t.deadline + 'T00:00:00');
      const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (t.status !== 'Completed') {
        if (diffDays < 0) {
          // Overdue
          alerts.push({
            id: `alert_overdue_${t.id}`,
            companyId,
            recipientRole: role,
            recipientId: role === 'Employee' ? t.employeeId : undefined,
            type: 'task_overdue',
            title: role === 'Manager' ? `${t.employeeName}'s task is overdue` : 'Your task is overdue',
            description: `Task "${t.subject}" passed deadline on ${t.deadline}.`,
            severity: 'urgent',
            createdAt: t.updatedAt || t.createdAt,
            read: this.isAlertRead(`alert_overdue_${t.id}`),
            relatedTaskId: t.id,
          });
        } else if (diffDays <= 2) {
          // Approaching deadline (tomorrow or 2 days)
          const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : 'in 2 days';
          alerts.push({
            id: `alert_deadline_${t.id}_${diffDays}`,
            companyId,
            recipientRole: role,
            recipientId: role === 'Employee' ? t.employeeId : undefined,
            type: 'task_deadline',
            title: role === 'Manager' ? `Task deadline approaching: ${t.employeeName}` : 'Task deadline approaching',
            description: `Task "${t.subject}" is due ${daysText} (${t.deadline}).`,
            severity: diffDays <= 1 ? 'warning' : 'info',
            createdAt: t.updatedAt || t.createdAt,
            read: this.isAlertRead(`alert_deadline_${t.id}_${diffDays}`),
            relatedTaskId: t.id,
          });
        }
      }
    }

    // 2. Meeting alerts (for Manager or company-wide)
    if (role === 'Manager') {
      for (const m of meetings) {
        const meetingDate = new Date(m.date + 'T00:00:00');
        const diffDays = Math.ceil((meetingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 2) {
          const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : 'in 2 days';
          alerts.push({
            id: `alert_mtg_${m.id}_${diffDays}`,
            companyId,
            recipientRole: 'Manager',
            type: 'meeting',
            title: `Upcoming meeting: ${m.title}`,
            description: `Meeting is scheduled ${daysText} at ${m.time} (${m.durationMinutes} mins).`,
            severity: 'info',
            createdAt: m.createdAt,
            read: this.isAlertRead(`alert_mtg_${m.id}_${diffDays}`),
            relatedMeetingId: m.id,
          });
        }
      }
    }

    return alerts;
  }

  private isAlertRead(alertId: string): boolean {
    const match = this.db.alerts.find((a) => a.id === alertId);
    return match ? match.read : false;
  }

  markAlertRead(alertId: string): void {
    const match = this.db.alerts.find((a) => a.id === alertId);
    if (match) {
      match.read = true;
    } else {
      this.db.alerts.push({
        id: alertId,
        companyId: '',
        recipientRole: 'Manager',
        type: 'task_deadline',
        title: '',
        description: '',
        severity: 'info',
        createdAt: new Date().toISOString(),
        read: true,
      });
    }
    this.persist();
  }

  // Sessions
  createSession(token: string, userId: string, role: 'Manager' | 'Employee', companyId: string, employeeId?: string): DBSession {
    // 7-day session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const session: DBSession = {
      token,
      userId,
      role,
      companyId,
      employeeId,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    this.db.sessions.push(session);
    this.persist();
    return session;
  }

  getSession(token: string): DBSession | undefined {
    const session = this.db.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  deleteSession(token: string): void {
    const idx = this.db.sessions.findIndex((s) => s.token === token);
    if (idx !== -1) {
      this.db.sessions.splice(idx, 1);
      this.persist();
    }
  }
}

export const store = new DataStore();
