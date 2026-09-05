import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  store,
  hashPassword,
  verifyPassword,
  hashOtp,
  verifyOtpHash,
  DBSession,
  DBTask,
} from './server/db';
import {
  getSupabaseServerClient,
  createSupabaseAuthAccount,
  generateSupabaseRecoveryToken,
  updateSupabaseUserPassword,
  updateSupabaseAuthPasswordByEmail,
  saveOtpRecordToSupabase,
  updateOtpAttemptsInSupabase,
  markOtpVerifiedInSupabase,
  markOtpUsedInSupabase,
} from './server/supabase';
import { sendPasswordResetOtpEmail } from './server/resend';

const app = express();
const PORT = 3000;

// Configure body parser limit for audio base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialization of Gemini client (server-side only)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Helper to authenticate request
interface AuthenticatedRequest extends Request {
  session?: DBSession;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing token' });
    return;
  }
  const token = authHeader.substring(7).trim();
  const session = store.getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
    return;
  }
  req.session = session;
  next();
}

function managerOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.session || req.session.role !== 'Manager') {
    res.status(403).json({ error: 'Forbidden: manager access required' });
    return;
  }
  next();
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Companies listing for employee registration
app.get('/api/companies', (req, res) => {
  try {
    const companies = store.getAllCompanies();
    res.json({ companies });
  } catch (err) {
    console.error('Failed to get companies:', err);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

// Check User ID Availability (Globally Unique)
app.get('/api/auth/check-user-id', (req, res) => {
  try {
    const userId = (req.query.userId as string) || '';
    if (!userId.trim()) {
      res.status(400).json({ available: false, message: 'User ID cannot be empty.' });
      return;
    }

    if (userId.trim().length < 3) {
      res.status(400).json({ available: false, message: 'User ID must be at least 3 characters.' });
      return;
    }

    const taken = store.isUserIdTaken(userId);
    if (taken) {
      res.json({
        available: false,
        message: 'This User ID is already taken. Please choose another User ID.',
      });
    } else {
      res.json({
        available: true,
        message: 'User ID is available.',
      });
    }
  } catch (err) {
    console.error('Check user id error:', err);
    res.status(500).json({ available: false, message: 'Could not verify User ID at this moment.' });
  }
});

// Manager Registration
app.post('/api/auth/register-manager', async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      personalEmail,
      managerName,
      managerId,
      password,
      confirmPassword,
    } = req.body;

    if (
      !companyName ||
      !companyEmail ||
      !personalEmail ||
      !managerName ||
      !managerId ||
      !password ||
      !confirmPassword
    ) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      res.status(400).json({ error: 'Invalid company email address format.' });
      return;
    }

    if (!emailRegex.test(personalEmail)) {
      res.status(400).json({ error: 'Invalid personal Gmail address format.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    // Check if User ID is already taken anywhere in the database
    if (store.isUserIdTaken(managerId)) {
      res.status(400).json({
        error: 'This User ID is already taken. Please choose another User ID.',
      });
      return;
    }

    // Check or create company
    let company = store.findCompanyByEmail(companyEmail);
    if (!company) {
      company = store.createCompany(companyName, companyEmail);
    }

    // Hash password securely - NEVER store plaintext password
    const passwordHash = hashPassword(password);

    // Create Supabase Auth user account securely
    let authUserId: string | undefined;
    try {
      const authResult = await createSupabaseAuthAccount({
        email: personalEmail,
        password,
        metadata: {
          user_id: managerId.trim(),
          name: managerName.trim(),
          role: 'Manager',
          company_id: company.id,
          company_name: company.name,
          personal_email: personalEmail.trim().toLowerCase(),
          company_email: companyEmail.trim().toLowerCase(),
        },
      });
      if (authResult?.id) {
        authUserId = authResult.id;
      }
    } catch (authErr) {
      console.warn('Supabase Auth provisioning notice:', authErr);
    }

    // Create manager profile in database
    store.createManager({
      managerId,
      managerName,
      companyId: company.id,
      companyEmail: company.email,
      personalEmail: personalEmail.trim().toLowerCase(),
      authUserId,
      passwordHash,
    });

    res.status(201).json({
      success: true,
      message: 'Manager account created successfully. You can now log in.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    const msg =
      err?.message && err.message.includes('already taken')
        ? 'This User ID is already taken. Please choose another User ID.'
        : 'Something went wrong. Please try again.';
    res.status(400).json({ error: msg });
  }
});

// Employee Registration (Submit Request)
app.post('/api/auth/register-employee', async (req, res) => {
  try {
    const {
      name,
      userId,
      password,
      confirmPassword,
      personalEmail,
      companyEmail,
      employeeId,
      employeePost,
      companyId,
    } = req.body;

    if (
      !name ||
      !userId ||
      !password ||
      !confirmPassword ||
      !personalEmail ||
      !companyEmail ||
      !employeeId ||
      !companyId
    ) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      res.status(400).json({ error: 'Invalid company email address format.' });
      return;
    }

    if (!emailRegex.test(personalEmail)) {
      res.status(400).json({ error: 'Invalid personal Gmail address format.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    // Enforce globally unique User ID
    if (store.isUserIdTaken(userId)) {
      res.status(400).json({
        error: 'This User ID is already taken. Please choose another User ID.',
      });
      return;
    }

    // Find company to join
    const company = store.findCompanyById(companyId) || store.findCompanyByEmail(companyEmail);
    if (!company) {
      res.status(400).json({ error: 'Selected company was not found. Please select an existing company.' });
      return;
    }

    // Securely hash password for activation - NEVER store plaintext password
    const passwordHash = hashPassword(password);

    // Create Employee Request
    const request = store.createEmployeeRequest({
      name,
      userId,
      personalEmail,
      companyEmail,
      employeeId,
      employeePost: employeePost || 'Team Member',
      companyId: company.id,
      companyName: company.name,
      passwordHash,
    });

    res.status(201).json({
      success: true,
      requestId: request.id,
      message:
        'Registration request submitted successfully. Your request is pending manager approval.',
    });
  } catch (err: any) {
    console.error('Employee registration error:', err);
    const msg =
      err?.message && err.message.includes('already taken')
        ? 'This User ID is already taken. Please choose another User ID.'
        : err?.message || 'Failed to submit registration request. Please try again.';
    res.status(400).json({ error: msg });
  }
});

// Login (Manager or Employee)
app.post('/api/auth/login', (req, res) => {
  try {
    const { companyEmail, userType, userId, password } = req.body;

    if (!companyEmail || !userType || !userId || !password) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }

    const company = store.findCompanyByEmail(companyEmail);
    if (!company) {
      res.status(401).json({ error: 'User not found or incorrect credentials.' });
      return;
    }

    if (userType === 'Manager') {
      const manager = store.findManagerByManagerId(company.id, userId);
      if (!manager) {
        res.status(401).json({ error: 'User not found or incorrect credentials.' });
        return;
      }

      const isValid = verifyPassword(password, manager.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'User not found or incorrect credentials.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      store.createSession(token, manager.id, 'Manager', company.id);

      res.json({
        token,
        user: {
          id: manager.id,
          role: 'Manager',
          name: manager.managerName,
          userId: manager.managerId,
          companyId: company.id,
          companyName: company.name,
          companyEmail: company.email,
          personalEmail: manager.personalEmail,
        },
      });
      return;
    } else if (userType === 'Employee') {
      // 1. Check if an approved/active employee exists
      const employee = store.findEmployeeById(company.id, userId);
      if (employee) {
        const isValid = verifyPassword(password, employee.passwordHash);
        if (!isValid) {
          res.status(401).json({ error: 'User not found or incorrect credentials.' });
          return;
        }

        // Mark status as ACTIVE on login
        store.updateEmployeeStatus(employee.id, 'ACTIVE');

        const token = crypto.randomBytes(32).toString('hex');
        store.createSession(token, employee.id, 'Employee', company.id, employee.employeeId);

        res.json({
          token,
          user: {
            id: employee.id,
            role: 'Employee',
            name: employee.employeeName,
            userId: employee.userId || employee.employeeId,
            post: employee.employeePost,
            companyId: company.id,
            companyName: company.name,
            companyEmail: company.email,
            personalEmail: employee.personalEmail,
            status: 'ACTIVE',
          },
        });
        return;
      }

      // 2. Not in active directory - check if this user has a pending or denied registration request!
      const request = store.findPendingOrDeniedRequestByUserId(company.id, userId);
      if (request) {
        if (request.status === 'pending') {
          res.status(403).json({
            error: 'Your employee registration is still waiting for manager approval.',
            status: 'pending',
          });
          return;
        } else if (request.status === 'denied') {
          res.status(403).json({
            error: 'Your employee registration request was denied.',
            status: 'denied',
          });
          return;
        }
      }

      res.status(401).json({ error: 'User not found or incorrect credentials.' });
      return;
    } else {
      res.status(400).json({ error: 'Invalid user type selected.' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// -------------------------------------------------------------
// Forgot Password Flow
// -------------------------------------------------------------

// Check whether user ID is in the database or not
app.all('/api/auth/check-user-exists', (req: Request, res: Response) => {
  try {
    const userId = (req.body?.userId || req.query?.userId || '') as string;
    if (!userId || !userId.trim()) {
      res.status(400).json({ exists: false, error: 'Please enter your User ID.' });
      return;
    }

    const trimmedUserId = userId.trim();
    const userRecord = store.findUserByUserId(trimmedUserId);

    if (!userRecord) {
      res.status(404).json({ exists: false, error: 'User not found' });
      return;
    }

    res.json({
      exists: true,
      role: userRecord.role,
      userId: userRecord.userId,
    });
  } catch (err) {
    console.error('Check user exists error:', err);
    res.status(500).json({ exists: false, error: 'Failed to verify user.' });
  }
});

// Step 1: Initiate password reset with User ID
app.post('/api/auth/forgot-password/initiate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Please enter your User ID.' });
      return;
    }

    const trimmedUserId = userId.trim();
    const userRecord = store.findUserByUserId(trimmedUserId);

    if (!userRecord) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!userRecord.personalEmail) {
      res.status(400).json({ error: 'No recovery email registered for this account.' });
      return;
    }

    const isEmployeeActive =
      userRecord.role === 'Employee'
        ? store.isEmployeeAccountActive(trimmedUserId)
        : true;

    if (!isEmployeeActive) {
      res.status(403).json({ error: 'Your employee account is pending approval or inactive.' });
      return;
    }

    // Server-side rate limiting: 60-second cooldown between OTP requests for this account
    const cooldownCheck = store.canRequestNewOtp(userRecord.userId);
    if (!cooldownCheck.allowed) {
      res.status(429).json({
        error: `Please wait ${cooldownCheck.waitSeconds || 60} seconds before requesting another verification code.`,
      });
      return;
    }

    // Generate cryptographically secure random 6-digit numerical OTP (Requirement 4)
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Create secure cryptographic salt & hash for OTP (Requirement 7: Never store plaintext in database)
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = hashOtp(otp, salt);

    // Send plaintext OTP strictly via Resend email to registered personal email (Requirement 1, 6, 17)
    const emailResult = await sendPasswordResetOtpEmail(userRecord.personalEmail, otp);
    if (!emailResult.success) {
      res.status(500).json({
        error:
          emailResult.error ||
          "We couldn't send the verification email right now. Please try again.",
      });
      return;
    }

    // Save hashed record in Supabase table (Requirement 7 & 18)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    saveOtpRecordToSupabase({
      id: crypto.randomUUID(),
      userId: userRecord.userId,
      otpHash,
      expiresAt: otpExpiresAt,
    }).catch(() => {});

    // Save session in server store with OTP hash ONLY (Plaintext is NEVER stored)
    const session = store.createResetSession({
      userId: userRecord.userId,
      userRole: userRecord.role,
      targetId: userRecord.id,
      personalEmail: userRecord.personalEmail,
      salt,
      otpHash,
    });

    // Requirement 5: Actual OTP must NEVER be sent to frontend or displayed
    res.json({
      success: true,
      sessionId: session.id,
      maskedEmail: session.maskedEmail,
      message: `Enter the 6-digit OTP sent to your registered email (${session.maskedEmail}).`,
    });
  } catch (err) {
    console.error('Forgot password initiate error:', err);
    res.status(500).json({
      error: "We couldn't send the verification email right now. Please try again.",
    });
  }
});

// Step 2: Verify OTP
app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is missing. Please start password recovery again.' });
      return;
    }
    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      res.status(400).json({ error: 'Please enter the 6-digit OTP.' });
      return;
    }

    // Handle enumeration protection dummy session
    if (sessionId.startsWith('rst_anon_')) {
      res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
      return;
    }

    const session = store.getResetSession(sessionId);
    if (!session) {
      res.status(400).json({
        error: 'Password reset session not found or expired. Please request a new OTP.',
      });
      return;
    }

    const result = store.verifyResetOtp(sessionId, otp.trim());

    if (!result.success) {
      // Sync attempt count to Supabase table
      updateOtpAttemptsInSupabase(session.id, session.attempts, session.attempts >= 5).catch(() => {});
      res.status(400).json({ error: result.error || 'Incorrect OTP. Please try again.' });
      return;
    }

    // Mark verified in Supabase table
    markOtpVerifiedInSupabase(session.id).catch(() => {});

    res.json({
      success: true,
      resetToken: result.resetToken,
      message: 'OTP verified successfully.',
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
});

// Step 2b: Resend OTP
app.post('/api/auth/forgot-password/resend-otp', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session expired or not found. Please start over.' });
      return;
    }

    // Dummy session handling
    if (sessionId.startsWith('rst_anon_')) {
      res.json({
        success: true,
        sessionId,
        maskedEmail: 'your registered personal email',
        message:
          'If the account is eligible for recovery, a new verification code will be sent to the registered email.',
      });
      return;
    }

    const session = store.getResetSession(sessionId);
    if (!session) {
      res.status(400).json({ error: 'Session expired or not found. Please request a new OTP.' });
      return;
    }

    // Server-side 60-second rate limiting cooldown
    const cooldownCheck = store.canRequestNewOtp(session.userId);
    if (!cooldownCheck.allowed) {
      res.status(429).json({
        error: `Please wait ${cooldownCheck.waitSeconds || 60} seconds before requesting another verification code.`,
      });
      return;
    }

    // Invalidate previous OTP and generate fresh 6-digit numerical OTP
    const newOtp = crypto.randomInt(100000, 1000000).toString();
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newOtpHash = hashOtp(newOtp, newSalt);

    // Send plaintext OTP strictly via Resend email
    const emailResult = await sendPasswordResetOtpEmail(session.personalEmail, newOtp);
    if (!emailResult.success) {
      res.status(500).json({
        error:
          emailResult.error ||
          "We couldn't send the verification email right now. Please try again.",
      });
      return;
    }

    // Save in Supabase table
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    saveOtpRecordToSupabase({
      id: crypto.randomUUID(),
      userId: session.userId,
      otpHash: newOtpHash,
      expiresAt: otpExpiresAt,
    }).catch(() => {});

    // Refresh reset session with new hash in store
    const refreshed = store.createResetSession({
      userId: session.userId,
      userRole: session.userRole,
      targetId: session.targetId,
      personalEmail: session.personalEmail,
      salt: newSalt,
      otpHash: newOtpHash,
    });

    // Requirement 5: Never return OTP to frontend
    res.json({
      success: true,
      sessionId: refreshed.id,
      maskedEmail: refreshed.maskedEmail,
      message: `Enter the 6-digit OTP sent to your registered email (${refreshed.maskedEmail}).`,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({
      error: "We couldn't send the verification email right now. Please try again.",
    });
  }
});

// Step 3: Set New Password
app.post('/api/auth/forgot-password/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || typeof resetToken !== 'string') {
      res.status(400).json({ error: 'Invalid or expired session. Please start over.' });
      return;
    }

    if (!newPassword || !confirmPassword) {
      res.status(400).json({ error: 'Please enter and confirm your new password.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (newPassword.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    const session = store.getVerifiedResetSessionByToken(resetToken);
    if (!session) {
      res.status(400).json({
        error: 'This password reset session is invalid or has expired. Please request a new OTP.',
      });
      return;
    }

    // Hash the new password securely
    const newPasswordHash = hashPassword(newPassword);

    // Update in Supabase Auth's secure authentication system (Requirement 14)
    try {
      await updateSupabaseAuthPasswordByEmail(session.personalEmail, newPassword, {
        userId: session.userId,
        role: session.userRole,
      });
    } catch (authErr) {
      console.warn('Supabase Auth update password notice:', authErr);
    }

    // Mark used in Supabase OTP table
    markOtpUsedInSupabase(session.id).catch(() => {});

    // Update password hash in local store and invalidate reset session immediately (single use)
    const updated = store.completePasswordReset(resetToken, newPasswordHash);
    if (!updated) {
      res.status(400).json({ error: 'Failed to reset password. Please start over.' });
      return;
    }

    res.json({
      success: true,
      message: 'Your password has been changed successfully.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to update password. Please try again.' });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    if (session.role === 'Employee') {
      store.updateEmployeeStatus(session.userId, 'INACTIVE');
    }
    store.deleteSession(session.token);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to process logout.' });
  }
});

// Current User profile verification
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const session = req.session!;
  const company = store.findCompanyById(session.companyId);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  if (session.role === 'Manager') {
    const manager = store.findManagerById(session.userId);
    if (!manager) {
      res.status(404).json({ error: 'Manager record not found' });
      return;
    }
    res.json({
      user: {
        id: manager.id,
        role: 'Manager',
        name: manager.managerName,
        userId: manager.managerId,
        companyId: company.id,
        companyName: company.name,
        companyEmail: company.email,
      },
    });
  } else {
    const employee = store.findEmployeeByDbId(session.userId);
    if (!employee) {
      res.status(404).json({ error: 'Employee record not found' });
      return;
    }
    res.json({
      user: {
        id: employee.id,
        role: 'Employee',
        name: employee.employeeName,
        userId: employee.employeeId,
        post: employee.employeePost,
        companyId: company.id,
        companyName: company.name,
        companyEmail: company.email,
        status: employee.status,
      },
    });
  }
});

