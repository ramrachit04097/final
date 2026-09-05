import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { UserRole, AuthUser } from '../types';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  Building2,
  UserCheck,
  UserPlus,
  Mail,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { api } from '../services/api';
import { TubesBackground } from './TubesBackground';
import { GlowingEdgeCard } from './GlowingEdgeCard';
import { useTheme } from '../context/ThemeContext';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onShowToast }) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [signupType, setSignupType] = useState<'Manager' | 'Employee'>('Manager');

  // Login Form States (clean empty strings)
  const [companyEmail, setCompanyEmail] = useState('');
  const [userType, setUserType] = useState<UserRole>('Manager');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Available Companies List (for employee signup)
  const [companies, setCompanies] = useState<{ id: string; name: string; email: string }[]>([]);

  // Sign Up Form States (Manager)
  const [mgrCompanyName, setMgrCompanyName] = useState('');
  const [mgrCompanyEmail, setMgrCompanyEmail] = useState('');
  const [mgrPersonalEmail, setMgrPersonalEmail] = useState('');
  const [mgrName, setMgrName] = useState('');
  const [mgrUserId, setMgrUserId] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');
  const [mgrConfirmPassword, setMgrConfirmPassword] = useState('');
  const [showMgrPassword, setShowMgrPassword] = useState(false);
  const [showMgrConfirmPassword, setShowMgrConfirmPassword] = useState(false);
  const [mgrUserIdStatus, setMgrUserIdStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  // Sign Up Form States (Employee)
  const [empName, setEmpName] = useState('');
  const [empUserId, setEmpUserId] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empConfirmPassword, setEmpConfirmPassword] = useState('');
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [showEmpConfirmPassword, setShowEmpConfirmPassword] = useState(false);
  const [empPersonalEmail, setEmpPersonalEmail] = useState('');
  const [empCompanyEmail, setEmpCompanyEmail] = useState('');
  const [empId, setEmpId] = useState('');
  const [empPost, setEmpPost] = useState('');
  const [empCompanyId, setEmpCompanyId] = useState('');
  const [empUserIdStatus, setEmpUserIdStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  // Forgot Password Flow States
  // Step 1: user_id | Step 2: verify_otp | Step 3: reset_password
  const [forgotStep, setForgotStep] = useState<'userId' | 'otp' | 'reset'>('userId');
  const [forgotUserId, setForgotUserId] = useState('');
  const [forgotSessionId, setForgotSessionId] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load registered companies for employee registration
  useEffect(() => {
    api.getCompanies()
      .then((data) => {
        setCompanies(data);
        if (data.length > 0 && !empCompanyId) {
          setEmpCompanyId(data[0].id);
          setEmpCompanyEmail(data[0].email);
        }
      })
      .catch(() => {});
  }, []);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Debounced check for Manager User ID
  useEffect(() => {
    if (!mgrUserId.trim() || mgrUserId.trim().length < 3) {
      setMgrUserIdStatus({ checking: false });
      return;
    }

    setMgrUserIdStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUserIdAvailability(mgrUserId.trim());
        setMgrUserIdStatus({
          checking: false,
          available: result.available,
          message: result.message,
        });
      } catch {
        setMgrUserIdStatus({ checking: false });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [mgrUserId]);

  // Debounced check for Employee User ID
  useEffect(() => {
    if (!empUserId.trim() || empUserId.trim().length < 3) {
      setEmpUserIdStatus({ checking: false });
      return;
    }

    setEmpUserIdStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const result = await api.checkUserIdAvailability(empUserId.trim());
        setEmpUserIdStatus({
          checking: false,
          available: result.available,
          message: result.message,
        });
      } catch {
        setEmpUserIdStatus({ checking: false });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [empUserId]);

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!companyEmail.trim() || !userId.trim() || !password.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login({
        companyEmail: companyEmail.trim(),
        userType,
        userId: userId.trim(),
        password,
      });

      onShowToast(
        `Welcome back, ${res.user.name}`,
        `Signed in to ${res.user.companyName} as ${res.user.role}`,
        'success'
      );
      onLoginSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || 'User not found or incorrect credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Manager Sign Up Submit
  const handleManagerSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (
      !mgrCompanyName.trim() ||
      !mgrCompanyEmail.trim() ||
      !mgrPersonalEmail.trim() ||
      !mgrName.trim() ||
      !mgrUserId.trim() ||
      !mgrPassword ||
      !mgrConfirmPassword
    ) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mgrCompanyEmail.trim())) {
      setErrorMessage('Invalid company email address format.');
      return;
    }
    if (!emailRegex.test(mgrPersonalEmail.trim())) {
      setErrorMessage('Invalid personal Gmail address format.');
      return;
    }

    if (mgrPassword !== mgrConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (mgrPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    if (mgrUserIdStatus.available === false) {
      setErrorMessage(mgrUserIdStatus.message || 'This User ID is already taken. Please choose another User ID.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.registerManager({
        companyName: mgrCompanyName.trim(),
        companyEmail: mgrCompanyEmail.trim(),
        personalEmail: mgrPersonalEmail.trim(),
        managerName: mgrName.trim(),
        managerId: mgrUserId.trim(),
        password: mgrPassword,
        confirmPassword: mgrConfirmPassword,
      });

      setSuccessMessage(res.message || 'Workspace created successfully.');
      onShowToast('Workspace Created', 'You can now sign in with your credentials.', 'success');
      setCompanyEmail(mgrCompanyEmail.trim());
      setUserId(mgrUserId.trim());
      setUserType('Manager');
      setPassword('');
      setMode('login');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create workspace.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Employee Sign Up Submit
  const handleEmployeeSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (
      !empName.trim() ||
      !empUserId.trim() ||
      !empPassword ||
      !empConfirmPassword ||
      !empPersonalEmail.trim() ||
      !empCompanyEmail.trim() ||
      !empId.trim() ||
      !empCompanyId
    ) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(empCompanyEmail.trim())) {
      setErrorMessage('Invalid company email address format.');
      return;
    }
    if (!emailRegex.test(empPersonalEmail.trim())) {
      setErrorMessage('Invalid personal Gmail address format.');
      return;
    }

    if (empPassword !== empConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (empPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    if (empUserIdStatus.available === false) {
      setErrorMessage(empUserIdStatus.message || 'This User ID is already taken. Please choose another User ID.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.registerEmployee({
        name: empName.trim(),
        userId: empUserId.trim(),
        password: empPassword,
        confirmPassword: empConfirmPassword,
        personalEmail: empPersonalEmail.trim(),
        companyEmail: empCompanyEmail.trim(),
        employeeId: empId.trim(),
        employeePost: empPost.trim() || 'Team Member',
        companyId: empCompanyId,
      });

      setSuccessMessage(res.message);
      onShowToast('Registration Submitted', res.message, 'success');
      setCompanyEmail(empCompanyEmail.trim());
      setUserId(empUserId.trim());
      setUserType('Employee');
      setPassword('');
      setMode('login');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit registration request.');
    } finally {
      setLoading(false);
    }
  };

  // When the user clicks "Forgot Password?" on the login page
  const handleForgotPasswordClick = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const targetUserId = userId.trim();
    if (!targetUserId) {
      setErrorMessage('Please enter your User ID first.');
      onShowToast('User ID Required', 'Please enter your User ID before clicking Forgot Password.', 'warning');
      const el = document.getElementById('login-user-id');
      if (el) el.focus();
      return;
    }

    try {
      setCheckingUser(true);
      // Check whether that user id is in the database or not
      const checkRes = await api.checkUserExists(targetUserId);
      if (!checkRes || !checkRes.exists) {
        setErrorMessage('User not found');
        onShowToast('User Not Found', 'User not found in the database.', 'warning');
        return;
      }

      // If user exists, transition to recovery and send OTP code
      const verifiedUserId = checkRes.userId || targetUserId;
      setForgotUserId(verifiedUserId);
      try {
        const res = await api.initiateForgotPassword(verifiedUserId);
        setForgotSessionId(res.sessionId);
        setForgotMaskedEmail(res.maskedEmail);
        setResendCooldown(60);
        setForgotStep('otp');
        setMode('forgot-password');
        setSuccessMessage(res.message || `Enter the 6-digit OTP sent to your registered email.`);
        onShowToast('Account Verified', `OTP code sent to ${res.maskedEmail}`, 'success');
      } catch (otpErr: any) {
        setForgotStep('userId');
        setMode('forgot-password');
        const errText = otpErr?.message || 'Failed to send OTP code.';
        setErrorMessage(errText);
      }
    } catch (err: any) {
      const msg = err?.message || 'User not found';
      setErrorMessage(msg);
      onShowToast(msg === 'User not found' ? 'User Not Found' : 'Error', msg, 'warning');
    } finally {
      setCheckingUser(false);
    }
  };

  // Handle Forgot Password - Step 1: Initiate
  const handleForgotInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmed = forgotUserId.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your User ID.');
      return;
    }

    try {
      setLoading(true);
      // Check whether that user id is in the database or not
      const checkRes = await api.checkUserExists(trimmed);
      if (!checkRes || !checkRes.exists) {
        setErrorMessage('User not found');
        onShowToast('User Not Found', 'User not found in the database.', 'warning');
        return;
      }

      const res = await api.initiateForgotPassword(checkRes.userId || trimmed);
      setForgotSessionId(res.sessionId);
      setForgotMaskedEmail(res.maskedEmail);
      setResendCooldown(60);
      setForgotStep('otp');
      setSuccessMessage(res.message || `Enter the 6-digit OTP sent to your registered email.`);
    } catch (err: any) {
      const msg = err?.message || 'User not found';
      setErrorMessage(msg);
      onShowToast(msg === 'User not found' ? 'User Not Found' : 'Error', msg, 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password - Step 2: Verify OTP
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!forgotOtp.trim()) {
      setErrorMessage('Please enter the 6-digit OTP.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.verifyResetOtp(forgotSessionId, forgotOtp.trim());
      setForgotResetToken(res.resetToken);
      setForgotStep('reset');
      setSuccessMessage('OTP verified. Please create your new password.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Incorrect OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password - Resend OTP
  const handleForgotResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage('');
    try {
      setLoading(true);
      const res = await api.resendResetOtp(forgotSessionId);
      setForgotSessionId(res.sessionId);
      setResendCooldown(60);
      onShowToast('New OTP Sent', `A new verification code has been sent to your registered email.`, 'info');
      setSuccessMessage(res.message || 'A new verification code has been sent to your registered email.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password - Step 3: Reset Password
  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!forgotNewPassword || !forgotConfirmPassword) {
      setErrorMessage('Please enter and confirm your new password.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (forgotNewPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.resetPassword({
        resetToken: forgotResetToken,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
      });

      onShowToast('Password Updated', res.message, 'success');
      setSuccessMessage('Your password has been changed successfully. You can now log in.');
      setUserId(forgotUserId.trim());
      setPassword('');
      setForgotStep('userId');
      setForgotUserId('');
      setForgotOtp('');
      setForgotResetToken('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="meetflow-auth-canvas"
      className={`min-h-screen w-full flex flex-col lg:flex-row relative overflow-hidden font-sans select-none transition-colors duration-200 ${
        isLight ? 'bg-[#FAFAFC] text-[#111827]' : 'bg-[#08070d] text-white'
      }`}
    >
      {/* ========================================================= */}
      {/* DESKTOP LEFT COLUMN: ~52% WIDTH INTERACTIVE 3D EXPERIENCE */}
      {/* ========================================================= */}
      <div
        className={`relative w-full lg:w-[52%] min-h-[420px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r overflow-hidden transition-colors duration-200 ${
          isLight
            ? 'bg-gradient-to-br from-[#FFFFFF] via-[#F8FAFC] to-[#EEF2FF] border-[#E5E7EB]'
            : 'bg-[#0d0a16] border-violet-900/20'
        }`}
      >
        {isLight ? (
          <>
            {/* Subtle premium light background decorative shapes */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -right-24 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
            {/* Subtle grid pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(#4F46E5 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
              }}
            />
          </>
        ) : (
          <>
            {/* Three.js Interactive Tubes WebGL Background */}
            <TubesBackground opacity={0.65} interactive={true} className="z-0" />
            {/* Cinematic gradient overlays to guarantee pristine contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08070d] via-transparent to-[#08070d]/50 pointer-events-none z-1" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#08070d_80%)] pointer-events-none z-1" />
          </>
        )}

        {/* Top Header Logo on Left */}
        <div className="relative z-10 flex items-center justify-between">
          <Logo size="lg" showSubtitle={true} variant={isLight ? 'indigo' : 'violet'} />
        </div>

        {/* Clean Center: App Name Branding against the Canvas */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-center justify-center text-center">
          <Logo size="xl" showText={true} showSubtitle={true} variant={isLight ? 'indigo' : 'violet'} className="scale-110" />
          <p className={`mt-4 text-xs tracking-wider uppercase font-semibold ${isLight ? 'text-[#4F46E5]' : 'text-violet-300/60'}`}>
            Meet. Decide. Assign. Act
          </p>
        </div>

        {/* Bottom Metadata */}
        <div className={`relative z-10 text-xs flex items-center justify-between ${isLight ? 'text-[#6B7280]' : 'text-violet-400/60'}`}>
          <span>Enterprise Meeting Management</span>
          <span>© 2026 MeetFlow Inc.</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP RIGHT COLUMN: AUTHENTICATION PANEL (~48%)        */}
      {/* ========================================================= */}
      <div className={`w-full lg:w-[48%] flex items-center justify-center p-6 sm:p-10 lg:p-14 relative z-10 overflow-y-auto max-h-screen transition-colors duration-200 ${
        isLight ? 'bg-[#FAFAFC] lg:bg-[#F9FAFB]' : 'bg-[#08070d]'
      }`}>
        <div className="w-full max-w-md py-4">
          {/* Main Auth Container with Glowing Edge Treatment */}
          <GlowingEdgeCard
            tilt={false}
            glowColor="#8b7cff"
            className={`p-8 sm:p-10 ${
              isLight
                ? 'shadow-[0_20px_50px_rgba(15,23,42,0.06)] bg-white border border-[#E5E7EB]'
                : 'shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
            }`}
          >
            {/* Header with MeetFlow Logo & Name & Theme Toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                    M
                  </div>
                  <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-[#111827]' : 'text-white'}`}>MeetFlow</h1>
                </div>
                <button
                  type="button"
                  id="login-theme-toggle-btn"
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl border transition cursor-pointer focus:outline-none flex items-center justify-center ${
                    isLight
                      ? 'border-[#E5E7EB] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#4B5563]'
                      : 'border-violet-900/30 bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 hover:text-white'
                  }`}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-300 transition-transform duration-200 hover:rotate-45" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#4F46E5] transition-transform duration-200 hover:-rotate-12" />
                  )}
                </button>
              </div>
              <p className={`text-xs ${isLight ? 'text-[#6B7280]' : 'text-violet-300/70'}`}>
                {mode === 'login' && 'Sign in to access your meeting intelligence and tasks'}
                {mode === 'signup' && 'Create your account or submit a join request'}
                {mode === 'forgot-password' && 'Password recovery with personal email verification'}
              </p>
            </div>

            {/* Error Feedback Banner */}
            {errorMessage && (
              <div
                id="auth-error-banner"
                className={`mb-5 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
                  isLight
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                }`}
              >
                <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
                <span className="flex-1 leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Success Feedback Banner */}
            {successMessage && (
              <div
                id="auth-success-banner"
                className={`mb-5 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span className="flex-1 leading-relaxed font-medium">{successMessage}</span>
              </div>
            )}

            {/* ========================================================= */}
            {/* 1. LOGIN MODE                                             */}
            {/* ========================================================= */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* 1. COMPANY EMAIL ID */}
                <div>
                  <label
                    htmlFor="login-company-email"
                    className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5"
                  >
                    Company Email ID
                  </label>
                  <input
                    id="login-company-email"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => {
                      setCompanyEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition duration-200"
                    required
                  />
                </div>

                {/* 2. LOGIN AS DROPDOWN */}
                <div>
                  <label
                    htmlFor="login-as-role"
                    className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5"
                  >
                    Login As
                  </label>
                  <select
                    id="login-as-role"
                    value={userType}
                    onChange={(e) => {
                      setUserType(e.target.value as UserRole);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition duration-200 cursor-pointer"
                  >
                    <option value="Manager" className="bg-[#121020] text-white">
                      Manager
                    </option>
                    <option value="Employee" className="bg-[#121020] text-white">
                      Employee
                    </option>
                  </select>
                </div>

                {/* 3. USER ID */}
                <div>
                  <label
                    htmlFor="login-user-id"
                    className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5"
                  >
                    User ID
                  </label>
                  <input
                    id="login-user-id"
                    type="text"
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder={userType === 'Manager' ? 'e.g. MGR-001' : 'e.g. EMP-101'}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition duration-200"
                    required
                  />
                </div>

                {/* 4. PASSWORD + FORGOT PASSWORD LINK */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      id="forgot-password-link-btn"
                      onClick={handleForgotPasswordClick}
                      disabled={checkingUser}
                      className={`text-[11px] font-medium hover:underline transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                        isLight ? 'text-indigo-600 hover:text-indigo-800' : 'text-violet-400 hover:text-violet-200'
                      }`}
                    >
                      {checkingUser ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Checking User ID...</span>
                        </>
                      ) : (
                        <span>Forgot Password?</span>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition duration-200"
                      required
                    />
                    <button
                      type="button"
                      id="toggle-login-password-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-violet-400/50 hover:text-violet-200 transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 5. LOGIN BUTTON */}
                <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] active:bg-[#5b4be0] text-white text-sm font-semibold shadow-[0_0_25px_rgba(109,93,245,0.45)] hover:shadow-[0_0_35px_rgba(109,93,245,0.6)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </button>

                {/* 6. SIGN UP BUTTON */}
                <div className="pt-5 border-t border-violet-900/30 text-center flex items-center justify-center gap-1.5 text-xs text-violet-300/70">
                  <span>Don't have an account?</span>
                  <button
                    type="button"
                    id="switch-to-signup-btn"
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-semibold text-violet-300 hover:text-white underline underline-offset-4 decoration-violet-500 transition cursor-pointer"
                  >
                    Sign Up
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================= */}
            {/* 2. SIGN UP MODE: TWO TYPES OF SIGN-UP                     */}
            {/* ========================================================= */}
            {mode === 'signup' && (
              <div className="space-y-4">
                {/* Sign-Up Type Switcher Tab */}
                <div className="p-1 rounded-xl bg-[#120e24] border border-violet-900/40 grid grid-cols-2 gap-1 mb-3">
                  <button
                    type="button"
                    id="signup-tab-manager"
                    onClick={() => {
                      setSignupType('Manager');
                      setErrorMessage('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      signupType === 'Manager'
                        ? 'bg-[#6d5df5] text-white shadow-md shadow-violet-900/40'
                        : 'text-violet-300/70 hover:text-white hover:bg-violet-900/20'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Manager Sign Up</span>
                  </button>
                  <button
                    type="button"
                    id="signup-tab-employee"
                    onClick={() => {
                      setSignupType('Employee');
                      setErrorMessage('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      signupType === 'Employee'
                        ? 'bg-[#6d5df5] text-white shadow-md shadow-violet-900/40'
                        : 'text-violet-300/70 hover:text-white hover:bg-violet-900/20'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Employee Sign Up</span>
                  </button>
                </div>

                {/* 2A: MANAGER REGISTRATION FORM */}
                {signupType === 'Manager' ? (
                  <form onSubmit={handleManagerSignUp} className="space-y-3">
                    {/* Company Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        id="signup-mgr-company-name"
                        value={mgrCompanyName}
                        onChange={(e) => setMgrCompanyName(e.target.value)}
                        placeholder="e.g. Acme Corporation"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Manager Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Manager Name
                      </label>
                      <input
                        type="text"
                        id="signup-mgr-name"
                        value={mgrName}
                        onChange={(e) => setMgrName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Company Email ID */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Company Email ID
                      </label>
                      <input
                        type="email"
                        id="signup-mgr-company-email"
                        value={mgrCompanyEmail}
                        onChange={(e) => setMgrCompanyEmail(e.target.value)}
                        placeholder="admin@company.com"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Personal Gmail ID (For Recovery) */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Personal Gmail ID (For Password Recovery)
                      </label>
                      <input
                        type="email"
                        id="signup-mgr-personal-email"
                        value={mgrPersonalEmail}
                        onChange={(e) => setMgrPersonalEmail(e.target.value)}
                        placeholder="sarah.personal@gmail.com"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Manager User ID */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Manager User ID
                      </label>
                      <input
                        type="text"
                        id="signup-mgr-user-id"
                        value={mgrUserId}
                        onChange={(e) => setMgrUserId(e.target.value)}
                        placeholder="e.g. MGR-001"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                      {mgrUserIdStatus.checking && (
                        <p className="text-[11px] text-violet-400/70 mt-1 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                        </p>
                      )}
                      {!mgrUserIdStatus.checking && mgrUserIdStatus.available === true && (
                        <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> User ID is available
                        </p>
                      )}
                      {!mgrUserIdStatus.checking && mgrUserIdStatus.available === false && (
                        <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {mgrUserIdStatus.message}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showMgrPassword ? 'text' : 'password'}
                          id="signup-mgr-password"
                          value={mgrPassword}
                          onChange={(e) => setMgrPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowMgrPassword(!showMgrPassword)}
                          className="absolute right-3 top-2.5 text-violet-400/50 hover:text-violet-200"
                        >
                          {showMgrPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showMgrConfirmPassword ? 'text' : 'password'}
                          id="signup-mgr-confirm-password"
                          value={mgrConfirmPassword}
                          onChange={(e) => setMgrConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowMgrConfirmPassword(!showMgrConfirmPassword)}
                          className="absolute right-3 top-2.5 text-violet-400/50 hover:text-violet-200"
                        >
                          {showMgrConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="signup-mgr-submit-btn"
                      disabled={loading || mgrUserIdStatus.available === false}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-sm font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Creating Workspace...</span>
                        </>
                      ) : (
                        <span>Register Workspace</span>
                      )}
                    </button>
                  </form>
                ) : (
                  /* 2B: EMPLOYEE REGISTRATION REQUEST FORM */
                  <form onSubmit={handleEmployeeSignUp} className="space-y-3">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="signup-emp-name"
                        value={empName}
                        onChange={(e) => setEmpName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Workspace / Company Selection */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Company Workspace
                      </label>
                      {companies.length > 0 ? (
                        <select
                          id="signup-emp-company-select"
                          value={empCompanyId}
                          onChange={(e) => {
                            const selected = companies.find((c) => c.id === e.target.value);
                            setEmpCompanyId(e.target.value);
                            if (selected) {
                              setEmpCompanyEmail(selected.email);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          {companies.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#121020] text-white">
                              {c.name} ({c.email})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="email"
                          id="signup-emp-company-email-fallback"
                          value={empCompanyEmail}
                          onChange={(e) => setEmpCompanyEmail(e.target.value)}
                          placeholder="company@company.com"
                          className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                      )}
                    </div>

                    {/* Desired User ID */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Desired User ID
                      </label>
                      <input
                        type="text"
                        id="signup-emp-user-id"
                        value={empUserId}
                        onChange={(e) => setEmpUserId(e.target.value)}
                        placeholder="e.g. alex.morgan"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                      {empUserIdStatus.checking && (
                        <p className="text-[11px] text-violet-400/70 mt-1 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                        </p>
                      )}
                      {!empUserIdStatus.checking && empUserIdStatus.available === true && (
                        <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> User ID is available
                        </p>
                      )}
                      {!empUserIdStatus.checking && empUserIdStatus.available === false && (
                        <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {empUserIdStatus.message}
                        </p>
                      )}
                    </div>

                    {/* Employee ID & Designation */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                          Employee ID
                        </label>
                        <input
                          type="text"
                          id="signup-emp-employee-id"
                          value={empId}
                          onChange={(e) => setEmpId(e.target.value)}
                          placeholder="EMP-104"
                          className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          id="signup-emp-post"
                          value={empPost}
                          onChange={(e) => setEmpPost(e.target.value)}
                          placeholder="e.g. QA Engineer"
                          className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    {/* Personal Gmail ID */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Personal Gmail ID (For Recovery)
                      </label>
                      <input
                        type="email"
                        id="signup-emp-personal-email"
                        value={empPersonalEmail}
                        onChange={(e) => setEmpPersonalEmail(e.target.value)}
                        placeholder="alex.personal@gmail.com"
                        className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showEmpPassword ? 'text' : 'password'}
                          id="signup-emp-password"
                          value={empPassword}
                          onChange={(e) => setEmpPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmpPassword(!showEmpPassword)}
                          className="absolute right-3 top-2.5 text-violet-400/50 hover:text-violet-200"
                        >
                          {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showEmpConfirmPassword ? 'text' : 'password'}
                          id="signup-emp-confirm-password"
                          value={empConfirmPassword}
                          onChange={(e) => setEmpConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmpConfirmPassword(!showEmpConfirmPassword)}
                          className="absolute right-3 top-2.5 text-violet-400/50 hover:text-violet-200"
                        >
                          {showEmpConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-800/30 text-[11px] text-violet-300/80 leading-relaxed">
                      💡 Upon submission, your registration request will be placed in pending status until approved by your company's Manager.
                    </div>

                    <button
                      type="submit"
                      id="signup-emp-submit-btn"
                      disabled={loading || empUserIdStatus.available === false}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-sm font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <span>Submit Registration Request</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Switch back to Login */}
                <div className="pt-3 border-t border-violet-900/30 text-center flex items-center justify-center gap-1.5 text-xs text-violet-300/70">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    id="switch-back-to-login-btn"
                    onClick={() => {
                      setMode('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-semibold text-violet-300 hover:text-white underline underline-offset-4 decoration-violet-500 transition cursor-pointer"
                  >
                    Login
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. FORGOT PASSWORD MODE                                   */}
            {/* ========================================================= */}
            {mode === 'forgot-password' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-violet-300 text-xs font-semibold pb-2 border-b border-violet-900/30">
                  <KeyRound className="w-4 h-4 text-violet-400" />
                  <span>
                    {forgotStep === 'userId' && 'Step 1: Enter User ID'}
                    {forgotStep === 'otp' && 'Step 2: Verify OTP Code'}
                    {forgotStep === 'reset' && 'Step 3: Set New Password'}
                  </span>
                </div>

                {/* STEP 1: Enter User ID */}
                {forgotStep === 'userId' && (
                  <form onSubmit={handleForgotInitiate} className="space-y-3.5">
                    <p className="text-xs text-violet-300/80 leading-relaxed">
                      Enter your User ID. We will find your registered account and send a 6-digit recovery OTP to your personal Gmail address.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5">
                        Enter your User ID
                      </label>
                      <input
                        type="text"
                        id="forgot-user-id-input"
                        value={forgotUserId}
                        onChange={(e) => setForgotUserId(e.target.value)}
                        placeholder="e.g. MGR-001 or alex.morgan"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition duration-200"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      id="forgot-step1-submit-btn"
                      disabled={loading}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-sm font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Locating Account...</span>
                        </>
                      ) : (
                        <span>Continue to Verification</span>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP 2: Verify OTP */}
                {forgotStep === 'otp' && (
                  <form onSubmit={handleForgotVerifyOtp} className="space-y-3.5">
                    <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-xs text-violet-200 flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-white">Enter the 6-digit OTP sent to your registered email.</span>
                        <p className="text-[11px] text-violet-300/80 mt-0.5">
                          We sent a verification code to <span className="font-mono text-violet-200 font-semibold">{forgotMaskedEmail}</span>.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5">
                        6-Digit OTP Code
                      </label>
                      <input
                        type="text"
                        id="forgot-otp-input"
                        maxLength={6}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full tracking-widest text-center font-mono text-lg py-2.5 rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                        required
                        autoFocus
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-violet-400">
                      <span>Didn't receive code?</span>
                      <button
                        type="button"
                        id="forgot-resend-otp-btn"
                        onClick={handleForgotResendOtp}
                        disabled={resendCooldown > 0 || loading}
                        className="font-semibold text-violet-300 hover:text-white disabled:opacity-40 cursor-pointer"
                      >
                        {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      id="forgot-step2-submit-btn"
                      disabled={loading || forgotOtp.length < 6}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-sm font-semibold tracking-wide shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 uppercase"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <span>VERIFY OTP</span>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP 3: Set New Password */}
                {forgotStep === 'reset' && (
                  <form onSubmit={handleForgotResetPassword} className="space-y-3.5">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Create New Password</h4>
                      <p className="text-xs text-violet-300/80 mt-0.5 leading-relaxed">
                        OTP verified successfully. Enter your new password for account <span className="font-semibold text-white">{forgotUserId}</span>.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showForgotNewPassword ? 'text' : 'password'}
                          id="forgot-new-password-input"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                          className="absolute right-3 top-3 text-violet-400/50 hover:text-violet-200"
                        >
                          {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider mb-1.5">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showForgotConfirmPassword ? 'text' : 'password'}
                          id="forgot-confirm-password-input"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                          className="absolute right-3 top-3 text-violet-400/50 hover:text-violet-200"
                        >
                          {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="forgot-step3-submit-btn"
                      disabled={loading}
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-sm font-semibold tracking-wide shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 uppercase"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>CHANGE PASSWORD</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Back to Login Link */}
                <div className="pt-3 border-t border-violet-900/30 text-center">
                  <button
                    type="button"
                    id="cancel-forgot-password-btn"
                    onClick={() => {
                      setMode('login');
                      setForgotStep('userId');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-white font-medium transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>
                </div>
              </div>
            )}
          </GlowingEdgeCard>
        </div>
      </div>
    </div>
  );
};
