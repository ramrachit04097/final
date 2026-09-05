import React from 'react';
import { Menu, LogOut, Building2, UserCircle2, Sun, Moon } from 'lucide-react';
import { AuthUser } from '../types';
import { Logo } from './Logo';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  user: AuthUser;
  onToggleSidebar: () => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onToggleSidebar,
  onLogoutClick,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <header
      id="meetflow-app-header"
      className={`h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none transition-colors duration-200 ${
        isLight
          ? 'bg-white border-b border-[#E5E7EB] text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
          : 'bg-[#08070d]/90 backdrop-blur-xl border-b border-violet-900/20 text-white'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Toggle Sidebar Button */}
        <button
          id="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          className={`p-2 rounded-xl transition focus:outline-none cursor-pointer ${
            isLight
              ? 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F8FAFC]'
              : 'text-violet-300 hover:text-white hover:bg-violet-900/30'
          }`}
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* MeetFlow Logo on mobile / compact view */}
        <div className="lg:hidden">
          <Logo size="sm" showText={false} variant="violet" />
        </div>

        <div className={`hidden sm:block h-5 w-px ${isLight ? 'bg-[#E5E7EB]' : 'bg-violet-900/40'}`} />

        {/* Workspace Name (Registered Company from Database) */}
        <div id="company-name-area" className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
            isLight
              ? 'bg-indigo-50/80 border-indigo-100 text-[#4F46E5]'
              : 'bg-violet-900/30 border-violet-700/30 text-violet-300'
          }`}>
            <Building2 className={`w-3.5 h-3.5 ${isLight ? 'text-[#4F46E5]' : 'text-violet-400'}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm sm:text-base tracking-tight truncate max-w-[160px] sm:max-w-[280px] ${
              isLight ? 'text-[#111827]' : 'text-white'
            }`}>
              {user.companyName}
            </span>
            <span className={`hidden md:inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${
              isLight
                ? 'bg-indigo-50 text-[#4F46E5] border-indigo-100'
                : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
            }`}>
              Workspace
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Theme Toggle Button (Top-right of the application interface) */}
        <button
          type="button"
          id="theme-toggle-btn"
          onClick={toggleTheme}
          className={`p-2 rounded-xl border transition cursor-pointer focus:outline-none flex items-center justify-center ${
            isLight
              ? 'border-[#E5E7EB] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#4B5563] hover:text-[#111827]'
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

        {/* Live User Role & Identity */}
        <div id="user-role-badge" className="text-right hidden sm:block">
          <p className={`text-xs font-semibold leading-tight ${isLight ? 'text-[#111827]' : 'text-white'}`}>
            {user.name}
          </p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.2 rounded-full border ${
                isLight
                  ? user.role === 'Manager'
                    ? 'bg-indigo-50 border-indigo-200 text-[#4F46E5]'
                    : 'bg-violet-50 border-violet-200 text-[#7C3AED]'
                  : user.role === 'Manager'
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_10px_rgba(109,93,245,0.2)]'
                  : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
              }`}
            >
              {user.role}
            </span>
            {user.post && (
              <span className={`text-[10px] truncate max-w-[120px] ${isLight ? 'text-[#6B7280]' : 'text-violet-400/80'}`}>
                • {user.post}
              </span>
            )}
          </div>
        </div>

        {/* User Avatar */}
        <div
          id="user-avatar-circle"
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4F46E5] border border-indigo-200/60 flex items-center justify-center text-white text-xs font-bold shadow-sm"
          title={`${user.name} (${user.role})`}
        >
          {user.name ? user.name.charAt(0).toUpperCase() : <UserCircle2 className="w-4 h-4" />}
        </div>

        <div className={`hidden sm:block h-5 w-px ${isLight ? 'bg-[#E5E7EB]' : 'bg-violet-900/40'}`} />

        {/* Logout Button */}
        <button
          id="header-logout-btn"
          onClick={onLogoutClick}
          className={`text-xs px-2.5 py-1.5 rounded-xl transition flex items-center gap-1.5 border border-transparent cursor-pointer ${
            isLight
              ? 'text-[#4B5563] hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100'
              : 'text-violet-300 hover:text-white hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/40'
          }`}
          title="Sign out of MeetFlow"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