// -------------------------------------------------------------
// Employees Management (Manager Only)
// -------------------------------------------------------------

app.get('/api/employees', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.session!.companyId;
  const employees = store.getEmployees(companyId);
  const tasks = store.getTasks(companyId);

  // Return employees with assigned task count, omitting passwordHash
  const safeEmployees = employees.map((emp) => {
    const empTasks = tasks.filter((t) => t.employeeId.toLowerCase() === emp.employeeId.toLowerCase());
    return {
      id: emp.id,
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      employeePost: emp.employeePost,
      companyId: emp.companyId,
      role: emp.role,
      status: emp.status,
      createdAt: emp.createdAt,
      lastLogin: emp.lastLogin,
      assignedTasksCount: empTasks.length,
    };
  });

  res.json({ employees: safeEmployees });
});

app.post('/api/employees', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const { employeeName, employeeId, employeePost, password } = req.body;

    if (!employeeName || !employeeId || !password) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }

    const existing = store.findEmployeeById(companyId, employeeId);
    if (existing) {
      res.status(400).json({ error: 'This employee ID is already registered in your company.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const newEmp = store.createEmployee({
      employeeId,
      employeeName,
      employeePost: employeePost || 'Team Member',
      companyId,
      passwordHash,
    });

    res.status(201).json({
      employee: {
        id: newEmp.id,
        employeeId: newEmp.employeeId,
        employeeName: newEmp.employeeName,
        employeePost: newEmp.employeePost,
        companyId: newEmp.companyId,
        role: newEmp.role,
        status: newEmp.status,
        createdAt: newEmp.createdAt,
        assignedTasksCount: 0,
      },
    });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

app.delete('/api/employees/:employeeId', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.session!.companyId;
  const { employeeId } = req.params;
  const success = store.deleteEmployee(companyId, employeeId);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Employee not found.' });
  }
});

