export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  statusMessage?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Attachment {
  type: 'image' | 'file' | 'audio';
  url: string;
  name: string;
  size?: number;
  duration?: number; // for audio in seconds
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
  timestamp: string;
  isReadBy?: string[]; // user IDs who have read
  isEdited?: boolean;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string; // For groups
  avatar?: string; // For groups
  participants: User[];
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt: string;
  createdBy?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// WebSocket Event Payloads
export type WSEventType =
  | 'auth'
  | 'authenticated'
  | 'message:send'
  | 'message:new'
  | 'message:read'
  | 'message:reaction'
  | 'typing:start'
  | 'typing:stop'
  | 'typing:status'
  | 'presence:update'
  | 'chat:new';

export interface WSMessage {
  type: WSEventType;
  payload: any;
}
