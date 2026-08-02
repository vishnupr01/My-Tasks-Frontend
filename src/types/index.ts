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
