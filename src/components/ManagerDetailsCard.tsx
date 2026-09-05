import React from 'react';

export const ManagerDetailsCard: React.FC = () => {
  const details = [
    { label: 'Manager Name', value: '—' },
    { label: 'Manager ID', value: '—' },
    { label: 'Company Email', value: '—' },
  ];

  return (
    <div
      id="manager-details-card"
      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full"
    >
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">
          Manager Details
        </h3>
        <div className="space-y-3">
          {details.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="font-medium text-slate-700 text-sm mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-6">
        <span className="text-xs font-medium text-slate-400">Role</span>
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
          Manager
        </span>
      </div>
    </div>
  );
};
