import React, { useState } from 'react';
import { TaskItem, EmployeeUser, AuthUser, TaskStatus } from '../types';
import {
  Plus,
  Check,
  X,
  Edit2,
  Trash2,
  CheckSquare,
  AlertCircle,
  Clock3,
  Calendar,
  User,
  Loader2,
  Filter,
  Search,
  Briefcase,
  Hash,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface TasksPageProps {
  user: AuthUser;
  tasks: TaskItem[];
  employees: EmployeeUser[];
  onRefreshTasks: () => void;
  onShowToast: (title: string, description?: string, type?: 'info' | 'warning' | 'success') => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  user,
  tasks,
  employees,
  onRefreshTasks,
  onShowToast,
}) => {
  const isManager = user.role === 'Manager';

  // Add Task Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState('');
  const [taskStatus, setTaskStatus] = useState<'Pending' | 'In Progress' | 'Completed'>('Pending');
  const [savingTask, setSavingTask] = useState(false);

  // Edit Task Modal State (Full Manager Control)
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignedDate, setEditAssignedDate] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('Pending');
  const [updatingTask, setUpdatingTask] = useState(false);

  // Delete Task Modal State
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Find currently selected employee details for Add Modal
  const activeAddEmployee = employees.find((e) => e.employeeId === selectedEmployeeId);

  // Find currently selected employee details for Edit Modal
  const activeEditEmployee = employees.find((e) => e.employeeId === editEmployeeId);

  // Open Edit Task Modal with existing task data
  const handleOpenEditModal = (task: TaskItem) => {
    setTaskToEdit(task);
    setEditEmployeeId(task.employeeId);
    setEditSubject(task.subject);
    setEditDescription(task.description || '');
    setEditAssignedDate(task.assignedDate);
    setEditDeadline(task.deadline);
    setEditStatus(task.status);
  };

  // Handle Create Task (Manager)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !subject.trim() || !assignedDate || !deadline) {
      onShowToast('Incomplete Fields', 'Please complete all required fields.', 'warning');
      return;
    }

    if (deadline < assignedDate) {
      onShowToast('Invalid Deadline', 'Deadline cannot be earlier than assigned date.', 'warning');
      return;
    }

    try {
      setSavingTask(true);
      await api.addTask({
        employeeId: selectedEmployeeId,
        subject: subject.trim(),
        description: description.trim() || undefined,
        assignedDate,
        deadline,
        status: taskStatus,
      });

      onShowToast('Task Created', 'Task successfully assigned to employee.', 'success');
      setShowAddModal(false);
      setSubject('');
      setDescription('');
      setDeadline('');
      setSelectedEmployeeId('');
      setTaskStatus('Pending');
      onRefreshTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setSavingTask(false);
    }
  };

  // Handle Save Task Edit (Manager Full Control)
  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToEdit) return;

    if (!editEmployeeId || !editSubject.trim() || !editAssignedDate || !editDeadline) {
      onShowToast('Incomplete Fields', 'Please complete all required fields.', 'warning');
      return;
    }

    if (editDeadline < editAssignedDate) {
      onShowToast('Invalid Deadline', 'Deadline cannot be earlier than assigned date.', 'warning');
      return;
    }

    try {
      setUpdatingTask(true);
      await api.updateTask(taskToEdit.id, {
        employeeId: editEmployeeId,
        subject: editSubject.trim(),
        description: editDescription.trim(),
        assignedDate: editAssignedDate,
        deadline: editDeadline,
        status: editStatus,
      });

      onShowToast('Task Updated', 'All task changes saved successfully.', 'success');
      setTaskToEdit(null);
      onRefreshTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setUpdatingTask(false);
    }
  };

  // Handle Employee Status Change
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      onShowToast('Status Updated', `Task status set to ${newStatus}.`, 'success');
      onRefreshTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change status.';
      onShowToast('Error', msg, 'warning');
    }
  };

  // Handle Delete Task (Manager)
  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      setDeletingTask(true);
      await api.deleteTask(taskToDelete.id);
      onShowToast('Task Deleted', 'The task was permanently removed.', 'info');
      setTaskToDelete(null);
      onRefreshTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task.';
      onShowToast('Error', msg, 'warning');
    } finally {
      setDeletingTask(false);
    }
  };

  // Filter tasks (Scoped strictly to user's company and employee permissions)
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.employeeId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' ? true : t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="tasks-page-root" className="space-y-6 max-w-7xl mx-auto text-white">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & ADD TASK BUTTON                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-violet-900/20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Tasks</span>
          </h1>
          <p className="text-xs sm:text-sm text-violet-300/70 mt-1">
            {isManager
              ? `Manage deliverables, assign deadlines, and track execution across ${user.companyName}.`
              : 'Review your assigned tasks, update work status, and monitor upcoming deadlines.'}
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            id="open-add-task-modal-btn"
            onClick={() => {
              if (employees.length === 0) {
                onShowToast(
                  'No Employees Registered',
                  'Please register at least one employee before creating tasks.',
                  'warning'
                );
                return;
              }
              setSelectedEmployeeId(employees[0].employeeId);
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>ADD TASK</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. SEARCH & FILTER CONTROLS                               */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-violet-400/60" />
          <input
            type="text"
            id="task-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isManager
                ? 'Search by subject, description, employee name, or ID...'
                : 'Search your assigned tasks by subject or description...'
            }
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#120e24] border border-violet-900/30 text-white placeholder:text-violet-400/40 focus:outline-none focus:border-violet-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-violet-400" />
          <select
            id="task-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#120e24] border border-violet-900/30 text-violet-200 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. TASKS DATA TABLE (PREMIUM GLASS TABLE)                 */}
      {/* ========================================================= */}
      <GlowingEdgeCard glowColor="#8b7cff" className="overflow-hidden">
        {filteredTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table id="tasks-data-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-violet-900/40 bg-[#0e0a1c]/90 text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Employee Name</th>
                  <th className="py-3.5 px-4">Employee Post</th>
                  <th className="py-3.5 px-4 min-w-[240px]">Task Subject & Details</th>
                  <th className="py-3.5 px-4">Assigned Date</th>
                  <th className="py-3.5 px-4">Deadline</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-900/20">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    id={`task-row-${task.id}`}
                    className="hover:bg-violet-950/20 transition-colors group"
                  >
                    {/* Employee ID */}
                    <td className="py-3.5 px-4 font-mono font-medium text-violet-300">
                      {task.employeeId}
                    </td>

                    {/* Employee Name */}
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {task.employeeName}
                    </td>

                    {/* Employee Post */}
                    <td className="py-3.5 px-4 text-violet-300/80">
                      {task.employeePost}
                    </td>

                    {/* Task Subject & Optional Description */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white/95 leading-snug">
                        {task.subject}
                      </div>
                      {task.description && (
                        <div className="text-[11px] text-violet-300/60 mt-1 line-clamp-2 leading-relaxed">
                          {task.description}
                        </div>
                      )}
                    </td>

                    {/* Assigned Date */}
                    <td className="py-3.5 px-4 font-mono text-violet-400">
                      {task.assignedDate}
                    </td>

                    {/* Deadline */}
                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={`${
                          task.status === 'Overdue'
                            ? 'text-rose-400 font-bold'
                            : 'text-violet-200'
                        }`}
                      >
                        {task.deadline}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          task.status === 'Completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : task.status === 'Overdue'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : task.status === 'Pending'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isManager ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manager: Edit Task (Full Control Modal) */}
                          <button
                            type="button"
                            id={`edit-task-btn-${task.id}`}
                            onClick={() => handleOpenEditModal(task)}
                            className="p-1.5 rounded-lg text-violet-400 hover:text-white hover:bg-violet-800/30 transition cursor-pointer"
                            title="Edit Task (All Fields)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Manager: Delete Task */}
                          <button
                            type="button"
                            id={`delete-task-btn-${task.id}`}
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        /* Employee: ONLY Status Dropdown (Pending, In Progress, Completed) */
                        <div className="flex items-center justify-end">
                          <select
                            id={`employee-status-select-${task.id}`}
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-[#120e24] border border-violet-900/40 text-violet-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center mx-auto text-violet-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No tasks found</h3>
            <p className="text-xs text-violet-300/60 max-w-sm mx-auto">
              {isManager
                ? 'Tasks assigned directly or extracted from meeting transcripts will appear here.'
                : 'No tasks have been delegated to your account yet.'}
            </p>
            {isManager && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (employees.length === 0) {
                      onShowToast(
                        'No Employees Registered',
                        'Please register an employee before creating tasks.',
                        'warning'
                      );
                      return;
                    }
                    setSelectedEmployeeId(employees[0].employeeId);
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#6d5df5] hover:bg-[#7e70ff] text-white text-xs font-semibold shadow-[0_0_20px_rgba(109,93,245,0.4)] inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Task</span>
                </button>
              </div>
            )}
          </div>
        )}
      </GlowingEdgeCard>

      {/* ========================================================= */}
      {/* 4. "ADD TASK" MODAL (MANAGER ONLY)                        */}
      {/* All 8 fields with auto-updating employee ID & post        */}
      {/* ========================================================= */}
      {showAddModal && (
        <div
          id="add-task-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <GlowingEdgeCard
            glowColor="#8b7cff"
            className="w-full max-w-lg p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] my-8"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Assign New Task</h3>
                  <p className="text-[11px] text-violet-300/60">
                    Assign a task to a registered employee in {user.companyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              {/* 1. Employee Name dropdown (Registered Employees of this company) */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Select Employee
                </label>
                <select
                  id="add-task-employee-select"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId} className="bg-[#121020]">
                      {emp.employeeName} ({emp.employeeId}) — {emp.employeePost}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2 & 3. Automatically Linked Employee ID & Post Preview */}
              {activeAddEmployee && (
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-violet-950/20 border border-violet-900/30">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-violet-400 block mb-0.5">
                      Employee ID
                    </span>
                    <span className="text-xs font-mono font-semibold text-white">
                      {activeAddEmployee.employeeId}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-violet-400 block mb-0.5">
                      Employee Post
                    </span>
                    <span className="text-xs font-medium text-white truncate block">
                      {activeAddEmployee.employeePost}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. Task Subject */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Task Subject
                </label>
                <input
                  type="text"
                  id="add-task-subject-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E.g. Finalize Q3 system performance audit..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              {/* 5. Task Description */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Task Description (Optional)
                </label>
                <textarea
                  id="add-task-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add detailed instructions, deliverable requirements, or acceptance criteria..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white placeholder:text-violet-400/30 focus:outline-none focus:border-violet-500 transition resize-none"
                />
              </div>

              {/* 6 & 7. Assigned Date & Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Assigned Date
                  </label>
                  <input
                    type="date"
                    id="add-task-assigned-date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Deadline
                  </label>
                  <input
                    type="date"
                    id="add-task-deadline"
                    value={deadline}
                    min={assignedDate}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* 8. Initial Status */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Initial Status
                </label>
                <select
                  id="add-task-status"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Modal Buttons: Green "Create Task" / Red "Cancel" */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-violet-900/30">
                <button
                  type="button"
                  id="cancel-add-task-btn"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="submit-add-task-btn"
                  disabled={savingTask}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {savingTask ? (
                    <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Task</span>
                  )}
                </button>
              </div>
            </form>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. "EDIT TASK" MODAL (MANAGER ONLY — ALL 8 FIELDS)        */}
      {/* Automatically links Employee ID and Post upon selection   */}
      {/* ========================================================= */}
      {taskToEdit && (
        <div
          id="edit-task-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <GlowingEdgeCard
            glowColor="#8b7cff"
            className="w-full max-w-lg p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] my-8"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Edit Task Details</h3>
                  <p className="text-[11px] text-violet-300/60">
                    Full task control: reassign employee, adjust deadline, or modify details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskToEdit(null)}
                className="p-1 rounded-lg text-violet-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTask} className="space-y-4">
              {/* 1. Employee Name dropdown (Registered Employees of this company) */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Assigned Employee
                </label>
                <select
                  id="edit-task-employee-select"
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId} className="bg-[#121020]">
                      {emp.employeeName} ({emp.employeeId}) — {emp.employeePost}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2 & 3. Automatically Linked Employee ID & Post */}
              {activeEditEmployee && (
                <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-violet-950/20 border border-violet-900/30">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-violet-400 block mb-0.5">
                      Employee ID
                    </span>
                    <span className="text-xs font-mono font-semibold text-white">
                      {activeEditEmployee.employeeId}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-violet-400 block mb-0.5">
                      Employee Post
                    </span>
                    <span className="text-xs font-medium text-white truncate block">
                      {activeEditEmployee.employeePost}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. Task Subject */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Task Subject
                </label>
                <input
                  type="text"
                  id="edit-task-subject-input"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Task subject..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              {/* 5. Task Description */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Task Description
                </label>
                <textarea
                  id="edit-task-description-input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detailed task description..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 transition resize-none"
                />
              </div>

              {/* 6 & 7. Assigned Date & Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Assigned Date
                  </label>
                  <input
                    type="date"
                    id="edit-task-assigned-date"
                    value={editAssignedDate}
                    onChange={(e) => setEditAssignedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                    Deadline
                  </label>
                  <input
                    type="date"
                    id="edit-task-deadline"
                    value={editDeadline}
                    min={editAssignedDate}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* 8. Status */}
              <div>
                <label className="block text-[11px] font-semibold text-violet-200 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  id="edit-task-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#121020] border border-violet-900/40 text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Modal Buttons: Green "Save Changes" / Red "Cancel" */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-violet-900/30">
                <button
                  type="button"
                  id="cancel-edit-task-btn"
                  onClick={() => setTaskToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="submit-edit-task-btn"
                  disabled={updatingTask}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {updatingTask ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </GlowingEdgeCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. DELETE CONFIRMATION MODAL                              */}
      {/* ========================================================= */}
      {taskToDelete && (
        <div
          id="delete-task-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <GlowingEdgeCard
            glowColor="#ef4444"
            className="w-full max-w-sm p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Task?</h3>
            </div>
            <p className="text-xs text-violet-300/70 mb-5 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-medium">"{taskToDelete.subject}"</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 border border-violet-900/40 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-task-btn"
                disabled={deletingTask}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {deletingTask ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </GlowingEdgeCard>
        </div>
      )}
    </div>
  );
};