// -------------------------------------------------------------
// Employee Registration Requests (Manager Only)
// -------------------------------------------------------------

// List employee registration requests for manager's company only
app.get('/api/employee-requests', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const requests = store.getEmployeeRequests(companyId);
    // Sanitize: do not send passwordHash
    const safeRequests = requests.map((r) => ({
      id: r.id,
      name: r.name,
      userId: r.userId,
      personalEmail: r.personalEmail,
      companyEmail: r.companyEmail,
      employeeId: r.employeeId,
      employeePost: r.employeePost,
      companyId: r.companyId,
      companyName: r.companyName,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
    }));
    res.json({ requests: safeRequests });
  } catch (err) {
    console.error('Fetch employee requests error:', err);
    res.status(500).json({ error: 'Failed to fetch employee requests.' });
  }
});

// Approve employee registration request
app.post('/api/employee-requests/:id/approve', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const manager = store.findManagerById(req.session!.userId);
    const reviewerName = manager?.managerName || 'Manager';
    const requestId = req.params.id;

    const request = store.findEmployeeRequestById(companyId, requestId);
    if (!request) {
      res.status(404).json({ error: 'Registration request not found.' });
      return;
    }

    // Approve in local datastore
    const { request: updatedReq, employee } = store.approveEmployeeRequest(
      companyId,
      requestId,
      reviewerName
    );

    // Provision or activate Supabase Auth user
    try {
      await createSupabaseAuthAccount({
        email: updatedReq.personalEmail,
        metadata: {
          user_id: updatedReq.userId,
          name: updatedReq.name,
          role: 'Employee',
          company_id: companyId,
          employee_id: updatedReq.employeeId,
          employee_post: updatedReq.employeePost,
          personal_email: updatedReq.personalEmail,
          company_email: updatedReq.companyEmail,
        },
      });
    } catch (supaErr) {
      console.warn('Supabase Auth provisioning for employee approval notice:', supaErr);
    }

    res.json({
      success: true,
      message: `${updatedReq.name} has been approved and added to your employee directory.`,
      request: {
        id: updatedReq.id,
        name: updatedReq.name,
        userId: updatedReq.userId,
        status: updatedReq.status,
        reviewedAt: updatedReq.reviewedAt,
        reviewedBy: updatedReq.reviewedBy,
      },
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        employeePost: employee.employeePost,
        status: employee.status,
      },
    });
  } catch (err: any) {
    console.error('Approve employee request error:', err);
    res.status(500).json({ error: err?.message || 'Failed to approve request.' });
  }
});

// Deny employee registration request
app.post('/api/employee-requests/:id/deny', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const manager = store.findManagerById(req.session!.userId);
    const reviewerName = manager?.managerName || 'Manager';
    const requestId = req.params.id;

    const request = store.findEmployeeRequestById(companyId, requestId);
    if (!request) {
      res.status(404).json({ error: 'Registration request not found.' });
      return;
    }

    const updated = store.denyEmployeeRequest(companyId, requestId, reviewerName);
    res.json({
      success: true,
      message: `Registration request for ${updated.name} has been denied.`,
      request: {
        id: updated.id,
        name: updated.name,
        userId: updated.userId,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewedBy: updated.reviewedBy,
      },
    });
  } catch (err: any) {
    console.error('Deny employee request error:', err);
    res.status(500).json({ error: err?.message || 'Failed to deny request.' });
  }
});

// -------------------------------------------------------------
// Tasks Management
// -------------------------------------------------------------

app.get('/api/tasks', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const session = req.session!;
  if (session.role === 'Manager') {
    const tasks = store.getTasks(session.companyId);
    res.json({ tasks });
  } else {
    // Employee gets only their assigned tasks
    const tasks = store.getTasks(session.companyId, session.employeeId);
    res.json({ tasks });
  }
});

app.get('/api/tasks/:taskId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const session = req.session!;
  const { taskId } = req.params;

  const task = store.findTaskById(taskId);
  if (!task || task.companyId !== session.companyId) {
    res.status(404).json({ error: 'Task not found.' });
    return;
  }

  // Strict privacy: employee can ONLY access their own task
  if (session.role === 'Employee') {
    if (task.employeeId.toLowerCase() !== session.employeeId?.toLowerCase()) {
      res.status(403).json({ error: 'Access denied: You do not have permission to view this task.' });
      return;
    }
  }

  res.json({ task });
});

app.post('/api/tasks', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const { employeeId, subject, description, assignedDate, deadline, status } = req.body;

    if (!employeeId || !subject || !assignedDate || !deadline) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }

    if (deadline < assignedDate) {
      res.status(400).json({ error: 'Deadline cannot be earlier than assigned date.' });
      return;
    }

    const emp = store.findEmployeeById(companyId, employeeId);
    if (!emp) {
      res.status(400).json({ error: 'Selected employee does not exist in your company.' });
      return;
    }

    const initialStatus = status && ['Pending', 'In Progress', 'Completed'].includes(status)
      ? status
      : 'Pending';

    const task = store.createTask({
      companyId,
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      employeePost: emp.employeePost,
      subject: subject.trim(),
      description: description ? String(description).trim() : undefined,
      assignedDate,
      deadline,
      status: initialStatus,
    });

    // Mirror to Supabase if configured
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('tasks').insert({
          id: task.id,
          company_id: companyId,
          employee_id: emp.employeeId,
          employee_name: emp.employeeName,
          employee_post: emp.employeePost,
          subject: task.subject,
          description: task.description || null,
          assigned_date: task.assignedDate,
          deadline: task.deadline,
          status: task.status,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
        });
      } catch (sbErr: any) {
        console.warn('Supabase task insert sync notice:', sbErr?.message || sbErr);
      }
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// Bulk task creation for Manager approval workflow
app.post('/api/tasks/bulk-create', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const { tasks } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({ error: 'Please provide at least one task to create.' });
      return;
    }

    const createdTasks: DBTask[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const t of tasks) {
      if (!t.employeeId || !t.subject || !t.deadline) {
        continue;
      }

      const emp = store.findEmployeeById(session.companyId, t.employeeId);
      if (!emp) {
        continue;
      }

      const newTask = store.createTask({
        companyId: session.companyId,
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        employeePost: emp.employeePost,
        subject: t.subject.trim(),
        description: t.description ? String(t.description).trim() : undefined,
        assignedDate: t.assignedDate || today,
        deadline: t.deadline,
        status: t.status || 'Pending',
      });

      createdTasks.push(newTask);
    }

    res.status(201).json({
      success: true,
      count: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (err) {
    console.error('Bulk create tasks error:', err);
    res.status(500).json({ error: 'Failed to create tasks.' });
  }
});

