export interface Task {
  id: string;
  title: string;
  status: string;
  stage: string;
  progress: number;
}

export interface TaskDetail extends Task {
  description: string;
}

export interface HistoryEvent {
  timestamp: number;
  event: string;
  value?: string | number;
}
