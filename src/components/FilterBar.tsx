'use client';

import type { TaskFilters, Priority, Status } from '@/types';

interface FilterBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

const statusOptions: { value: Status | ''; label: string }[] = [
  { value: '', label: 'all' },
  { value: 'TODO', label: 'todo' },
  { value: 'IN_PROGRESS', label: 'active' },
  { value: 'DONE', label: 'done' },
];

const priorityOptions: { value: Priority | ''; label: string }[] = [
  { value: '', label: 'any' },
  { value: 'HIGH', label: 'high' },
  { value: 'MEDIUM', label: 'med' },
  { value: 'LOW', label: 'low' },
];

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
      <div className="flex items-center gap-1 border border-green-900/50 rounded-sm p-1 bg-black">
        <span className="text-green-800 px-1">status:</span>
        {statusOptions.map(opt => {
          const active = (filters.status || '') === opt.value;
          return (
            <button key={opt.value}
              onClick={() => onChange({ ...filters, status: opt.value as Status | '' })}
              className={`px-3 py-1 rounded-sm text-xs transition-all ${
                active
                  ? 'bg-green-500 text-black font-bold shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.3*var(--glow-mult)))]'
                  : 'text-green-700 hover:text-green-400 hover:bg-green-950/40'
              }`}>
              {active ? `[${opt.label}]` : opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border border-green-900/50 rounded-sm p-1 bg-black">
        <span className="text-green-800 px-1">priority:</span>
        {priorityOptions.map(opt => {
          const active = (filters.priority || '') === opt.value;
          return (
            <button key={opt.value}
              onClick={() => onChange({ ...filters, priority: opt.value as Priority | '' })}
              className={`px-3 py-1 rounded-sm text-xs transition-all ${
                active
                  ? 'bg-green-500 text-black font-bold shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.3*var(--glow-mult)))]'
                  : 'text-green-700 hover:text-green-400 hover:bg-green-950/40'
              }`}>
              {active ? `[${opt.label}]` : opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
