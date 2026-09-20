'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { admin, roles as rolesApi } from '@/lib/api';
import { isAuthenticated, getUser } from '@/lib/auth';
import UserPicker from '@/components/UserPicker';
import ConfirmModal from '@/components/ConfirmModal';
import { TrashIcon } from '@/components/Icons';
import type { AccessRequest, InviteCode, Member, Role } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [addingToRole, setAddingToRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [confirmDeleteAllCodes, setConfirmDeleteAllCodes] = useState(false);

  const selfId = getUser()?.id;

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!getUser()?.isAdmin) { router.replace('/tasks'); return; }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, m, ro] = await Promise.all([
        admin.listAccessRequests(),
        admin.listInviteCodes(),
        admin.listUsers(),
        rolesApi.list(),
      ]);
      setRequests(r);
      setCodes(c);
      setMembers(m);
      setAllRoles(ro);
    } catch { /* guard redirect already handles unauthorized */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, status: 'APPROVED' | 'DECLINED') => {
    const updated = await admin.decideAccessRequest(id, status);
    setRequests(prev => prev.map(r => (r.id === id ? updated : r)));
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const code = await admin.createInviteCode();
      setCodes(prev => [code, ...prev]);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const executeDeleteCode = async () => {
    if (!confirmDeleteCode) return;
    await admin.deleteInviteCode(confirmDeleteCode);
    setCodes(prev => prev.filter(c => c.id !== confirmDeleteCode));
    setConfirmDeleteCode(null);
  };

  const executeDeleteAllCodes = async () => {
    await admin.deleteAllInviteCodes();
    setCodes([]);
    setConfirmDeleteAllCodes(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const updated = await admin.setUserActive(id, !current);
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, isActive: updated.isActive } : m)));
  };

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const role = await rolesApi.create(newRoleName.trim());
      setAllRoles(prev => [...prev, { ...role, users: [] }]);
      setNewRoleName('');
    } finally {
      setCreatingRole(false);
    }
  };

  const addUserToRole = async (roleId: string, user: { id: string; username: string }) => {
    await rolesApi.assignUser(roleId, user.id);
    setAllRoles(prev => prev.map(r =>
      r.id === roleId ? { ...r, users: [...r.users, { user: { id: user.id, username: user.username } }] } : r
    ));
    setAddingToRole(null);
  };

  const removeUserFromRole = async (roleId: string, userId: string) => {
    await rolesApi.removeUser(roleId, userId);
    setAllRoles(prev => prev.map(r =>
      r.id === roleId ? { ...r, users: r.users.filter(u => u.user.id !== userId) } : r
    ));
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const decided = requests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="min-h-screen bg-black font-mono flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-mono">
      <header className="border-b border-green-900/40 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <span className="text-green-400 font-bold tracking-widest text-sm">ADMIN</span>
          <span className="text-green-900 text-xs hidden sm:inline ml-2">// access control</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Access requests */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">access_requests</h2>
            <span className="text-xs text-green-900">{pending.length} pending</span>
          </div>

          {pending.length === 0 && (
            <p className="text-xs text-green-950">// no pending requests</p>
          )}

          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between flex-wrap gap-2 border border-green-900/40 rounded-sm px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-green-300 text-sm truncate">{r.email}</p>
                  <p className="text-green-900 text-xs">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decide(r.id, 'APPROVED')}
                    className="text-xs px-3 py-1.5 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 transition-colors uppercase tracking-wide"
                  >
                    approve
                  </button>
                  <button
                    onClick={() => decide(r.id, 'DECLINED')}
                    className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 rounded-sm hover:bg-red-950/30 transition-colors uppercase tracking-wide"
                  >
                    decline
                  </button>
                </div>
              </div>
            ))}
          </div>

          {decided.length > 0 && (
            <details className="text-xs">
              <summary className="text-green-900 cursor-pointer">// {decided.length} decided</summary>
              <div className="mt-2 space-y-1.5">
                {decided.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-green-800">{r.email}</span>
                    <span className={r.status === 'APPROVED' ? 'text-green-600' : 'text-red-500'}>{r.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Invite codes */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">invite_codes</h2>
            <div className="flex items-center gap-2">
              {codes.length > 0 && (
                <button
                  onClick={() => setConfirmDeleteAllCodes(true)}
                  className="text-xs px-3 py-1.5 border border-red-900/50 text-red-500 hover:bg-red-950/30 hover:border-red-700 rounded-sm transition-colors uppercase tracking-wide"
                >
                  delete all
                </button>
              )}
              <button
                onClick={generateCode}
                disabled={generating}
                className="text-xs px-3 py-1.5 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
              >
                {generating ? 'generating...' : '+ generate'}
              </button>
            </div>
          </div>

          {codes.length === 0 && (
            <p className="text-xs text-green-950">// no codes generated yet</p>
          )}

          <div className="space-y-2">
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between flex-wrap gap-2 border border-green-900/40 rounded-sm px-3 py-2.5">
                <div className="min-w-0">
                  <button
                    onClick={() => copyCode(c.code, c.id)}
                    className="text-green-300 text-sm font-bold tracking-wider hover:text-green-400 transition-colors"
                    title="click to copy"
                  >
                    {c.code} {copiedId === c.id && <span className="text-green-600 text-xs">copied</span>}
                  </button>
                  <p className="text-green-900 text-xs">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs truncate max-w-[9rem] ${c.usedBy ? 'text-green-900' : 'text-green-600'}`}>
                    {c.usedBy ? `used by @${c.usedBy.username}` : 'unused'}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteCode(c.id)}
                    title="delete code"
                    className="text-green-900 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">roles</h2>
            <span className="text-xs text-green-900">{allRoles.length} total</span>
          </div>

          <form onSubmit={createRole} className="flex gap-2">
            <input
              type="text"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="new role name (e.g. vip)"
              className="flex-1 px-3 py-2 bg-black border border-green-900 rounded-sm text-green-300 placeholder-green-900 text-sm font-mono focus:outline-none focus:border-green-500"
            />
            <button
              type="submit"
              disabled={creatingRole || !newRoleName.trim()}
              className="text-xs px-4 bg-green-500 text-black font-bold rounded-sm hover:bg-green-400 disabled:opacity-40 transition-colors uppercase tracking-wide"
            >
              {creatingRole ? 'creating...' : '+ create'}
            </button>
          </form>

          {allRoles.length === 0 && (
            <p className="text-xs text-green-950">// no roles yet -- roles let you grant a whole group access to a channel at once</p>
          )}

          <div className="space-y-2">
            {allRoles.map(r => (
              <div key={r.id} className="border border-green-900/40 rounded-sm px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-300 text-sm font-bold">{r.name}</span>
                  <button
                    onClick={() => setAddingToRole(addingToRole === r.id ? null : r.id)}
                    className="text-[10px] text-green-800 hover:text-green-500 uppercase tracking-wide"
                  >
                    {addingToRole === r.id ? 'close' : '+ add member'}
                  </button>
                </div>

                {addingToRole === r.id && (
                  <UserPicker onSelect={u => addUserToRole(r.id, u)} placeholder="search users to add to this role..." />
                )}

                <div className="flex flex-wrap gap-1.5">
                  {r.users.length === 0 && <span className="text-[10px] text-green-950">// nobody in this role yet</span>}
                  {r.users.map(({ user }) => (
                    <span key={user.id} className="flex items-center gap-1.5 text-[10px] text-green-700 border border-green-900/40 rounded-sm px-2 py-1">
                      @{user.username}
                      <button onClick={() => removeUserFromRole(r.id, user.id)} className="text-red-600 hover:text-red-400">&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Members */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-green-500 text-xs uppercase tracking-widest">members</h2>
            <span className="text-xs text-green-900">{members.length} total</span>
          </div>

          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between flex-wrap gap-2 border border-green-900/40 rounded-sm px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-green-300 text-sm truncate">
                    @{m.username} {m.isAdmin && <span className="text-yellow-500 text-xs">[admin]</span>}
                  </p>
                  <p className="text-green-900 text-xs truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs ${m.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {m.isActive ? 'active' : 'removed'}
                  </span>
                  {m.id !== selfId && (
                    <button
                      onClick={() => toggleActive(m.id, m.isActive)}
                      className={`text-xs px-3 py-1.5 rounded-sm uppercase tracking-wide transition-colors ${
                        m.isActive
                          ? 'border border-red-900/50 text-red-400 hover:bg-red-950/30'
                          : 'bg-green-500 text-black font-bold hover:bg-green-400'
                      }`}
                    >
                      {m.isActive ? 'remove' : 'restore'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {confirmDeleteCode && (
        <ConfirmModal
          message="delete this invite code?"
          subtext="anyone holding this code will no longer be able to use it to register."
          confirmLabel="delete"
          onConfirm={executeDeleteCode}
          onCancel={() => setConfirmDeleteCode(null)}
        />
      )}

      {confirmDeleteAllCodes && (
        <ConfirmModal
          message={`delete all ${codes.length} invite codes?`}
          subtext="every unused and used code will be removed."
          confirmLabel="delete all"
          onConfirm={executeDeleteAllCodes}
          onCancel={() => setConfirmDeleteAllCodes(false)}
        />
      )}
    </div>
  );
}
