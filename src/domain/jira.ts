export type JiraIssueType = 'story' | 'task' | 'bug' | 'epic' | 'improvement';
export type JiraPriority = 'urgent' | 'high' | 'medium' | 'low';
export type JiraStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface JiraChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface JiraComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface JiraAssignee {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
}

export interface JiraIssue {
  id: string;
  title: string;
  description: string;
  type: JiraIssueType;
  priority: JiraPriority;
  status: JiraStatus;
  assignee: JiraAssignee;
  tags: string[];
  dueDate?: string;
  storyPoints?: number;
  checklist: JiraChecklistItem[];
  comments: JiraComment[];
  createdAt: string;
  updatedAt: string;
}

export interface JiraToken {
  id: string;
  name: string;
  token: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}
