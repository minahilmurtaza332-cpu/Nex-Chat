import { User, Chat, Message } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('chat_app_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async register(data: {
    email: string;
    password: string;
    displayName: string;
    avatar?: string;
    statusMessage?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch user');
    return json;
  },

  async updateProfile(data: {
    displayName?: string;
    avatar?: string;
    statusMessage?: string;
  }): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update profile');
    return json;
  },

  async searchUsersByEmail(email: string): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users/search?email=${encodeURIComponent(email)}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Search failed');
    return json.users || [];
  },

  async getAllUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch users');
    return json.users || [];
  },

  async getChats(): Promise<Chat[]> {
    const res = await fetch(`${API_BASE}/chats`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch chats');
    return json.chats || [];
  },

  async startDirectChat(targetEmail: string): Promise<Chat> {
    const res = await fetch(`${API_BASE}/chats/direct`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetEmail }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to start chat');
    return json.chat;
  },

  async createGroupChat(data: {
    name: string;
    participantEmails: string[];
    avatar?: string;
  }): Promise<Chat> {
    const res = await fetch(`${API_BASE}/chats/group`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create group');
    return json.chat;
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch messages');
    return json.messages || [];
  },

  async sendMessage(
    chatId: string,
    content: string,
    attachments?: any[]
  ): Promise<Message> {
    const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, attachments }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to send message');
    return json.message;
  },

  async toggleReaction(messageId: string, emoji: string): Promise<any> {
    const res = await fetch(`${API_BASE}/messages/${messageId}/reaction`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ emoji }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to add reaction');
    return json;
  },
};