app.patch('/api/tasks/:taskId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const { taskId } = req.params;
    const { employeeId, subject, description, assignedDate, deadline, status } = req.body;

    const existingTask = store.findTaskById(taskId);
    if (!existingTask || existingTask.companyId !== session.companyId) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (session.role === 'Manager') {
      // Manager can update all task fields:
      // Employee, Employee ID, Employee Post, Task Subject, Task Description, Assigned Date, Deadline, Status
      const updates: any = {};

      if (employeeId && employeeId !== existingTask.employeeId) {
        const emp = store.findEmployeeById(session.companyId, employeeId);
        if (!emp) {
          res.status(400).json({ error: 'Selected employee does not exist in your company.' });
          return;
        }
        // Authoritatively bind employee credentials
        updates.employeeId = emp.employeeId;
        updates.employeeName = emp.employeeName;
        updates.employeePost = emp.employeePost;
      }

      if (subject !== undefined) {
        if (!String(subject).trim()) {
          res.status(400).json({ error: 'Task subject cannot be empty.' });
          return;
        }
        updates.subject = String(subject).trim();
      }

      if (description !== undefined) {
        updates.description = String(description).trim();
      }

      if (assignedDate !== undefined) {
        updates.assignedDate = assignedDate;
      }

      if (deadline !== undefined) {
        const effectiveAssignedDate = updates.assignedDate || existingTask.assignedDate;
        if (effectiveAssignedDate && deadline < effectiveAssignedDate) {
          res.status(400).json({ error: 'Deadline cannot be earlier than assigned date.' });
          return;
        }
        updates.deadline = deadline;
      }

      if (status !== undefined) {
        if (!['Pending', 'In Progress', 'Completed', 'Overdue'].includes(status)) {
          res.status(400).json({ error: 'Invalid task status.' });
          return;
        }
        updates.status = status;
      }

      const updated = store.updateTask(taskId, session.companyId, updates);

      // Mirror to Supabase if configured
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const sbUpdates: any = { updated_at: new Date().toISOString() };
          if (updates.employeeId) {
            sbUpdates.employee_id = updates.employeeId;
            sbUpdates.employee_name = updates.employeeName;
            sbUpdates.employee_post = updates.employeePost;
          }
          if (updates.subject !== undefined) sbUpdates.subject = updates.subject;
          if (updates.description !== undefined) sbUpdates.description = updates.description || null;
          if (updates.assignedDate !== undefined) sbUpdates.assigned_date = updates.assignedDate;
          if (updates.deadline !== undefined) sbUpdates.deadline = updates.deadline;
          if (updates.status !== undefined) {
            sbUpdates.status = updates.status;
            if (updates.status === 'Completed') {
              sbUpdates.completed_at = new Date().toISOString();
            }
          }
          await supabase
            .from('tasks')
            .update(sbUpdates)
            .eq('id', taskId)
            .eq('company_id', session.companyId);
        } catch (sbErr: any) {
          console.warn('Supabase task update notice:', sbErr?.message || sbErr);
        }
      }

      res.json({ task: updated });
    } else {
      // Employee can ONLY update their own task status
      if (existingTask.employeeId.toLowerCase() !== session.employeeId?.toLowerCase()) {
        res.status(403).json({ error: 'Access denied: You cannot modify tasks belonging to another employee.' });
        return;
      }

      // Block employee from attempting to edit metadata
      if (
        employeeId !== undefined ||
        req.body.employeeName !== undefined ||
        req.body.employeePost !== undefined ||
        subject !== undefined ||
        description !== undefined ||
        assignedDate !== undefined ||
        deadline !== undefined
      ) {
        res.status(403).json({ error: 'Forbidden: Employees can only update task status.' });
        return;
      }

      if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
        res.status(400).json({ error: 'Invalid task status. Status must be Pending, In Progress, or Completed.' });
        return;
      }

      const updated = store.updateTask(taskId, session.companyId, { status });

      // Mirror to Supabase if configured
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const sbUpdates: any = {
            status,
            updated_at: new Date().toISOString(),
          };
          if (status === 'Completed') {
            sbUpdates.completed_at = new Date().toISOString();
          }
          await supabase
            .from('tasks')
            .update(sbUpdates)
            .eq('id', taskId)
            .eq('company_id', session.companyId);
        } catch (sbErr: any) {
          console.warn('Supabase task status update notice:', sbErr?.message || sbErr);
        }
      }

      res.json({ task: updated });
    }
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

app.delete('/api/tasks/:taskId', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.session!.companyId;
  const { taskId } = req.params;
  const success = store.deleteTask(taskId, companyId);
  if (success) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('company_id', companyId);
      } catch (sbErr: any) {
        console.warn('Supabase task delete notice:', sbErr?.message || sbErr);
      }
    }
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Task not found.' });
  }
});

// -------------------------------------------------------------
// Meetings Management
// -------------------------------------------------------------

app.get('/api/meetings', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.session!.companyId;
  const meetings = store.getMeetings(companyId);
  res.json({ meetings });
});

app.post('/api/meetings', authMiddleware, managerOnly, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const { title, date, time, durationMinutes } = req.body;

    if (!title || !date || !time) {
      res.status(400).json({ error: 'Please provide meeting title, date, and time.' });
      return;
    }

    const meeting = store.createMeeting({
      companyId,
      title,
      date,
      time,
      durationMinutes: Number(durationMinutes) || 30,
    });

    res.status(201).json({ meeting });
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Failed to schedule meeting.' });
  }
});

app.delete('/api/meetings/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.session!.companyId;
    const meetingId = req.params.id;

    if (!meetingId) {
      res.status(400).json({ error: 'Meeting ID is required.' });
      return;
    }

    const deleted = store.deleteMeeting(meetingId, companyId);
    if (!deleted) {
      res.status(404).json({ error: 'Scheduled meeting not found.' });
      return;
    }

    res.json({ success: true, message: 'Scheduled meeting deleted successfully.' });
  } catch (err) {
    console.error('Delete meeting error:', err);
    res.status(500).json({ error: 'Failed to delete meeting.' });
  }
});

// -------------------------------------------------------------
// Meeting Audio Speech-to-Text (AssemblyAI)
// -------------------------------------------------------------
app.post('/api/meetings/transcribe', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { audioBase64, liveTranscript } = req.body;
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    // If client supplied live transcribed text from Web Speech API
    if (liveTranscript && liveTranscript.trim().length > 0 && !audioBase64) {
      res.json({
        success: true,
        transcriptText: liveTranscript.trim(),
        speakers: [{ speaker: 'Speaker 1', text: liveTranscript.trim() }],
        isLiveTranscript: true,
      });
      return;
    }

    if (!apiKey) {
      // If live transcript was sent along with audio, use it
      if (liveTranscript && liveTranscript.trim().length > 0) {
        res.json({
          success: true,
          transcriptText: liveTranscript.trim(),
          speakers: [{ speaker: 'Speaker 1', text: liveTranscript.trim() }],
          isLiveTranscript: true,
          apiKeyNotice: 'Captured via browser speech recognition. Configure ASSEMBLYAI_API_KEY in Settings > Secrets for speaker diarization.',
        });
        return;
      }

      res.status(400).json({
        error: 'AssemblyAI API key is required for cloud audio transcription. Please configure ASSEMBLYAI_API_KEY in Settings > Secrets, or use browser speech capture.',
        apiKeyMissing: true,
      });
      return;
    }

    if (!audioBase64) {
      res.status(400).json({ error: 'No audio data provided.' });
      return;
    }

    // Convert base64 audio to binary Buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Step 1: Upload audio file to AssemblyAI
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/octet-stream',
      },
      body: audioBuffer,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      console.error('AssemblyAI upload failed:', uploadRes.status, errBody);
      res.status(502).json({ error: `AssemblyAI upload failed: ${errBody}` });
      return;
    }

    const uploadData = (await uploadRes.json()) as { upload_url: string };
    const uploadUrl = uploadData.upload_url;

    // Step 2: Request transcript with speaker diarization
    const transcriptReqRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        speaker_labels: true,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!transcriptReqRes.ok) {
      const errBody = await transcriptReqRes.text();
      console.error('AssemblyAI transcription request failed:', transcriptReqRes.status, errBody);
      res.status(502).json({ error: `AssemblyAI transcription request failed: ${errBody}` });
      return;
    }

    const initData = (await transcriptReqRes.json()) as { id: string; status: string };
    const transcriptId = initData.id;

    // Step 3: Poll for completion
    let finalData: any = null;
    const maxPollAttempts = 40; // up to ~80 seconds
    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: apiKey },
      });

      if (!pollRes.ok) continue;

      const current = (await pollRes.json()) as {
        status: string;
        text?: string;
        utterances?: any[];
        error?: string;
        audio_duration?: number;
      };

      if (current.status === 'completed') {
        finalData = current;
        break;
      } else if (current.status === 'error') {
        res.status(500).json({ error: `AssemblyAI transcription error: ${current.error || 'Unknown error'}` });
        return;
      }
    }

    if (!finalData) {
      res.status(504).json({ error: 'Transcription processing timed out. Please try with a shorter audio segment.' });
      return;
    }

    const utterances = (finalData.utterances || []).map((u: any) => ({
      speaker: u.speaker ? `Speaker ${u.speaker}` : 'Speaker',
      text: u.text,
      start: u.start,
      end: u.end,
    }));

    res.json({
      success: true,
      transcriptText: finalData.text || '',
      speakers: utterances.length > 0 ? utterances : [{ speaker: 'Speaker 1', text: finalData.text || '' }],
      durationSeconds: Math.round(finalData.audio_duration || 0),
    });
  } catch (err) {
    console.error('Transcription endpoint error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Transcription processing failed' });
  }
});

