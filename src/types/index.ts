export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface User {
  id: string;
  email: string;
  name?: string;
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
