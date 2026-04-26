export type ActivityType = 'message_sent' | 'document_summarized' | 'source_added' | 'source_removed' | 'notebook_created' | 'create' | 'add_source' | 'chat' | 'history' | 'search';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  timestamp: string | number | Date;
  description?: string;
  metadata?: string;
}

export interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'text';
  selected: boolean;
  data?: string; // base64 for pdf, or raw text
  summary?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | number | Date;
  citations?: number[];
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  lastModified: string;
  color?: string;
  icon?: string;
  sources?: Source[];
}
