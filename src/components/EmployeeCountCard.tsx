import React from 'react';

interface EmployeeCountCardProps {
  onAddEmployeeClick?: () => void;
}

export const EmployeeCountCard: React.FC<EmployeeCountCardProps> = ({ onAddEmployeeClick }) => {
  return (
    <div
      id="employee-count-card"
      onClick={onAddEmployeeClick}
      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center h-full group cursor-pointer hover:border-slate-300 transition-colors"
      title="Click to manage employees"
    >
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-6 tracking-wider self-start">
        Total Employees
      </h3>
      <div className="text-6xl font-black text-slate-900 mb-2">0</div>
      <p className="text-xs text-slate-400">Team members registered</p>
    </div>
  );
};