// -------------------------------------------------------------
// Transcripts Management (Cloud Persistence & Supabase)
// -------------------------------------------------------------
app.get('/api/transcripts', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('company_id', session.companyId)
        .order('recorded_at', { ascending: false });

      if (!error && data) {
        return res.json({
          transcripts: data.map((t) => ({
            id: t.id,
            companyId: t.company_id,
            meetingId: t.meeting_id,
            meetingTitle: t.meeting_title,
            transcriptText: t.transcript_text,
            durationSeconds: t.duration_seconds,
            recordedAt: t.recorded_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            summary: t.summary,
            keyPoints: t.key_points || [],
            speakers: t.speakers || [],
            actionItems: t.action_items || [],
            status: t.status,
            audioStoragePath: t.audio_storage_path,
          })),
        });
      }
    }

    const transcripts = store.getTranscripts(session.companyId);
    res.json({ transcripts });
  } catch (err) {
    console.error('Fetch transcripts error:', err);
    res.status(500).json({ error: 'Failed to fetch transcripts.' });
  }
});

app.post('/api/transcripts', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const {
      meetingTitle,
      meetingId,
      transcriptText,
      durationSeconds,
      recordedAt,
      summary,
      keyPoints,
      speakers,
      actionItems,
      status,
      audioStoragePath,
    } = req.body;

    if (!transcriptText || !meetingTitle) {
      res.status(400).json({ error: 'Meeting title and transcript text are required.' });
      return;
    }

    const localTranscript = store.createTranscript({
      companyId: session.companyId,
      meetingId,
      meetingTitle,
      transcriptText,
      durationSeconds: Number(durationSeconds) || 0,
      recordedAt: recordedAt || new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      summary,
      keyPoints,
      speakers,
      actionItems,
      status: status || 'pending_review',
      audioStoragePath,
    });

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('transcripts').insert({
          id: localTranscript.id,
          company_id: session.companyId,
          meeting_id: meetingId || null,
          meeting_title: meetingTitle,
          transcript_text: transcriptText,
          duration_seconds: Number(durationSeconds) || 0,
          recorded_at: localTranscript.recordedAt,
          summary: summary || null,
          key_points: keyPoints || [],
          speakers: speakers || [],
          action_items: actionItems || [],
          status: status || 'pending_review',
          audio_storage_path: audioStoragePath || null,
        });
      } catch (e: any) {
        console.warn('Supabase transcript insert notice:', e?.message || e);
      }
    }

    res.status(201).json({ success: true, transcript: localTranscript });
  } catch (err) {
    console.error('Create transcript error:', err);
    res.status(500).json({ error: 'Failed to save transcript.' });
  }
});

app.get('/api/transcripts/:id', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const { id } = req.params;

    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('id', id)
        .eq('company_id', session.companyId)
        .single();

      if (!error && data) {
        return res.json({
          transcript: {
            id: data.id,
            companyId: data.company_id,
            meetingId: data.meeting_id,
            meetingTitle: data.meeting_title,
            transcriptText: data.transcript_text,
            durationSeconds: data.duration_seconds,
            recordedAt: data.recorded_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            summary: data.summary,
            keyPoints: data.key_points || [],
            speakers: data.speakers || [],
            actionItems: data.action_items || [],
            status: data.status,
            audioStoragePath: data.audio_storage_path,
          },
        });
      }
    }

    const t = store.getTranscriptById(id);
    if (!t || t.companyId !== session.companyId) {
      res.status(404).json({ error: 'Transcript not found.' });
      return;
    }
    res.json({ transcript: t });
  } catch (err) {
    console.error('Get transcript error:', err);
    res.status(500).json({ error: 'Failed to retrieve transcript.' });
  }
});

app.patch('/api/transcripts/:id', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const { id } = req.params;
    const updates = req.body;

    const updated = store.updateTranscript(id, updates);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const sbUpdates: Record<string, any> = {};
      if (updates.summary !== undefined) sbUpdates.summary = updates.summary;
      if (updates.keyPoints !== undefined) sbUpdates.key_points = updates.keyPoints;
      if (updates.actionItems !== undefined) sbUpdates.action_items = updates.actionItems;
      if (updates.status !== undefined) sbUpdates.status = updates.status;

      try {
        await supabase
          .from('transcripts')
          .update(sbUpdates)
          .eq('id', id)
          .eq('company_id', session.companyId);
      } catch (e: any) {
        console.warn('Supabase transcript update notice:', e?.message || e);
      }
    }

    if (!updated) {
      res.status(404).json({ error: 'Transcript not found.' });
      return;
    }
    res.json({ success: true, transcript: updated });
  } catch (err) {
    console.error('Update transcript error:', err);
    res.status(500).json({ error: 'Failed to update transcript.' });
  }
});

app.delete('/api/transcripts/:id', authMiddleware, managerOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = req.session!;
    const { id } = req.params;

    const deleted = store.deleteTranscript(id);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('transcripts')
          .delete()
          .eq('id', id)
          .eq('company_id', session.companyId);
      } catch (e: any) {
        console.warn('Supabase transcript delete notice:', e?.message || e);
      }
    }

    if (!deleted) {
      res.status(404).json({ error: 'Transcript not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete transcript error:', err);
    res.status(500).json({ error: 'Failed to delete transcript.' });
  }
});

