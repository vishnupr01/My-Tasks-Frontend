import { getToken, removeToken } from './auth';
import type { Task, AuthResponse, TaskFilters, StreakData, SubTask, AccessRequest, InviteCode, AccessRequestStatus, Member } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const data = await res.json();

  if (res.status === 401 && token) {
    // We had a session and the server rejected it (expired, deactivated mid-session, etc).
    // Force logout. But if there was no token (e.g. a failed login attempt), this 401 is
    // just "bad credentials" and should surface normally, not trigger a redirect loop.
    removeToken();
    window.location.href = '/login';
    throw new Error(data.message || 'Unauthorized');
  }

  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const auth = {
  checkUsername: (username: string) =>
    request<{ available: boolean }>(`/auth/check-username?username=${encodeURIComponent(username)}`),

  register: (email: string, username: string, password: string, name?: string, inviteCode?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, name, inviteCode: inviteCode || undefined }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  requestAccess: (email: string) =>
    request<AccessRequest>('/auth/access-requests', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export const admin = {
  listAccessRequests: () => request<AccessRequest[]>('/auth/access-requests'),

  decideAccessRequest: (id: string, status: AccessRequestStatus) =>
    request<AccessRequest>(`/auth/access-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  listInviteCodes: () => request<InviteCode[]>('/auth/invite-codes'),

  createInviteCode: () => request<InviteCode>('/auth/invite-codes', { method: 'POST' }),

  setUserActive: (userId: string, isActive: boolean) =>
    request<{ id: string; username: string; isActive: boolean }>(`/auth/users/${userId}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  listUsers: () => request<Member[]>('/auth/users'),
};

export const users = {
  search: (q: string) =>
    request<{ id: string; name: string | null; username: string }[]>(
      `/users/search?q=${encodeURIComponent(q)}`,
    ),
};

export const tasks = {
  list: (filters: TaskFilters = {}, search?: string) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => request<Task>(`/tasks/${id}`),

  create: (data: Partial<Task>) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),

  streak: () => request<StreakData>('/tasks/streak'),

  addSubTask: (parentId: string, title: string) =>
    request<SubTask>(`/tasks/${parentId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  toggleSubTask: (parentId: string, subId: string) =>
    request<SubTask>(`/tasks/${parentId}/subtasks/${subId}`, { method: 'PATCH' }),

  deleteSubTask: (parentId: string, subId: string) =>
    request<{ message: string }>(`/tasks/${parentId}/subtasks/${subId}`, { method: 'DELETE' }),
};
