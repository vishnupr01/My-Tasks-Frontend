export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  isAdmin: boolean;
  createdAt: string;
}

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface AccessRequest {
  id: string;
  email: string;
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: { id: string; username: string } | null;
}

export interface InviteCode {
  id: string;
  code: string;
  createdAt: string;
  usedAt?: string;
  usedBy?: { id: string; username: string; email: string } | null;
}

export interface Member {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

// TEXT = the chat-only channels that already existed. CODE = same chat,
// plus a shared editor. Set at creation; see CreateChannelDto on the server.
export type ChannelKind = 'TEXT' | 'CODE';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  kind: ChannelKind;
  createdById: string;
  createdAt: string;
}

// The editor surface of a CODE channel. `language` is stored per document,
// so each room picks its own and can change it at any time.
export interface CodeDocument {
  id: string;
  channelId: string;
  path: string;
  language: string;
  content: string;
  updatedAt: string;
  updatedById?: string | null;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export interface ChatMessage {
  id: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: AttachmentType;
  attachmentName?: string;
  attachmentDuration?: number;
  channelId: string;
  authorId: string;
  author: { id: string; username: string; name?: string };
  createdAt: string;
  // Client-only: set on an optimistic placeholder shown before the real
  // upload/send round trip finishes. Never comes from the server.
  sending?: boolean;
}

export interface Role {
  id: string;
  name: string;
  createdAt: string;
  users: { user: { id: string; username: string } }[];
}

export interface ChannelAccessGrant {
  id: string;
  channelId: string;
  userId?: string;
  roleId?: string;
  user?: { id: string; username: string; email: string } | null;
  role?: { id: string; name: string } | null;
  createdAt: string;
}

export interface RoadmapSummary {
  id: string;
  name: string;
  description?: string;
  createdById: string;
  createdAt: string;
  _count: { categories: number };
}

export interface RoadmapTopic {
  id: string;
  categoryId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
  completed: boolean;
  revisitCount: number;
  memoryPercent: number;
}

export interface RoadmapCategoryDetail {
  id: string;
  roadmapId: string;
  name: string;
  order: number;
  createdAt: string;
  topics: RoadmapTopic[];
  progressPercent: number;
}

export interface RoadmapDetail {
  id: string;
  name: string;
  description?: string;
  createdById: string;
  createdAt: string;
  categories: RoadmapCategoryDetail[];
}

export interface FriendUser {
  id: string;
  username: string;
  name?: string;
}

export interface FriendRequestData {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  sender?: FriendUser;
  receiver?: FriendUser;
}

export interface DirectMessageData {
  id: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: AttachmentType;
  attachmentName?: string;
  attachmentDuration?: number;
  conversationId: string;
  senderId: string;
  sender: FriendUser;
  createdAt: string;
  // Client-only: set on an optimistic placeholder shown before the real
  // upload/send round trip finishes. Never comes from the server.
  sending?: boolean;
}

export interface NotificationSummary {
  channels: Record<string, number>;
  dms: Record<string, number>;
  friendRequests: number;
}

export interface UserSettings {
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
}

export interface ChannelMember {
  id: string;
  username: string;
  name?: string;
  isAdmin: boolean;
}

export interface MessagePage<T> {
  messages: T[];
  hasMore: boolean;
}

export interface SubTask {
  id: string;
  title: string;
  status: Status;
  completedAt?: string;
  parentId: string;
  userId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  parentId?: string;
  subTasks?: SubTask[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface TaskFilters {
  status?: Status | '';
  priority?: Priority | '';
}

export interface StreakData {
  current: number;
  best: number;
  calendar: Record<string, number>;
}
