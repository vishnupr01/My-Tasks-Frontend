'use client';

import { useState } from 'react';
import { Task, Priority, Status } from '@/types';

interface TaskFormProps {
  initial?: Partial<Task>;
  onSubmit: (data: Partial<Task>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  error?: string;
  submitLabel?: string;
}

const priorityOptions = [
  { value: 'HIGH',   label: 'HIGH',   active: 'bg-red-600 text-white border-red-600',     idle: 'text-red-700 border-red-900/50 hover:border-red-700 hover:text-red-500' },
  { value: 'MEDIUM', label: 'MEDIUM', active: 'bg-yellow-500 text-black border-yellow-500', idle: 'text-yellow-700 border-yellow-900/50 hover:border-yellow-700 hover:text-yellow-500' },
  { value: 'LOW',    label: 'LOW',    active: 'bg-green-500 text-black border-green-500',  idle: 'text-green-700 border-green-900/50 hover:border-green-700 hover:text-green-500' },
];

const statusOptions = [
  { value: 'TODO',        label: 'TODO' },
  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
  { value: 'DONE',        label: 'DONE' },
];

export default function TaskForm({ initial = {}, onSubmit, onCancel, loading, error, submitLabel = 'Save' }: TaskFormProps) {
  const [title, setTitle] = useState(initial.title || '');
  const [description, setDescription] = useState(initial.description || '');
  const [priority, setPriority] = useState<Priority>(initial.priority || 'MEDIUM');
  const [status, setStatus] = useState<Status>(initial.status || 'TODO');
  const [dueDate, setDueDate] = useState(initial.dueDate ? initial.dueDate.slice(0, 10) : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ title, description: description || undefined, priority, status, dueDate: dueDate || undefined });
  };

  const inputCls = "w-full px-3 py-2 bg-black border border-green-900/60 rounded-sm text-green-300 placeholder-green-900 text-sm focus:outline-none focus:border-green-500 focus:shadow-[0_0_6px_rgba(var(--glow-rgb),calc(0.15*var(--glow-mult)))] transition-all font-mono";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-mono">
      <div>
        <label className="block text-xs text-green-800 mb-1">// task.title *</label>
        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="what_needs_to_be_done" />
      </div>

      <div>
        <label className="block text-xs text-green-800 mb-1">// task.description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="additional_details..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-green-800 mb-1">// priority</label>
          <div className="flex flex-col gap-1">
            {priorityOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => setPriority(opt.value as Priority)}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold border transition-all ${priority === opt.value ? opt.active : `bg-black ${opt.idle}`}`}>
                {priority === opt.value ? `[${opt.label}]` : opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-green-800 mb-1">// status</label>
          <div className="flex flex-col gap-1">
            {statusOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => setStatus(opt.value as Status)}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold border transition-all ${
                  status === opt.value
                    ? 'bg-green-500 text-black border-green-500 shadow-[0_0_8px_rgba(var(--glow-rgb),calc(0.3*var(--glow-mult)))]'
                    : 'bg-black text-green-800 border-green-900/50 hover:border-green-700 hover:text-green-500'
                }`}>
                {status === opt.value ? `[${opt.label}]` : opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-green-800 mb-1">// due_date</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-950/20 border border-red-900/50 rounded-sm text-sm text-red-500">
          <span className="text-red-700">[ERR]</span> {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-green-800 border border-green-900/50 rounded-sm hover:border-green-700 hover:text-green-500 transition-colors uppercase tracking-widest">
            cancel
          </button>
        )}
        <button type="submit" disabled={loading}
          className="px-5 py-2 text-xs font-bold bg-green-500 text-black rounded-sm hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] hover:shadow-[0_0_20px_rgba(var(--glow-rgb),calc(0.35*var(--glow-mult)))] transition-all uppercase tracking-widest">
          {loading ? 'saving...' : `> ${submitLabel}`}
        </button>
      </div>
    </form>
  );
}
