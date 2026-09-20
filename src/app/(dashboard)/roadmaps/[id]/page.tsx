'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { roadmaps as roadmapsApi } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import { RefreshIcon } from '@/components/Icons';
import type { RoadmapDetail } from '@/types';

function Bar({ percent, colorClass }: { percent: number; colorClass: string }) {
  return (
    <div className="w-full h-1.5 bg-green-950/40 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} transition-all duration-300`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function RoadmapDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roadmapId = params.id as string;

  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);
  useEffect(() => { setIsAdmin(!!getUser()?.isAdmin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRoadmap(await roadmapsApi.get(roadmapId)); }
    catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [roadmapId]);

  useEffect(() => { load(); }, [load]);

  const toggleCompleted = async (categoryId: string, topicId: string, current: boolean) => {
    const res = await roadmapsApi.setProgress(topicId, !current);
    setRoadmap(prev => {
      if (!prev) return prev;
      const categories = prev.categories.map(c => {
        if (c.id !== categoryId) return c;
        const topics = c.topics.map(t => (t.id === topicId ? { ...t, completed: res.completed } : t));
        const done = topics.filter(t => t.completed).length;
        return { ...c, topics, progressPercent: topics.length === 0 ? 0 : Math.round((done / topics.length) * 100) };
      });
      return { ...prev, categories };
    });
  };

  const revisit = async (categoryId: string, topicId: string) => {
    const res = await roadmapsApi.revisit(topicId);
    setRoadmap(prev => {
      if (!prev) return prev;
      const categories = prev.categories.map(c => {
        if (c.id !== categoryId) return c;
        const topics = c.topics.map(t =>
          t.id === topicId ? { ...t, revisitCount: res.revisitCount, memoryPercent: res.memoryPercent } : t
        );
        return { ...c, topics };
      });
      return { ...prev, categories };
    });
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const cat = await roadmapsApi.createCategory(roadmapId, newCategoryName.trim());
      setRoadmap(prev => prev ? { ...prev, categories: [...prev.categories, { ...cat, topics: [], progressPercent: 0 }] } : prev);
      setNewCategoryName('');
    } finally {
      setAddingCategory(false);
    }
  };

  const removeCategory = async (categoryId: string) => {
    await roadmapsApi.removeCategory(categoryId);
    setRoadmap(prev => prev ? { ...prev, categories: prev.categories.filter(c => c.id !== categoryId) } : prev);
  };

  const addTopic = async (categoryId: string) => {
    if (!newTopicTitle.trim()) return;
    const topic = await roadmapsApi.createTopic(categoryId, newTopicTitle.trim());
    setRoadmap(prev => {
      if (!prev) return prev;
      const categories = prev.categories.map(c =>
        c.id === categoryId
          ? { ...c, topics: [...c.topics, { ...topic, completed: false, revisitCount: 0, memoryPercent: 0 }] }
          : c
      );
      return { ...prev, categories };
    });
    setNewTopicTitle('');
    setAddingTopicTo(null);
  };

  const removeTopic = async (categoryId: string, topicId: string) => {
    await roadmapsApi.removeTopic(topicId);
    setRoadmap(prev => {
      if (!prev) return prev;
      const categories = prev.categories.map(c => {
        if (c.id !== categoryId) return c;
        const topics = c.topics.filter(t => t.id !== topicId);
        const done = topics.filter(t => t.completed).length;
        return { ...c, topics, progressPercent: topics.length === 0 ? 0 : Math.round((done / topics.length) * 100) };
      });
      return { ...prev, categories };
    });
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-green-800 text-sm">// roadmap not found</p>
          <Link href="/roadmaps" className="text-green-600 hover:text-green-400 text-xs">&larr; back to roadmaps</Link>
        </div>
      </div>
    );
  }

  if (loading || !roadmap) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <Link href="/roadmaps" className="text-green-800 hover:text-green-500 text-xs">&larr;</Link>
            <span className="text-green-400 font-bold text-sm">{roadmap.name}</span>
          </div>
          {roadmap.description && <p className="text-green-900 text-xs mt-1">{roadmap.description}</p>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {roadmap.categories.length === 0 && (
          <p className="text-xs text-green-950">// no categories yet{isAdmin ? ' -- add one below' : ''}</p>
        )}

        {roadmap.categories.map(category => (
          <section key={category.id} className="border border-green-900/40 rounded-sm">
            <div className="px-3 py-2.5 border-b border-green-900/40 bg-green-950/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-green-400 text-sm font-bold">{category.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-green-800">{category.progressPercent}%</span>
                  {isAdmin && (
                    <button onClick={() => removeCategory(category.id)} className="text-red-600 hover:text-red-400 text-[10px] uppercase tracking-wide">
                      remove
                    </button>
                  )}
                </div>
              </div>
              <Bar percent={category.progressPercent} colorClass="bg-green-500" />
            </div>

            <div className="p-3 space-y-3">
              {category.topics.length === 0 && (
                <p className="text-[10px] text-green-950">// no topics yet</p>
              )}
              {category.topics.map(topic => (
                <div key={topic.id} className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={topic.completed}
                      onChange={() => toggleCompleted(category.id, topic.id, topic.completed)}
                      className="mt-0.5 accent-green-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${topic.completed ? 'text-green-700 line-through' : 'text-green-300'}`}>{topic.title}</p>
                      {topic.description && <p className="text-green-900 text-xs">{topic.description}</p>}
                    </div>
                    <button
                      onClick={() => revisit(category.id, topic.id)}
                      title="mark as revisited"
                      className="flex items-center gap-1 text-[10px] text-yellow-600 hover:text-yellow-400 uppercase tracking-wide shrink-0"
                    >
                      <RefreshIcon className="w-3 h-3" />
                      revisit
                    </button>
                    {isAdmin && (
                      <button onClick={() => removeTopic(category.id, topic.id)} className="text-red-600 hover:text-red-400 text-xs shrink-0">
                        &times;
                      </button>
                    )}
                  </div>
                  <div className="pl-6 flex items-center gap-2">
                    <Bar percent={topic.memoryPercent} colorClass="bg-yellow-500" />
                    <span className="text-[9px] text-green-900 shrink-0">revisited {topic.revisitCount}&times;</span>
                  </div>
                </div>
              ))}

              {isAdmin && (
                addingTopicTo === category.id ? (
                  <form onSubmit={e => { e.preventDefault(); addTopic(category.id); }} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      autoFocus
                      value={newTopicTitle}
                      onChange={e => setNewTopicTitle(e.target.value)}
                      placeholder="topic title"
                      className="flex-1 px-2 py-1.5 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 text-xs font-mono focus:outline-none focus:border-green-500"
                    />
                    <button type="submit" className="text-[10px] px-3 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 uppercase tracking-wide">add</button>
                    <button type="button" onClick={() => { setAddingTopicTo(null); setNewTopicTitle(''); }} className="text-[10px] text-green-800 hover:text-green-500 uppercase tracking-wide">cancel</button>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingTopicTo(category.id)}
                    className="text-[10px] text-green-800 hover:text-green-500 uppercase tracking-wide pt-1"
                  >
                    + add topic
                  </button>
                )
              )}
            </div>
          </section>
        ))}

        {isAdmin && (
          <form onSubmit={addCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="new category name (e.g. React)"
              className="flex-1 px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 text-sm font-mono focus:outline-none focus:border-green-500"
            />
            <button
              type="submit"
              disabled={addingCategory || !newCategoryName.trim()}
              className="text-xs px-4 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
            >
              {addingCategory ? 'adding...' : '+ add category'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
