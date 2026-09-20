import { getToken, removeToken } from './auth';
import { getApiBaseUrl } from './api-url';
import type { Task, AuthResponse, TaskFilters, StreakData, SubTask, AccessRequest, InviteCode, AccessRequestStatus, Member, Channel, ChatMessage, Role, ChannelAccessGrant, RoadmapSummary, RoadmapDetail, RoadmapCategoryDetail, RoadmapTopic, FriendUser, FriendRequestData, DirectMessageData, NotificationSummary, UserSettings, ChannelMember, MessagePage, AttachmentType, ChannelKind, CodeDocument } from '@/types';

export interface SendMessagePayload {
  content?: string;
  attachmentUrl?: string;
  attachmentType?: AttachmentType;
  attachmentName?: string;
  attachmentDuration?: number;
}

function withCursorQuery(path: string, opts?: { limit?: number; before?: string }): string {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.before) params.set('before', opts.before);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}


async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });

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

  deleteInviteCode: (id: string) => request<{ id: string }>(`/auth/invite-codes/${id}`, { method: 'DELETE' }),

  deleteAllInviteCodes: () => request<{ count: number }>('/auth/invite-codes', { method: 'DELETE' }),

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

export const channels = {
  list: () => request<Channel[]>('/channels'),

  create: (name: string, isPrivate: boolean, description?: string, kind: ChannelKind = 'TEXT') =>
    request<Channel>('/channels', { method: 'POST', body: JSON.stringify({ name, isPrivate, description, kind }) }),

  // CODE channels only -- the server 400s for TEXT channels. The document
  // is created on first read, so this never 404s for a valid code channel.
  getCode: (channelId: string) => request<CodeDocument>(`/channels/${channelId}/code`),

  // Since Phase 1 the document text is owned by the CRDT and persisted by
  // the server, so callers normally send only `language` here.
  saveCode: (channelId: string, payload: { content?: string; language?: string }) =>
    request<CodeDocument>(`/channels/${channelId}/code`, { method: 'PUT', body: JSON.stringify(payload) }),

  listMessages: (channelId: string, opts?: { limit?: number; before?: string }) =>
    request<MessagePage<ChatMessage>>(withCursorQuery(`/channels/${channelId}/messages`, opts)),

  sendMessage: (channelId: string, payload: SendMessagePayload) =>
    request<ChatMessage>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),

  listAccess: (channelId: string) => request<ChannelAccessGrant[]>(`/channels/${channelId}/access`),

  grantAccessToUser: (channelId: string, userId: string) =>
    request<ChannelAccessGrant>(`/channels/${channelId}/access`, { method: 'POST', body: JSON.stringify({ userId }) }),

  grantAccessToRole: (channelId: string, roleId: string) =>
    request<ChannelAccessGrant>(`/channels/${channelId}/access`, { method: 'POST', body: JSON.stringify({ roleId }) }),

  revokeAccess: (channelId: string, accessId: string) =>
    request<{ message: string }>(`/channels/${channelId}/access/${accessId}`, { method: 'DELETE' }),

  markRead: (channelId: string) => request<{ ok: true }>(`/channels/${channelId}/read`, { method: 'POST' }),

  listMembers: (channelId: string) => request<ChannelMember[]>(`/channels/${channelId}/members`),
};

export const chat = {
  listOnline: () => request<string[]>('/chat/online'),
};

export const roles = {
  list: () => request<Role[]>('/roles'),

  create: (name: string) => request<Role>('/roles', { method: 'POST', body: JSON.stringify({ name }) }),

  assignUser: (roleId: string, userId: string) =>
    request<{ userId: string; roleId: string }>(`/roles/${roleId}/users`, { method: 'POST', body: JSON.stringify({ userId }) }),

  removeUser: (roleId: string, userId: string) =>
    request<{ message: string }>(`/roles/${roleId}/users/${userId}`, { method: 'DELETE' }),
};

export const roadmaps = {
  list: () => request<RoadmapSummary[]>('/roadmaps'),

  get: (id: string) => request<RoadmapDetail>(`/roadmaps/${id}`),

  create: (name: string, description?: string) =>
    request<RoadmapSummary>('/roadmaps', { method: 'POST', body: JSON.stringify({ name, description }) }),

  remove: (id: string) => request<{ message: string }>(`/roadmaps/${id}`, { method: 'DELETE' }),

  createCategory: (roadmapId: string, name: string) =>
    request<RoadmapCategoryDetail>(`/roadmaps/${roadmapId}/categories`, { method: 'POST', body: JSON.stringify({ name }) }),

  removeCategory: (categoryId: string) =>
    request<{ message: string }>(`/roadmaps/categories/${categoryId}`, { method: 'DELETE' }),

  createTopic: (categoryId: string, title: string, description?: string) =>
    request<RoadmapTopic>(`/roadmaps/categories/${categoryId}/topics`, { method: 'POST', body: JSON.stringify({ title, description }) }),

  removeTopic: (topicId: string) =>
    request<{ message: string }>(`/roadmaps/topics/${topicId}`, { method: 'DELETE' }),

  setProgress: (topicId: string, completed: boolean) =>
    request<{ completed: boolean; memoryPercent: number }>(`/roadmaps/topics/${topicId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  revisit: (topicId: string) =>
    request<{ revisitCount: number; memoryPercent: number }>(`/roadmaps/topics/${topicId}/revisit`, { method: 'POST' }),
};

export const friends = {
  sendRequest: (receiverId: string) =>
    request<FriendRequestData>('/friends/requests', { method: 'POST', body: JSON.stringify({ receiverId }) }),

  listIncoming: () => request<FriendRequestData[]>('/friends/requests/incoming'),

  listOutgoing: () => request<FriendRequestData[]>('/friends/requests/outgoing'),

  respond: (requestId: string, status: 'ACCEPTED' | 'DECLINED') =>
    request<FriendRequestData>(`/friends/requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  cancel: (requestId: string) =>
    request<{ message: string }>(`/friends/requests/${requestId}`, { method: 'DELETE' }),

  list: () => request<FriendUser[]>('/friends'),

  remove: (userId: string) => request<{ message: string }>(`/friends/${userId}`, { method: 'DELETE' }),

  listMessages: (userId: string, opts?: { limit?: number; before?: string }) =>
    request<MessagePage<DirectMessageData>>(withCursorQuery(`/friends/${userId}/messages`, opts)),

  sendMessage: (userId: string, payload: SendMessagePayload) =>
    request<DirectMessageData>(`/friends/${userId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),

  markRead: (userId: string) => request<{ ok: true }>(`/friends/${userId}/read`, { method: 'POST' }),
};

export const notifications = {
  summary: () => request<NotificationSummary>('/notifications/summary'),
};

export const settings = {
  get: () => request<UserSettings>('/users/me/settings'),

  update: (patch: Partial<UserSettings>) =>
    request<UserSettings>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};

export interface UploadResult {
  url: string;
  type: AttachmentType;
  name: string;
}

export const uploads = {
  // Raw fetch, not the shared `request` helper -- a FormData body needs the
  // browser to set Content-Type itself (multipart/form-data with a boundary
  // token), which the helper's hardcoded 'application/json' header would break.
  upload: async (file: File): Promise<UploadResult> => {
    const token = getToken();
    const body = new FormData();
    body.append('file', file);

    const res = await fetch(`${getApiBaseUrl()}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    return data;
  },
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
