import React from 'react';
import { AppPage, UserRole } from '../types';
import { Logo } from './Logo';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Users,
  Bell,
  LogOut,
  X,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  activePage: AppPage;
  userRole: UserRole;
  unreadAlertsCount?: number;
  onNavigate: (page: AppPage) => void;
  onLogoutClick: () => void;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activePage,
  userRole,
  unreadAlertsCount = 0,
  onNavigate,
  onLogoutClick,
  onCloseMobile,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Navigation items strictly adhering to Section 14
  const managerItems: { id: AppPage; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'meetings', label: 'Meetings', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'transcripts', label: 'Transcripts', icon: FileText },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ];

  const employeeItems: { id: AppPage; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ];

  const navItems = userRole === 'Manager' ? managerItems : employeeItems;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onCloseMobile}
          className={`fixed inset-0 z-40 lg:hidden transition-opacity ${
            isLight ? 'bg-slate-900/30 backdrop-blur-sm' : 'bg-black/80 backdrop-blur-sm'
          }`}
        />
      )}

      {/* Sidebar container */}
      <aside
        id="meetflow-sidebar"
        className={`
          fixed top-0 bottom-0 left-0 z-40
          flex flex-col justify-between transition-all duration-300 ease-in-out
          ${isLight
            ? 'bg-white text-[#111827] border-r border-[#E5E7EB] shadow-[1px_0_4px_rgba(0,0,0,0.03)]'
            : 'bg-[#08070d]/95 backdrop-blur-xl text-violet-200 border-r border-violet-900/20 shadow-2xl'
          }
          ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
          lg:static lg:h-screen lg:shrink-0 select-none
        `}
      >
        {/* Top Logo branding */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          isLight ? 'border-[#E5E7EB]' : 'border-violet-900/20'
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo size="sm" showText={isOpen} variant="violet" />
          </div>
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className={`p-1.5 rounded-lg lg:hidden cursor-pointer transition ${
              isLight
                ? 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F1F5F9]'
                : 'text-violet-400 hover:text-white hover:bg-violet-800/30'
            }`}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items with Glowing Violet Indicator */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isAlertItem = item.id === 'alerts';

            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative cursor-pointer
                  ${
                    isActive
                      ? isLight
                        ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-[#E0E7FF] shadow-sm'
                        : 'bg-gradient-to-r from-violet-600/30 to-indigo-600/20 text-white font-semibold border border-violet-500/50 shadow-[0_0_20px_rgba(109,93,245,0.3)]'
                      : isLight
                      ? 'text-[#4B5563] hover:bg-[#F8FAFC] hover:text-[#111827] border border-transparent'
                      : 'text-violet-300/70 hover:bg-[#120e24] hover:text-white border border-transparent'
                  }
                `}
                title={!isOpen ? item.label : undefined}
              >
                {/* Active Indicator on left */}
                {isActive && (
                  <div className={`absolute left-0 inset-y-1.5 w-1 rounded-r-full ${
                    isLight ? 'bg-[#4F46E5]' : 'bg-[#8b7cff] shadow-[0_0_10px_#8b7cff]'
                  }`} />
                )}

                <div
                  className={`flex items-center justify-center shrink-0 ${
                    isActive
                      ? isLight
                        ? 'text-[#4F46E5]'
                        : 'text-[#a78bfa]'
                      : isLight
                      ? 'text-[#6B7280] group-hover:text-[#111827]'
                      : 'text-violet-400/80 group-hover:text-violet-200'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2.4 : 1.9} />
                </div>

                {/* Label: shows when open or on mobile */}
                <div
                  className={`flex-1 flex items-center justify-between text-left overflow-hidden whitespace-nowrap transition-opacity ${
                    isOpen ? 'opacity-100' : 'lg:hidden'
                  }`}
                >
                  <span className="truncate">{item.label}</span>

                  {/* Dynamic Alert Count Badge */}
                  {isAlertItem && unreadAlertsCount > 0 && (
                    <span
                      id="sidebar-alert-badge"
                      className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse"
                    >
                      {unreadAlertsCount}
                    </span>
                  )}
                </div>

                {/* Floating dot for closed sidebar when unread alerts exist */}
                {!isOpen && isAlertItem && unreadAlertsCount > 0 && (
                  <div className="hidden lg:block absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Section: Logout Button */}
        <div className={`p-3 border-t ${isLight ? 'border-[#E5E7EB]' : 'border-violet-900/20'}`}>
          <button
            id="sidebar-logout-btn"
            onClick={onLogoutClick}
            className={`
              w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group border border-transparent
              ${
                isLight
                  ? 'text-[#4B5563] hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100'
                  : 'text-violet-400 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-900/40'
              }
            `}
            title={!isOpen ? 'Logout' : undefined}
          >
            <LogOut className={`w-4 h-4 transition-colors ${
              isLight ? 'text-[#6B7280] group-hover:text-rose-600' : 'text-violet-400 group-hover:text-rose-400'
            }`} />
            <span
              className={`overflow-hidden whitespace-nowrap transition-opacity ${
                isOpen ? 'opacity-100' : 'lg:hidden'
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
