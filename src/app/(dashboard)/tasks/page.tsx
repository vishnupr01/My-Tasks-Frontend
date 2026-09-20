'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Task, TaskFilters, StreakData, SubTask } from '@/types';
import { tasks as tasksApi } from '@/lib/api';
import { removeToken, isAuthenticated } from '@/lib/auth';
import TaskCard from '@/components/TaskCard';
import TaskForm from '@/components/TaskForm';
import FilterBar from '@/components/FilterBar';
import SearchBar from '@/components/SearchBar';
import ConfirmModal from '@/components/ConfirmModal';
import StreakCalendar from '@/components/StreakCalendar';
import { FlameIcon } from '@/components/Icons';

const columns = [
  { key: 'TODO' as Task['status'],        label: 'TODO',        prefix: '01', border: 'border-green-900/30', bg: 'bg-black' },
  { key: 'IN_PROGRESS' as Task['status'], label: 'IN_PROGRESS', prefix: '02', border: 'border-yellow-900/30', bg: 'bg-yellow-950/5' },
  { key: 'DONE' as Task['status'],        label: 'DONE',        prefix: '03', border: 'border-green-800/30', bg: 'bg-green-950/10' },
];

export default function TasksPage() {
  const router = useRouter();
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, calendar: {} });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(true);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try { setTaskList(await tasksApi.list(filters, debouncedSearch || undefined)); }
    catch { /* api handles 401 */ } finally { setLoading(false); }
  }, [filters, debouncedSearch]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const fetchStreak = useCallback(async () => {
    try { setStreak(await tasksApi.streak()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStreak(); }, [fetchStreak]);

  const handleCreate = async (data: Partial<Task>) => {
    setCreateError('');
    setCreateLoading(true);
    try {
      const task = await tasksApi.create(data);
      setTaskList(prev => [task, ...prev]);
      setShowCreateModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create task');
    } finally { setCreateLoading(false); }
  };

  const handleDelete = (id: string) => setConfirmDelete(id);

  const executeDelete = async () => {
    if (!confirmDelete) return;
    await tasksApi.delete(confirmDelete);
    setTaskList(prev => prev.filter(t => t.id !== confirmDelete));
    setConfirmDelete(null);
  };

  const handleStatusChange = async (id: string, status: Task['status']) => {
    const updated = await tasksApi.update(id, { status });
    setTaskList(prev => prev.map(t => t.id === id ? updated : t));
    fetchStreak();
  };

  const handleSubTaskAdd = async (parentId: string, title: string): Promise<SubTask> => {
    const sub = await tasksApi.addSubTask(parentId, title);
    setTaskList(prev => prev.map(t => t.id === parentId ? { ...t, subTasks: [...(t.subTasks ?? []), sub] } : t));
    return sub;
  };

  const handleSubTaskToggle = async (parentId: string, subId: string) => {
    const updated = await tasksApi.toggleSubTask(parentId, subId);
    setTaskList(prev => prev.map(t =>
      t.id === parentId ? { ...t, subTasks: (t.subTasks ?? []).map(s => s.id === subId ? updated : s) } : t
    ));
    fetchStreak();
  };

  const handleSubTaskDelete = async (parentId: string, subId: string) => {
    await tasksApi.deleteSubTask(parentId, subId);
    setTaskList(prev => prev.map(t =>
      t.id === parentId ? { ...t, subTasks: (t.subTasks ?? []).filter(s => s.id !== subId) } : t
    ));
  };

  const handleLogout = () => { removeToken(); router.push('/login'); };

  const total = taskList.length;
  const todo = taskList.filter(t => t.status === 'TODO');
  const inProgress = taskList.filter(t => t.status === 'IN_PROGRESS');
  const done = taskList.filter(t => t.status === 'DONE');
  const highPriority = taskList.filter(t => t.priority === 'HIGH' && t.status !== 'DONE');

  return (
    <div className="min-h-screen bg-black font-mono">
      {/* Header / navbar */}
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-green-400 font-bold tracking-widest text-sm">MY_TASKS</span>
            <span className="text-green-900 text-xs hidden sm:inline ml-2">// personal task manager</span>
          </div>

          {/* Streak */}
          <div className="hidden sm:flex items-center gap-3 border border-green-900/50 rounded-sm px-3 py-1.5 text-xs">
            <span className="text-yellow-500"><FlameIcon /></span>
            <div className="flex items-baseline gap-1">
              <span className="text-green-400 font-bold text-base">{streak.current}</span>
              <span className="text-green-800">day_streak</span>
            </div>
            <span className="text-green-900 border-l border-green-900/40 pl-3">best:{streak.best}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreateModal(true)}
              className="text-xs font-bold px-4 py-1.5 bg-green-500 text-black rounded-sm hover:bg-green-400 transition-colors shadow-[0_0_12px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] hover:shadow-[0_0_20px_rgba(var(--glow-rgb),calc(0.35*var(--glow-mult)))] uppercase tracking-widest">
              + new_task
            </button>
            <button onClick={handleLogout}
              className="text-xs text-green-800 hover:text-green-500 transition-colors border border-green-900/40 hover:border-green-700 px-3 py-1.5 rounded-sm">
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: 'TOTAL',  value: total,              valueColor: 'text-green-400',  borderColor: 'border-green-900/50',  labelColor: 'text-green-800' },
            { label: 'TODO',   value: todo.length,        valueColor: 'text-green-600',  borderColor: 'border-green-900/40',  labelColor: 'text-green-900' },
            { label: 'ACTIVE', value: inProgress.length,  valueColor: 'text-yellow-400', borderColor: 'border-yellow-900/40', labelColor: 'text-yellow-900' },
            { label: 'DONE',   value: done.length,        valueColor: 'text-green-400',  borderColor: 'border-green-800/50',  labelColor: 'text-green-800' },
            { label: '!HIGH',  value: highPriority.length, valueColor: highPriority.length > 0 ? 'text-red-400' : 'text-green-900', borderColor: highPriority.length > 0 ? 'border-red-900/50' : 'border-green-900/30', labelColor: highPriority.length > 0 ? 'text-red-800' : 'text-green-900' },
          ].map(s => (
            <div key={s.label} className={`border ${s.borderColor} rounded-sm bg-black p-3 flex flex-col gap-1`}>
              <span className={`text-xs tracking-widest ${s.labelColor}`}>{s.label}</span>
              <span className={`text-2xl font-bold tabular-nums leading-none ${s.valueColor}`}>
                {String(s.value).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>

        {/* Streak calendar */}
        <div className="border border-green-900/40 rounded-sm bg-black overflow-hidden">
          <button
            onClick={() => setShowCalendar(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-green-950/10 hover:bg-green-950/20 transition-colors text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="text-green-500">$</span>
              <span className="text-green-700 tracking-widest">streak.calendar</span>
              <span className="text-yellow-500"><FlameIcon /></span>
              <span className="text-green-400 font-bold">{streak.current}</span>
              <span className="text-green-800">day streak</span>
              <span className="text-green-900">|</span>
              <span className="text-green-800">best: <span className="text-green-600">{streak.best}</span></span>
            </div>
            <span className="text-green-800">{showCalendar ? '[-]' : '[+]'}</span>
          </button>
          {showCalendar && (
            <div className="px-4 pb-4 pt-3">
              <StreakCalendar calendar={streak.calendar} />
              <div className="flex items-center gap-2 mt-3 text-[10px] text-green-900">
                <span>less</span>
                {[0, 1, 2, 4, 7].map(n => (
                  <div key={n} className={`w-3 h-3 border rounded-[2px] ${
                    n === 0 ? 'bg-[rgb(var(--heat-0-bg))] border-[rgb(var(--heat-0-bd))]'
                    : n === 1 ? 'bg-[rgb(var(--heat-1-bg))] border-[rgb(var(--heat-1-bd))]'
                    : n === 2 ? 'bg-[rgb(var(--heat-2-bg))] border-[rgb(var(--heat-2-bd))]'
                    : n === 4 ? 'bg-[rgb(var(--heat-3-bg))] border-[rgb(var(--heat-3-bd))]'
                    : 'bg-[rgb(var(--heat-4-bg))] border-[rgb(var(--heat-4-bd))]'
                  }`} />
                ))}
                <span>more</span>
              </div>
            </div>
          )}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-64"><SearchBar value={search} onChange={setSearch} /></div>
          <div className="flex-1"><FilterBar filters={filters} onChange={setFilters} /></div>
        </div>

        {/* Board */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <div className="w-8 h-8 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
            <p className="text-sm text-green-800">loading tasks...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map(col => {
              const items = taskList.filter(t => t.status === col.key);
              return (
                <div key={col.key} className={`border ${col.border} ${col.bg} rounded-sm`}>
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/30">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-900">{col.prefix}.</span>
                      <span className="text-green-600 font-bold tracking-wider">{col.label}</span>
                    </div>
                    <span className="text-xs text-green-900 border border-green-900/40 px-1.5 py-0.5">{items.length}</span>
                  </div>

                  <div className="p-2 space-y-2">
                    {items.map(task => (
                      <TaskCard key={task.id} task={task}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                        onSubTaskAdd={handleSubTaskAdd}
                        onSubTaskToggle={handleSubTaskToggle}
                        onSubTaskDelete={handleSubTaskDelete}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="py-8 text-center text-xs text-green-950">
                        {search ? '// no matches' : '// empty'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && taskList.length === 0 && !search && (
          <div className="text-center py-16 border border-green-950 rounded-sm">
            <p className="text-green-800 text-sm mb-1">// no tasks found</p>
            <p className="text-green-900 text-xs mb-5">create your first task to get started</p>
            <button onClick={() => setShowCreateModal(true)}
              className="text-xs font-bold px-5 py-2 bg-green-500 text-black rounded-sm hover:bg-green-400 shadow-[0_0_12px_rgba(var(--glow-rgb),calc(0.2*var(--glow-mult)))] uppercase tracking-widest transition-colors">
              + new_task
            </button>
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="bg-black border border-green-900/60 rounded-sm shadow-[0_0_40px_rgba(var(--glow-rgb),calc(0.08*var(--glow-mult)))] w-full max-w-md">
            {/* Modal title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/40 bg-green-950/10">
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-xs">$</span>
                <span className="text-green-600 text-xs font-bold tracking-widest">taskflow --create</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-green-900 hover:text-green-500 text-xs transition-colors">
                [esc]
              </button>
            </div>
            <div className="p-4">
              <TaskForm onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)}
                loading={createLoading} error={createError} submitLabel="create_task" />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <ConfirmModal
          message="delete this task?"
          subtext="all sub-tasks will also be removed permanently."
          confirmLabel="delete"
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