// -------------------------------------------------------------
// AI Transcript Analysis & Task Extraction (Gemini Server-Side)
// -------------------------------------------------------------
async function handleAnalyzeTranscript(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const session = req.session!;
    const { meetingTitle, meetingDate, transcriptText, employees: reqEmployees } = req.body;

    if (!transcriptText || transcriptText.trim().length === 0) {
      res.status(400).json({ error: 'Please provide transcript text to analyze.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API client is not configured. Please ensure GEMINI_API_KEY is available in settings.' });
      return;
    }

    // Strictly enforce company boundaries: Retrieve company's real registered employees
    const companyEmployees = store.getEmployees(session.companyId);
    // Build employee lookup maps to prevent hallucination
    const employeeRoster = companyEmployees.map((e) => ({
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      employeePost: e.employeePost,
      status: e.status,
    }));

    const validEmployeeMap = new Map<string, string>();
    companyEmployees.forEach((e) => {
      validEmployeeMap.set(e.employeeId.toLowerCase(), e.employeeName);
      validEmployeeMap.set(e.employeeName.toLowerCase(), e.employeeId);
    });

    const dateContext = meetingDate || new Date().toISOString().split('T')[0];

    const prompt = `
You are MeetFlow AI, an enterprise meeting analysis assistant.
Analyze the meeting transcript and identify genuine commitments, responsibilities, deliverables, follow-ups, decisions requiring action, and deadlines.
Return structured JSON only.
Do not invent tasks.
Do not convert casual discussion into tasks unless someone is clearly responsible for an action.
Use only the employees provided in the employee directory when suggesting an assignee.
If no assignee can be confidently identified, leave the suggested assignee fields empty.
Use the transcript evidence to determine confidence.
If a deadline is explicitly stated, extract it.
If a deadline is ambiguous or not stated, leave it empty rather than hallucinating a date.
Priorities must be High, Medium, or Low:
- High: Urgent or business-critical.
- Medium: Important but not immediately urgent.
- Low: Non-urgent follow-up.
For every action item, include a short supporting transcript quote.

Meeting Title: "${meetingTitle || 'Meeting'}"
Meeting Date: ${dateContext}
Employee Directory for Assignee Matching:
${JSON.stringify(employeeRoster, null, 2)}

Transcript to Analyze:
"""
${transcriptText}
"""
`;

    const genAiConfig = {
      systemInstruction:
        'You are MeetFlow AI, an enterprise meeting analysis assistant. Analyze the meeting transcript and identify genuine commitments, responsibilities, deliverables, follow-ups, decisions requiring action, and deadlines. Return structured JSON only. Do not invent tasks. Use only the employees provided in the employee directory when suggesting an assignee. If no assignee can be confidently identified, leave the suggested assignee fields empty. If a deadline is ambiguous or not stated, leave it empty rather than hallucinating a date.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meetingSummary: {
            type: Type.STRING,
            description: 'Clear, executive overview of the meeting and key outcomes',
          },
          keyDiscussionPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key discussion topics or conclusions reached',
          },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING, description: 'Action-oriented task title' },
                description: { type: Type.STRING, description: 'Deliverables, context, and requirements' },
                suggestedEmployeeId: { type: Type.STRING, description: 'Exact employeeId from the provided directory or empty string' },
                suggestedEmployeeName: { type: Type.STRING, description: 'Name of the matched employee or empty string' },
                suggestedDeadline: { type: Type.STRING, description: 'YYYY-MM-DD format deadline if explicitly stated, or empty string' },
                priority: { type: Type.STRING, description: 'High, Medium, or Low' },
                confidence: { type: Type.INTEGER, description: 'Confidence score from 0 to 100' },
                transcriptQuote: { type: Type.STRING, description: 'Short supporting transcript quote justifying this action item' },
              },
              required: ['subject', 'description', 'priority'],
            },
          },
        },
        required: ['meetingSummary', 'keyDiscussionPoints', 'actionItems'],
      },
    };

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: genAiConfig,
      });
    } catch (modelErr) {
      console.warn('Primary model gemini-3.6-flash failed, attempting fallback to gemini-3.8-flash:', modelErr);
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: genAiConfig,
      });
    }

    const rawJson = response.text ? response.text.trim() : '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      // Fallback clean regex extraction if markdown wraps it
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { meetingSummary: response.text || '', keyDiscussionPoints: [], actionItems: [] };
      }
    }

    // Strictly validate action items to prevent employee or deadline hallucinations
    const formattedActionItems = (parsed.actionItems || []).map((item: any, idx: number) => {
      let assignedEmpId = '';
      let assignedEmpName = '';

      if (item.suggestedEmployeeId) {
        const found = companyEmployees.find(
          (e) => e.employeeId.toLowerCase() === item.suggestedEmployeeId.toLowerCase()
        );
        if (found) {
          assignedEmpId = found.employeeId;
          assignedEmpName = found.employeeName;
        }
      }

      if (!assignedEmpId && item.suggestedEmployeeName) {
        const found = companyEmployees.find(
          (e) => e.employeeName.toLowerCase().includes(item.suggestedEmployeeName.toLowerCase())
        );
        if (found) {
          assignedEmpId = found.employeeId;
          assignedEmpName = found.employeeName;
        }
      }

      return {
        id: `ai_task_${Date.now()}_${idx}`,
        subject: item.subject || 'Follow-up Action',
        description: item.description || '',
        suggestedEmployeeId: assignedEmpId,
        suggestedEmployeeName: assignedEmpName,
        suggestedDeadline: item.suggestedDeadline || '',
        priority: item.priority === 'High' || item.priority === 'Medium' || item.priority === 'Low' ? item.priority : 'Medium',
        confidence: typeof item.confidence === 'number' ? item.confidence : 85,
        transcriptQuote: item.transcriptQuote || '',
        selected: true,
      };
    });

    res.json({
      success: true,
      meetingSummary: parsed.meetingSummary || 'Meeting review completed.',
      keyDiscussionPoints: parsed.keyDiscussionPoints || [],
      actionItems: formattedActionItems,
    });
  } catch (err) {
    console.error('Analyze transcript error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI transcript analysis failed' });
  }
}

app.post('/api/ai/analyze-transcript', authMiddleware, managerOnly, handleAnalyzeTranscript);
app.post('/api/meetings/analyze-transcript', authMiddleware, managerOnly, handleAnalyzeTranscript);

// -------------------------------------------------------------
// AI Chat with Meeting Transcript (Gemini Server-Side)
// -------------------------------------------------------------
async function handleChatWithTranscript(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const session = req.session!;
    const { transcriptId, question, history, rawTranscriptText, meetingTitle, meetingDate } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({ error: 'Please enter a question about this meeting.' });
      return;
    }

    // 1. Retrieve the transcript and enforce tenant isolation
    let transcriptData: {
      meetingTitle?: string;
      transcriptText?: string;
      durationSeconds?: number;
      recordedAt?: string;
      summary?: string;
      keyPoints?: string[];
    } | null = null;

    const targetId = transcriptId || req.params?.id;
    if (targetId) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('transcripts')
          .select('*')
          .eq('id', targetId)
          .eq('company_id', session.companyId)
          .single();

        if (!error && data) {
          transcriptData = {
            meetingTitle: data.meeting_title,
            transcriptText: data.transcript_text,
            durationSeconds: data.duration_seconds,
            recordedAt: data.recorded_at,
            summary: data.summary,
            keyPoints: data.key_points || [],
          };
        }
      }

      if (!transcriptData) {
        const localT = store.getTranscriptById(targetId);
        if (localT && localT.companyId === session.companyId) {
          transcriptData = {
            meetingTitle: localT.meetingTitle,
            transcriptText: localT.transcriptText,
            durationSeconds: localT.durationSeconds,
            recordedAt: localT.recordedAt,
            summary: localT.summary,
            keyPoints: localT.keyPoints || [],
          };
        }
      }
    }

    // Fallback to client-provided raw text if authenticated manager provides it for their session
    if (!transcriptData && rawTranscriptText && typeof rawTranscriptText === 'string') {
      transcriptData = {
        meetingTitle: meetingTitle || 'Meeting',
        transcriptText: rawTranscriptText,
        recordedAt: meetingDate || new Date().toISOString(),
        durationSeconds: req.body.durationSeconds,
      };
    }

    if (!transcriptData || !transcriptData.transcriptText || transcriptData.transcriptText.trim().length === 0) {
      res.status(400).json({ error: 'No transcript available for this meeting.' });
      return;
    }

    if (transcriptData.transcriptText.trim().length < 15) {
      res.status(400).json({ error: "There's not enough transcript content to answer questions about this meeting." });
      return;
    }

    // 2. Initialize Gemini Client
    const ai = getGeminiClient();
    if (!ai) {
      console.error('Gemini API key is not configured for chat-transcript.');
      res.status(500).json({ error: "Sorry, I couldn't process that right now. Please try again." });
      return;
    }

    // 3. Prepare Metadata & Prompt
    const title = transcriptData.meetingTitle || meetingTitle || 'Meeting';
    const date = transcriptData.recordedAt ? transcriptData.recordedAt.split('T')[0] : (meetingDate || 'Not specified');
    const duration = transcriptData.durationSeconds ? `~${Math.round(transcriptData.durationSeconds / 60)} minutes` : null;
    const summary = transcriptData.summary;
    const keyPoints = transcriptData.keyPoints;

    // Cap transcript safely at ~150,000 characters to prevent extreme memory or token edge cases
    const safeTranscriptText = transcriptData.transcriptText.length > 150000
      ? transcriptData.transcriptText.substring(0, 150000) + '\n... [Transcript truncated for length]'
      : transcriptData.transcriptText;

    const systemInstruction = `You are MeetFlow AI, an intelligent meeting assistant. Your task is to answer questions about a specific meeting using ONLY the provided meeting transcript and its direct metadata.

CRITICAL RULES:
1. Read the complete transcript carefully before answering.
2. Answer ONLY using information explicitly supported by the transcript.
3. Never invent facts, people, employees, tasks, deliverables, deadlines, or decisions.
4. Never assume that someone was assigned a task unless the transcript clearly supports it.
5. Clearly distinguish between something explicitly confirmed versus tentative discussion or uncertainty.
6. If the requested information is not mentioned in the transcript, reply clearly:
   "I couldn't find that information in this meeting transcript."
7. Do not use external web search, speculation, or general knowledge about the company or industry. Keep your answer strictly focused on what was discussed in this specific meeting.
8. You are informational only. Never claim that you have created, updated, or dispatched any tasks in the system.
9. Maintain conversational continuity with previous turns in this meeting's chat session when resolving pronouns and references (e.g. "their deadline", "who was that", "the first task").
10. Format your answers cleanly with clear, readable phrasing, bullet points, or concise summaries where appropriate.`;

    const contextPreamble = `=== AUTHORITATIVE MEETING INFORMATION ===
Meeting Title: "${title}"
Meeting Date: ${date}
${duration ? `Duration: ${duration}\n` : ''}${summary ? `Meeting Summary: ${summary}\n` : ''}${keyPoints && keyPoints.length > 0 ? `Key Discussion Points:\n- ${keyPoints.join('\n- ')}\n` : ''}
=== COMPLETE RAW MEETING TRANSCRIPT ===
${safeTranscriptText}
=== END OF TRANSCRIPT ===

Please keep this entire meeting transcript in mind. You will now answer questions about this specific meeting.`;

    const contextAck = `I have read the complete transcript for "${title}". I am ready to answer any questions about what was discussed, tasks assigned, deadlines, and decisions made in this meeting using only this transcript.`;

    // 4. Construct multi-turn conversation
    const messageTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: contextPreamble }] },
      { role: 'model', parts: [{ text: contextAck }] },
    ];

    if (Array.isArray(history)) {
      // Limit to last 8 turns to keep context tightly focused
      const recentHistory = history.slice(-8);
      for (const turn of recentHistory) {
        if (turn && (turn.role === 'user' || turn.role === 'model') && typeof turn.text === 'string' && turn.text.trim().length > 0) {
          messageTurns.push({
            role: turn.role,
            parts: [{ text: turn.text.trim() }],
          });
        }
      }
    }

    // Append current user question
    messageTurns.push({
      role: 'user',
      parts: [{ text: question.trim() }],
    });

    // 5. Call Gemini API
    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: messageTurns,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
      responseText = response.text ? response.text.trim() : '';
    } catch (modelErr) {
      console.warn('Primary model gemini-3.6-flash failed, attempting fallback to gemini-3.8-flash:', modelErr);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: messageTurns,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
      responseText = fallbackResponse.text ? fallbackResponse.text.trim() : '';
    }

    if (!responseText) {
      responseText = "I couldn't find that information in this meeting transcript.";
    }

    res.json({
      success: true,
      answer: responseText,
    });
  } catch (err) {
    console.error('Chat transcript error:', err);
    res.status(500).json({ error: "Sorry, I couldn't process that right now. Please try again." });
  }
}

