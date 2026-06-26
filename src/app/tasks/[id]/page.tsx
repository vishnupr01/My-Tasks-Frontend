'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TaskForm from '@/components/TaskForm';
import { tasks as tasksApi } from '@/lib/api';
import { Task } from '@/types';

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    tasksApi.get(id)
      .then(setTask)
      .catch(() => router.replace('/tasks'))
      .finally(() => setLoadingTask(false));
  }, [id, router]);

  const handleUpdate = async (data: Partial<Task>) => {
    setError('');
    setSaving(true);
    try {
      await tasksApi.update(id, data);
      router.push('/tasks');
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  if (loadingTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-black font-mono">
        <div className="w-8 h-8 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
        <p className="text-sm text-green-800">loading task...</p>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="min-h-screen bg-black font-mono">
      {/* Header */}
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/tasks"
            className="text-green-800 hover:text-green-400 text-xs border border-green-900/40 hover:border-green-700 px-2 py-1 rounded-sm transition-colors">
            &lt; back
          </Link>
          <span className="text-green-900 text-xs">|</span>
          <span className="text-green-500 text-xs">$</span>
          <span className="text-green-600 text-xs font-bold tracking-widest">taskflow --edit</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Task meta */}
        <div className="border border-green-900/40 rounded-sm mb-4 bg-black overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-900/30 bg-green-950/10">
            <span className="text-green-700 text-xs">&gt;</span>
            <h2 className="text-green-300 text-sm font-bold truncate">{task.title}</h2>
          </div>
          <div className="px-4 py-2 flex items-center gap-4 text-xs">
            <span className="text-green-900">id:<span className="text-green-800 ml-1">{task.id.slice(0, 8)}...</span></span>
            <span className="text-green-900">created:<span className="text-green-800 ml-1">{new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
            <span className={`ml-auto font-bold ${task.priority === 'HIGH' ? 'text-red-500' : task.priority === 'MEDIUM' ? 'text-yellow-500' : 'text-green-600'}`}>
              {task.priority}
            </span>
          </div>
        </div>

        {/* Form */}
        <div className="border border-green-900/40 rounded-sm bg-black overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-900/30 bg-green-950/10">
            <span className="text-green-500 text-xs">$</span>
            <span className="text-green-700 text-xs tracking-widest">modify_task --id={task.id.slice(0, 6)}</span>
          </div>
          <div className="p-5">
            <TaskForm
              initial={task}
              onSubmit={handleUpdate}
              onCancel={() => router.push('/tasks')}
              loading={saving}
              error={error}
              submitLabel="save_changes"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
