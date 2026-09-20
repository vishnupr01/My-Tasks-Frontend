'use client';

import { useState, useRef, useEffect } from 'react';
import type { Task, SubTask } from '@/types';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Task['status']) => void;
  onSubTaskAdd: (parentId: string, title: string) => Promise<SubTask>;
  onSubTaskToggle: (parentId: string, subId: string) => Promise<void>;
  onSubTaskDelete: (parentId: string, subId: string) => Promise<void>;
}

const priorityConfig: Record<Task['priority'], { border: string; label: string; color: string }> = {
  HIGH:   { border: 'border-l-red-600',    label: 'HIGH',   color: 'text-red-500' },
  MEDIUM: { border: 'border-l-yellow-500', label: 'MED',    color: 'text-yellow-500' },
  LOW:    { border: 'border-l-green-600',  label: 'LOW',    color: 'text-green-600' },
};

const statusConfig: Record<Task['status'], { next: Task['status']; nextLabel: string }> = {
  TODO:        { next: 'IN_PROGRESS', nextLabel: 'start' },
  IN_PROGRESS: { next: 'DONE',        nextLabel: 'done' },
  DONE:        { next: 'TODO',        nextLabel: 'reopen' },
};

export default function TaskCard({ task, onDelete, onStatusChange, onSubTaskAdd, onSubTaskToggle, onSubTaskDelete }: TaskCardProps) {
  const [subTasksOpen, setSubTasksOpen] = useState(false);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [subTaskLoading, setSubTaskLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subTasks = task.subTasks ?? [];
  const doneCount = subTasks.filter(s => s.status === 'DONE').length;
  const total = subTasks.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const isOverdue = task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date();
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];

  useEffect(() => { if (addingSubTask) inputRef.current?.focus(); }, [addingSubTask]);

  const handleAddSubTask = async () => {
    const title = newSubTitle.trim();
    if (!title) return;
    setSubTaskLoading(true);
    try {
      await onSubTaskAdd(task.id, title);
      setNewSubTitle('');
      setAddingSubTask(false);
    } finally { setSubTaskLoading(false); }
  };

  return (
    <div className={`group font-mono bg-black border border-green-900/40 border-l-4 ${priority.border} rounded-sm hover:border-green-700/60 hover:shadow-[0_0_12px_rgba(var(--glow-rgb),calc(0.07*var(--glow-mult)))] transition-all ${task.status === 'DONE' ? 'opacity-40' : ''}`}>
      <div className="p-3 flex flex-col gap-2">

        {/* ID + title */}
        <div className="flex items-start gap-2">
          <span className="text-green-900 text-xs shrink-0 mt-0.5">&gt;</span>
          <h3 className={`flex-1 text-sm leading-snug ${task.status === 'DONE' ? 'line-through text-green-900' : 'text-green-300'}`}>
            {task.title}
          </h3>
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
            <Link href={`/tasks/${task.id}`}
              className="text-green-900 hover:text-green-500 transition-colors text-xs px-1" title="edit">
              [edit]
            </Link>
            <button onClick={() => onDelete(task.id)}
              className="text-green-900 hover:text-red-500 transition-colors text-xs px-1" title="delete">
              [del]
            </button>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-green-800 line-clamp-2 pl-4 border-l border-green-950">{task.description}</p>
        )}

        {/* Sub-tasks progress */}
        {total > 0 && (
          <button onClick={() => setSubTasksOpen(v => !v)} className="flex items-center gap-2 pl-4 text-left w-full">
            <div className="flex-1 h-px bg-green-950 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-green-800 shrink-0 tabular-nums">{doneCount}/{total}</span>
            <span className="text-green-800 text-xs">{subTasksOpen ? '[-]' : '[+]'}</span>
          </button>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2 pl-4">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold ${priority.color}`}>{priority.label}</span>
            {task.dueDate && (
              <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-green-900'}`}>
                {isOverdue ? '!!' : ''}{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setSubTasksOpen(true); setAddingSubTask(true); }}
              className="text-green-900 hover:text-green-500 transition-colors text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100">
              [+sub]
            </button>
            <button onClick={() => onStatusChange(task.id, status.next)}
              className="text-xs px-2 py-0.5 border border-green-800/60 text-green-700 hover:border-green-500 hover:text-green-400 hover:shadow-[0_0_6px_rgba(var(--glow-rgb),calc(0.15*var(--glow-mult)))] rounded-sm transition-all">
              &gt; {status.nextLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tasks panel */}
      {(subTasksOpen || addingSubTask) && (
        <div className="border-t border-green-950 px-3 pb-2.5 pt-2 flex flex-col gap-1.5">
          {subTasks.map(sub => (
            <div key={sub.id} className="flex items-center gap-2 group/sub pl-4">
              <button onClick={() => onSubTaskToggle(task.id, sub.id)}
                className={`text-xs shrink-0 transition-colors ${sub.status === 'DONE' ? 'text-green-500' : 'text-green-900 hover:text-green-500'}`}>
                {sub.status === 'DONE' ? '[x]' : '[ ]'}
              </button>
              <span className={`flex-1 text-xs ${sub.status === 'DONE' ? 'line-through text-green-900' : 'text-green-600'}`}>
                {sub.title}
              </span>
              <button onClick={() => onSubTaskDelete(task.id, sub.id)}
                className="text-green-950 hover:text-red-600 text-xs opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 transition-all">
                [x]
              </button>
            </div>
          ))}

          {addingSubTask ? (
            <div className="flex items-center gap-2 pl-4 mt-1">
              <span className="text-green-800 text-xs shrink-0">+</span>
              <input ref={inputRef} value={newSubTitle} onChange={e => setNewSubTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubTask(); if (e.key === 'Escape') { setAddingSubTask(false); setNewSubTitle(''); } }}
                placeholder="sub_task_title..."
                className="flex-1 text-xs bg-black border-b border-green-900 text-green-300 placeholder-green-900 outline-none focus:border-green-500 font-mono py-0.5"
                disabled={subTaskLoading} />
              <button onClick={handleAddSubTask} disabled={!newSubTitle.trim() || subTaskLoading}
                className="text-xs text-green-700 hover:text-green-400 disabled:opacity-30 transition-colors">[add]</button>
              <button onClick={() => { setAddingSubTask(false); setNewSubTitle(''); }}
                className="text-xs text-green-900 hover:text-green-600">[esc]</button>
            </div>
          ) : (
            <button onClick={() => setAddingSubTask(true)}
              className="pl-4 text-left text-xs text-green-900 hover:text-green-600 transition-colors mt-0.5">
              + add_subtask
            </button>
          )}
        </div>
      )}
    </div>
  );
}