app.post('/api/ai/chat-transcript', authMiddleware, managerOnly, handleChatWithTranscript);
app.post('/api/transcripts/:id/chat', authMiddleware, managerOnly, handleChatWithTranscript);

// -------------------------------------------------------------
// Global Floating AI Assistant (Role-Aware & Strict Isolation)
// -------------------------------------------------------------
async function handleAssistantChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const session = req.session!;
    const { question, history } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Please provide a valid question.' });
      return;
    }

    const trimmedQuestion = question.trim();
    const today = new Date().toISOString().split('T')[0];
    const company = store.findCompanyById(session.companyId);

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI service is currently unavailable. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    let systemInstruction = '';
    let contextData = '';

    if (session.role === 'Manager') {
      // -------------------------------------------------------
      // MANAGER CONTEXT: Company-wide authorized data
      // -------------------------------------------------------
      const manager = store.findManagerById(session.userId);
      const employees = store.getEmployees(session.companyId);
      const tasks = store.getTasks(session.companyId);
      const meetings = store.getMeetings(session.companyId);
      const alerts = store.computeAlerts(session.companyId, 'Manager');

      // Fetch transcripts (from Supabase or store)
      let transcripts: any[] = [];
      try {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          const { data } = await supabase
            .from('transcripts')
            .select('*')
            .eq('company_id', session.companyId)
            .order('recorded_at', { ascending: false })
            .limit(10);
          if (data) {
            transcripts = data.map((t) => ({
              meetingTitle: t.meeting_title,
              recordedAt: t.recorded_at,
              durationSeconds: t.duration_seconds,
              summary: t.summary,
              keyPoints: t.key_points || [],
              actionItems: t.action_items || [],
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load transcripts from Supabase for AI assistant, using store fallback:', err);
      }
      if (transcripts.length === 0) {
        transcripts = store.getTranscripts(session.companyId).slice(0, 10).map((t) => ({
          meetingTitle: t.meetingTitle,
          recordedAt: t.recordedAt,
          durationSeconds: t.durationSeconds,
          summary: t.summary,
          keyPoints: t.keyPoints || [],
          actionItems: t.actionItems || [],
        }));
      }

      // Compute status breakdown
      const pendingTasks = tasks.filter((t) => t.status === 'Pending');
      const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
      const completedTasks = tasks.filter((t) => t.status === 'Completed');
      const overdueTasks = tasks.filter((t) => t.status === 'Overdue');

      // Find upcoming meetings
      const upcomingMeetings = meetings
        .filter((m) => m.date >= today)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const nextMeeting = upcomingMeetings[0] || null;

      // Workload per employee
      const workloadSummary = employees
        .map((emp) => {
          const empTasks = tasks.filter((t) => t.employeeId.toLowerCase() === emp.employeeId.toLowerCase());
          return `${emp.employeeName} (${emp.employeeId}): ${empTasks.length} task(s) [${emp.employeePost}]`;
        })
        .join(', ');

      contextData = `
=== MEETFLOW AUTHORIZED MANAGER WORKSPACE DATA ===
Today's Date: ${today}
Company Name: ${company.name} (${company.email})
Authenticated Manager: ${manager?.managerName || 'Manager'} (ID: ${manager?.managerId || session.userId})

-- DASHBOARD SUMMARY METRICS --
Total Employees: ${employees.length}
Total Tasks: ${tasks.length}
Tasks Status Counts:
- Pending: ${pendingTasks.length}
- In Progress: ${inProgressTasks.length}
- Completed: ${completedTasks.length}
- Overdue: ${overdueTasks.length}
Next Upcoming Meeting: ${nextMeeting ? `"${nextMeeting.title}" on ${nextMeeting.date} at ${nextMeeting.time} (${nextMeeting.durationMinutes} mins)` : 'None scheduled'}

-- EMPLOYEE DIRECTORY & WORKLOAD --
${employees.length > 0
  ? employees
      .map(
        (emp) =>
          `- ${emp.employeeName} | ID: ${emp.employeeId} | Designation/Post: ${emp.employeePost} | Status: ${emp.status} | Assigned Tasks: ${tasks.filter((t) => t.employeeId.toLowerCase() === emp.employeeId.toLowerCase()).length}`
      )
      .join('\n')
  : 'No employees registered yet.'}

Employee Workload Summary: ${workloadSummary || 'None'}

-- ALL TASKS IN WORKSPACE --
${tasks.length > 0
  ? tasks
      .map(
        (t) =>
          `- Subject: "${t.subject}" | Assigned To: ${t.employeeName} (ID: ${t.employeeId}, Post: ${t.employeePost}) | Assigned Date: ${t.assignedDate} | Deadline: ${t.deadline} | Status: ${t.status}`
      )
      .join('\n')
  : 'No tasks created yet.'}

-- COMPANY MEETINGS SCHEDULE --
${meetings.length > 0
  ? meetings
      .map(
        (m) =>
          `- Meeting: "${m.title}" | Date: ${m.date} | Time: ${m.time} | Duration: ${m.durationMinutes} mins`
      )
      .join('\n')
  : 'No meetings scheduled.'}

-- RECENT MEETING TRANSCRIPTS & REVIEWS --
${transcripts.length > 0
  ? transcripts
      .map(
        (t) =>
          `- Meeting: "${t.meetingTitle}" | Date: ${t.recordedAt ? t.recordedAt.split('T')[0] : 'N/A'} | Duration: ~${Math.round((t.durationSeconds || 0) / 60)} mins | Summary: ${t.summary || 'None'} | Key Points: ${(t.keyPoints || []).join('; ') || 'None'} | Action Items: ${(t.actionItems || []).map((a: any) => a.description || a.task || '').filter(Boolean).join('; ') || 'None'}`
      )
      .join('\n')
  : 'No meeting transcripts available.'}

-- WORKSPACE ALERTS --
${alerts.length > 0
  ? alerts
      .map(
        (a) =>
          `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description} (Read: ${a.read})`
      )
      .join('\n')
  : 'No active alerts.'}
`;

      systemInstruction = `
You are the official MeetFlow AI Assistant for the Manager of ${company.name}.
You have authorized access to the MeetFlow Manager Workspace Data provided above.
Your primary role is to answer questions from the manager about their workspace, including:
- Total employees, active/inactive statuses, designations, IDs, and workloads.
- Tasks, assigned employees, deadlines, overdue tasks, pending tasks, and completion statuses.
- Meetings, upcoming meeting dates/times, meeting durations, and meeting history.
- Meeting transcripts, summaries, key discussion points, and extracted action items.
- Alerts, upcoming deadlines, and overdue task notifications.

CRITICAL RULES:
1. Ground every answer strictly in the provided MeetFlow workspace data.
2. Never invent or hallucinate employees, task subjects, deadlines, meetings, or numbers.
3. If requested information is missing from the data, say: "I couldn't find that information in your MeetFlow data."
4. If asked something completely outside of MeetFlow or company workspace context, say: "I can help with information available in your MeetFlow account."
5. You are read-only: you cannot create, modify, or delete tasks, employees, or meetings.
6. Calculate relative dates accurately using "Today's Date: ${today}". E.g., deadlines on ${today} are due today, deadlines before ${today} that are not completed are overdue.
7. Keep responses concise, well-structured, professional, and easy to scan. Use clear bullet points when listing items.
`;
    } else {
      // -------------------------------------------------------
      // EMPLOYEE CONTEXT: STRICT DATA ISOLATION
      // Only this employee's own data is included!
      // -------------------------------------------------------
      const employee =
        store.findEmployeeByDbId(session.userId) ||
        (session.employeeId ? store.findEmployeeById(session.companyId, session.employeeId) : null);

      const empId = employee?.employeeId || session.employeeId || '';
      const empName = employee?.employeeName || 'Employee';
      const empPost = employee?.employeePost || 'Staff';
      const empStatus = employee?.status || 'ACTIVE';

      // STRICT ISOLATION: Filter tasks ONLY for this specific employee
      const myTasks = store.getTasks(session.companyId, empId);

      // STRICT ISOLATION: Filter alerts ONLY for this specific employee
      const myAlerts = store.computeAlerts(session.companyId, 'Employee', empId);

      // Upcoming company meetings (visible to employees)
      const meetings = store.getMeetings(session.companyId);

      const pendingTasks = myTasks.filter((t) => t.status === 'Pending');
      const inProgressTasks = myTasks.filter((t) => t.status === 'In Progress');
      const completedTasks = myTasks.filter((t) => t.status === 'Completed');
      const overdueTasks = myTasks.filter((t) => t.status === 'Overdue');

      contextData = `
=== MEETFLOW AUTHORIZED EMPLOYEE PERSONAL DATA ===
Today's Date: ${today}
Company Name: ${company.name}
Your Name: ${empName}
Your Employee ID: ${empId}
Your Designation/Post: ${empPost}
Your Status: ${empStatus}

-- YOUR PERSONAL TASK METRICS --
Total Assigned Tasks: ${myTasks.length}
- Pending: ${pendingTasks.length}
- In Progress: ${inProgressTasks.length}
- Completed: ${completedTasks.length}
- Overdue: ${overdueTasks.length}

-- YOUR ASSIGNED TASKS --
${myTasks.length > 0
  ? myTasks
      .map(
        (t) =>
          `- Task: "${t.subject}" | Assigned Date: ${t.assignedDate} | Deadline: ${t.deadline} | Status: ${t.status}`
      )
      .join('\n')
  : 'You currently have no tasks assigned.'}

-- YOUR NOTIFICATIONS & ALERTS --
${myAlerts.length > 0
  ? myAlerts
      .map(
        (a) =>
          `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`
      )
      .join('\n')
  : 'No alerts.'}

-- UPCOMING COMPANY MEETINGS --
${meetings.length > 0
  ? meetings
      .map(
        (m) =>
          `- Meeting: "${m.title}" | Date: ${m.date} | Time: ${m.time} | Duration: ${m.durationMinutes} mins`
      )
      .join('\n')
  : 'No company meetings scheduled.'}
`;

      systemInstruction = `
You are the personal MeetFlow AI Assistant for employee ${empName} (ID: ${empId}, Post: ${empPost}).
You have authorized access ONLY to this employee's personal assigned tasks, deadlines, status, alerts, and company meetings as provided above.

CRITICAL SECURITY & DATA ISOLATION RULES (MANDATORY):
1. You must NEVER reveal, discuss, or speculate about any other employee's private tasks, task statuses, deadlines, employee IDs, posts, workloads, or company-wide manager statistics.
2. If the employee asks about another employee (e.g. "What tasks are assigned to Aarav?", "What is Riya's post?", "Tell me Aarav's deadlines", or asks about other team members' workloads):
   You MUST reply with exactly: "I can only provide information available to your account."
   Do NOT acknowledge whether the requested employee exists, do NOT state whether they have tasks, and do NOT disclose any details.
3. Ground all answers strictly in this employee's authorized personal data provided above. Never hallucinate or invent tasks, deadlines, or statuses.
4. If requested information is missing from the employee's data, say: "I couldn't find that information in your MeetFlow data."
5. If the user asks general questions outside of MeetFlow, say: "I can help with information available in your MeetFlow account."
6. You are read-only: you cannot create, edit, delete, or complete tasks.
7. Calculate relative dates accurately using "Today's Date: ${today}".
8. Maintain a friendly, supportive, and professional tone with clear formatting.
`;
    }

    // Build multi-turn history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-8);
      for (const turn of recentHistory) {
        if (
          turn &&
          (turn.role === 'user' || turn.role === 'model') &&
          typeof turn.text === 'string' &&
          turn.text.trim().length > 0
        ) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text.trim() }],
          });
        }
      }
    }

    // Append the current user question alongside the dynamic context
    contents.push({
      role: 'user',
      parts: [
        {
          text: `Current MeetFlow Application State:\n${contextData}\n\nUser Question:\n${trimmedQuestion}`,
        },
      ],
    });

    let responseText = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
      responseText = response.text ? response.text.trim() : '';
    } catch (primaryErr) {
      console.warn('Gemini 3.6 Flash assistant query failed, trying fallback model gemini-3.8-flash:', primaryErr);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
      responseText = fallbackResponse.text ? fallbackResponse.text.trim() : '';
    }

    if (!responseText) {
      responseText = "I couldn't find that information in your MeetFlow data.";
    }

    res.json({
      success: true,
      answer: responseText,
    });
  } catch (err) {
    console.error('Assistant chat endpoint error:', err);
    res.status(500).json({ error: "Sorry, I couldn't process that right now. Please try again." });
  }
}

