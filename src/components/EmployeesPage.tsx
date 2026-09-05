import React, { useState, useEffect, useCallback } from 'react';
import { EmployeeUser, AuthUser, EmployeeRegistrationRequest } from '../types';
import {
  Plus,
  Users,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Briefcase,
  Hash,
  User,
  Search,
  AlertCircle,
  ShieldCheck,
  Clock,
  UserCheck,
  UserX,
  Mail,
} from 'lucide-react';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface EmployeesPageProps {
  user: AuthUser;
  employees: EmployeeUser[];
  onRefreshEmployees: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const EmployeesPage: React.FC<EmployeesPageProps> = ({
  user,
  employees,
  onRefreshEmployees,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'requests'>('roster');
  const [showAddModal, setShowAddModal] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeePost, setEmployeePost] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Registration Requests State
  const [requests, setRequests] = useState<EmployeeRegistrationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const data = await api.getEmployeeRequests();
      setRequests(data);
    } catch {
      // Ignored
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const handleApproveRequest = async (req: EmployeeRegistrationRequest) => {
    try {
      setActioningRequestId(req.id);
      const res = await api.approveEmployeeRequest(req.id);
      onShowToast('Request Approved', res.message, 'success');
      await fetchRequests();
      onRefreshEmployees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve request.';
      onShowToast('Approval Failed', msg, 'warning');
    } finally {
      setActioningRequestId(null);
    }
  };

  const handleDenyRequest = async (req: EmployeeRegistrationRequest) => {
    try {
      setActioningRequestId(req.id);
      const res = await api.denyEmployeeRequest(req.id);
      onShowToast('Request Denied', res.message, 'info');
      await fetchRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deny request.';
      onShowToast('Denial Failed', msg, 'warning');
    } finally {
      setActioningRequestId(null);
    }
  };

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [empToDelete, setEmpToDelete] = useState<EmployeeUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Handle Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim() || !employeeId.trim() || !password) {
      onShowToast('Incomplete Fields', 'Please provide Employee Name, ID, and Password.', 'warning');
      return;
    }

    if (password.length < 4) {
      onShowToast('Weak Password', 'Password must be at least 4 characters long.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await api.addEmployee({
        employeeName: employeeName.trim(),
        employeeId: employeeId.trim(),
        employeePost: employeePost.trim() || 'Team Member',
        password,
      });

      onShowToast('Employee Added', `${employeeName} was registered successfully.`, 'success');
      setShowAddModal(false);
      setEmployeeName('');
      setEmployeeId('');
      setEmployeePost('');
      setPassword('');
      onRefreshEmployees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register employee.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Employee
  const handleConfirmDelete = async () => {
    if (!empToDelete) return;
    try {
      setDeleting(true);
      await api.deleteEmployee(empToDelete.employeeId);
      onShowToast('Employee Removed', `${empToDelete.employeeName} was removed.`, 'info');
      setEmpToDelete(null);
      onRefreshEmployees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete employee.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setDeleting(false);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.employeePost.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="employees-page-root" className="space-y-6 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. PAGE HEADER                                            */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-violet-900/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Employee Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1">
            Registered team members and pending sign-up requests for {user.companyName}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            id="add-employee-btn"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee Directly</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-violet-900/30 pb-2">
        <button
          type="button"
          id="tab-employee-roster"
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-[#6d5df5] text-white shadow-lg shadow-violet-950/50'
              : 'text-violet-300/70 hover:text-white hover:bg-violet-900/20'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Roster</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 text-violet-200">
            {employees.length}
          </span>
        </button>

        <button
          type="button"
          id="tab-employee-requests"
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-[#6d5df5] text-white shadow-lg shadow-violet-950/50'
              : 'text-violet-300/70 hover:text-white hover:bg-violet-900/20'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Join Requests</span>
          {pendingRequests.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              {pendingRequests.length}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 text-violet-200">
              0
            </span>
          )}
        </button>
      </div>

      {activeTab === 'roster' && (
        <>
          {/* 2. SEARCH INPUT */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-violet-400/60" />
            <input
              type="text"
              id="employee-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, employee ID, or designation..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#120e24] border border-violet-900/30 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* 3. EMPLOYEES GRID */}
          {filteredEmployees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEmployees.map((emp) => {
                const isActive = emp.status === 'ACTIVE' || !!emp.lastLogin;

                return (
                  <GlowingEdgeCard
                    key={emp.id || emp.employeeId}
                    tilt={true}
                    glowColor={isActive ? '#8b7cff' : '#4c3a7a'}
                    className="p-5 flex flex-col justify-between shadow-[0_15px_35px_rgba(0,0,0,0.5)]"
                  >
                    <div>
                      {/* Top Bar: Role badge & Status indicator */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-600/20 text-violet-300 border border-violet-500/30">
                          EMPLOYEE
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isActive ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/60 border border-zinc-700/50 text-zinc-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Employee Identity */}
                      <div className="flex items-center gap-3.5 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6d5df5] to-[#4f46e5] border border-violet-400/30 flex items-center justify-center text-white font-bold text-base shadow-sm">
                          {emp.employeeName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-tight">
                            {emp.employeeName}
                          </h3>
                          <p className="text-xs text-violet-300/70">{emp.employeePost}</p>
                        </div>
                      </div>

                      {/* Metadata fields */}
                      <div className="space-y-2 py-3 border-t border-violet-900/30 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-violet-400/80 flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-violet-400" />
                            Employee ID
                          </span>
                          <span className="font-mono text-violet-200 font-semibold">
                            {emp.employeeId}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-violet-400/80 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                            Designation
                          </span>
                          <span className="text-white font-medium truncate max-w-[150px]">
                            {emp.employeePost}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Card Actions */}
                    <div className="pt-3 mt-2 border-t border-violet-900/20 flex items-center justify-between">
                      <span className="text-[10px] text-violet-400/60">
                        {emp.lastLogin ? `Last active: ${new Date(emp.lastLogin).toLocaleDateString()}` : 'Registered'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEmpToDelete(emp)}
                        className="p-1.5 rounded-lg text-violet-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                        title="Remove Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlowingEdgeCard>
                );
              })}
            </div>
          ) : (
            <GlowingEdgeCard glowColor="#6d5df5" className="p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">No employees registered yet</h3>
                <p className="text-xs text-violet-300/60">
                  Register employees so they can be assigned meeting action items and access their personal task dashboard.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] inline-flex items-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Employee</span>
                  </button>
                </div>
              </div>
            </GlowingEdgeCard>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PENDING REGISTRATION REQUESTS                      */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {loadingRequests ? (
            <div className="p-12 flex flex-col items-center justify-center text-violet-400/70 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <span className="text-xs">Loading registration requests...</span>
            </div>
          ) : pendingRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingRequests.map((req) => (
                <GlowingEdgeCard
                  key={req.id}
                  tilt={true}
                  glowColor="#eab308"
                  className="p-5 flex flex-col justify-between shadow-[0_15px_35px_rgba(0,0,0,0.5)] border border-amber-500/20"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        PENDING APPROVAL
                      </span>
                      <span className="text-[10px] text-violet-400/60 font-mono">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Candidate Name & Desired User ID */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/80 to-violet-700 border border-amber-400/30 flex items-center justify-center text-white font-bold text-base shadow-sm">
                        {req.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          {req.name}
                        </h3>
                        <p className="text-xs text-violet-300/80">{req.employeePost || 'Team Member'}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 py-3 border-t border-violet-900/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-violet-400/80 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-violet-400" />
                          Requested User ID
                        </span>
                        <span className="font-mono text-violet-200 font-semibold">
                          {req.userId}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-violet-400/80 flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-violet-400" />
                          Employee ID
                        </span>
                        <span className="font-mono text-white font-semibold">
                          {req.employeeId}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-violet-400/80 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-violet-400" />
                          Personal Email
                        </span>
                        <span className="text-violet-200 font-mono text-[11px] truncate max-w-[150px]" title={req.personalEmail}>
                          {req.personalEmail}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-violet-400/80 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                          Company Email
                        </span>
                        <span className="text-violet-300 font-mono text-[11px] truncate max-w-[150px]" title={req.companyEmail}>
                          {req.companyEmail}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Approve / Deny Action Buttons */}
                  <div className="pt-4 mt-2 border-t border-violet-900/30 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      id={`deny-request-btn-${req.id}`}
                      disabled={actioningRequestId === req.id}
                      onClick={() => handleDenyRequest(req)}
                      className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-400" />
                      <span>Deny</span>
                    </button>

                    <button
                      type="button"
                      id={`approve-request-btn-${req.id}`}
                      disabled={actioningRequestId === req.id}
                      onClick={() => handleApproveRequest(req)}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {actioningRequestId === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Approve</span>
                    </button>
                  </div>
                </GlowingEdgeCard>
              ))}
            </div>
          ) : (
            <GlowingEdgeCard glowColor="#6d5df5" className="p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-emerald-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">No Pending Requests</h3>
                <p className="text-xs text-violet-300/60">
                  All employee registration requests have been reviewed. When new employees submit sign-up requests for {user.companyName}, they will appear here for your review.
                </p>
              </div>
            </GlowingEdgeCard>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ADD EMPLOYEE MODAL                                     */}
      {/* ========================================================= */}
      {showAddModal && (
        <div
          id="add-employee-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <GlowingEdgeCard
            glowColor="#8b7cff"
            className="w-full max-w-md p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Register Employee</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              {/* Employee Name */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-101"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition font-mono"
                  required
                />
              </div>

              {/* Employee Post / Role */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Designation / Post
                </label>
                <input
                  type="text"
                  value={employeePost}
                  onChange={(e) => setEmployeePost(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              {/* Initial Password */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Sign-In Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-violet-400/50 hover:text-violet-200 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-violet-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Register Employee</span>
                  )}
                </button>
              </div>
            </form>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. DELETE CONFIRMATION MODAL                              */}
      {/* ========================================================= */}
      {empToDelete && (
        <div
          id="delete-emp-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <GlowingEdgeCard
            glowColor="#ef4444"
            className="w-full max-w-sm p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Remove Employee?</h3>
            </div>
            <p className="text-xs text-violet-300/70 mb-5 leading-relaxed">
              Are you sure you want to remove <span className="text-white font-medium">{empToDelete.employeeName}</span> ({empToDelete.employeeId})? This will revoke their access to MeetFlow.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEmpToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 border border-violet-900/40 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-emp-btn"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </GlowingEdgeCard>
        </div>
      )}
    </div>
  );
};