app.post('/api/ai/assistant-chat', authMiddleware, handleAssistantChat);

// -------------------------------------------------------------
// Alerts Management
// -------------------------------------------------------------

app.get('/api/alerts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const session = req.session!;
  const alerts = store.computeAlerts(
    session.companyId,
    session.role,
    session.role === 'Employee' ? session.employeeId : undefined
  );
  res.json({ alerts });
});

app.post('/api/alerts/:alertId/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { alertId } = req.params;
  store.markAlertRead(alertId);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Dashboard Statistics
// -------------------------------------------------------------

app.get('/api/stats', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const session = req.session!;
  const companyId = session.companyId;

  if (session.role === 'Manager') {
    const employees = store.getEmployees(companyId);
    const tasks = store.getTasks(companyId);
    const meetings = store.getMeetings(companyId);

    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter((t) => t.status === 'Pending').length;
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const overdueTasks = tasks.filter((t) => t.status === 'Overdue').length;

    // Upcoming meeting: soonest meeting on or after today
    const today = new Date().toISOString().split('T')[0];
    const upcomingMeetings = meetings
      .filter((m) => m.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const upcomingMeeting = upcomingMeetings[0] || null;

    // Employee workload: number of tasks per employee
    const workload = employees.map((emp) => {
      const count = tasks.filter((t) => t.employeeId.toLowerCase() === emp.employeeId.toLowerCase()).length;
      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        taskCount: count,
      };
    });

    // Meeting distribution (pie chart)
    const meetingDistribution = meetings.map((m) => ({
      name: m.title,
      durationMinutes: m.durationMinutes,
    }));

    // Recent tasks (latest 3)
    const recentTasks = tasks.slice(0, 3);

    res.json({
      totalEmployees: employees.length,
      taskStats: {
        total: totalTasks,
        pending: pendingTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      upcomingMeeting,
      workload,
      meetingDistribution,
      recentTasks,
    });
  } else {
    // Employee stats: personal tasks only
    const myTasks = store.getTasks(companyId, session.employeeId);
    const total = myTasks.length;
    const pending = myTasks.filter((t) => t.status === 'Pending').length;
    const completed = myTasks.filter((t) => t.status === 'Completed').length;
    const overdue = myTasks.filter((t) => t.status === 'Overdue').length;

    res.json({
      taskStats: {
        total,
        pending,
        completed,
        overdue,
      },
      recentTasks: myTasks.slice(0, 3),
    });
  }
});

// -------------------------------------------------------------
// Vite Server Integration
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MeetFlow server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
