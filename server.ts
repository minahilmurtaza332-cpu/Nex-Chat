import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

// -------------------------------------------------------------
// In-Memory Database and Seed Data
// -------------------------------------------------------------
interface UserDB {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  passwordHash: string;
  statusMessage: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

interface MessageDB {
  id: string;
  chatId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  attachments?: any[];
  reactions?: { emoji: string; userId: string; userName: string }[];
  timestamp: string;
  isReadBy: string[];
  isEdited?: boolean;
}

interface ChatDB {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  participantIds: string[];
  updatedAt: string;
  createdBy?: string;
}

const usersDB: Map<string, UserDB> = new Map();
const chatsDB: Map<string, ChatDB> = new Map();
const messagesDB: Map<string, MessageDB[]> = new Map(); // chatId -> MessageDB[]
const tokensDB: Map<string, string> = new Map(); // token -> userId

// -------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------
function generateToken(userId: string): string {
  const token = `token_${userId}_${Math.random().toString(36).substring(2)}`;
  tokensDB.set(token, userId);
  return token;
}

function getUserByToken(token?: string): UserDB | null {
  if (!token) return null;
  const userId = tokensDB.get(token);
  if (!userId) return null;
  return usersDB.get(userId) || null;
}

function formatUser(u: UserDB) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// -------------------------------------------------------------
// Authentication Middleware & REST Routes
// -------------------------------------------------------------
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    (req as any).user = getUserByToken(token);
  }
  next();
});

// Register
app.post(['/api/auth/register', '/api/auth/register/'], (req, res) => {
  try {
    const { email, password, displayName, avatar, statusMessage } = req.body || {};

    const rawEmail = (email || '').toString().trim();
    const cleanEmail = rawEmail ? rawEmail.toLowerCase() : `user_${Date.now()}@email.com`;
    const pwd = (password || '123456').toString();

    let existingUser = Array.from(usersDB.values()).find((u) => u.email === cleanEmail);
    if (existingUser) {
      if (displayName) existingUser.displayName = displayName.toString();
      existingUser.passwordHash = pwd;
      if (avatar !== undefined) existingUser.avatar = avatar;
      if (statusMessage) existingUser.statusMessage = statusMessage;
      existingUser.isOnline = true;
      existingUser.lastSeen = new Date().toISOString();

      const token = generateToken(existingUser.id);
      broadcastPresence(existingUser.id, true);

      return res.json({
        user: formatUser(existingUser),
        token,
      });
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const namePart = cleanEmail.split('@')[0] || 'User';
    const computedName = (displayName || namePart).toString();

    const newUser: UserDB = {
      id: userId,
      email: cleanEmail,
      displayName: computedName.charAt(0).toUpperCase() + computedName.slice(1),
      avatar: avatar || '',
      passwordHash: pwd,
      statusMessage: statusMessage || 'Hey there! I am using Email Messenger.',
      isOnline: true,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    usersDB.set(userId, newUser);
    const token = generateToken(userId);

    return res.json({
      user: formatUser(newUser),
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration error' });
  }
});

// Login
app.post(['/api/auth/login', '/api/auth/login/'], (req, res) => {
  try {
    const { email, password } = req.body || {};

    const rawEmail = (email || '').toString().trim();
    const cleanEmail = rawEmail ? rawEmail.toLowerCase() : `user_${Date.now()}@email.com`;
    const pwd = (password || '123456').toString();

    let user = Array.from(usersDB.values()).find((u) => u.email === cleanEmail);

    if (!user) {
      // Automatically create account if user logs in with new email
      const namePart = cleanEmail.split('@')[0] || 'User';
      const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      user = {
        id: userId,
        email: cleanEmail,
        displayName: displayName || 'User',
        avatar: '',
        passwordHash: pwd,
        statusMessage: 'Hey there! I am using Email Messenger.',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      usersDB.set(userId, user);
    } else {
      if (password) {
        user.passwordHash = pwd;
      }
      user.isOnline = true;
      user.lastSeen = new Date().toISOString();
    }

    const token = generateToken(user.id);
    broadcastPresence(user.id, true);

    return res.json({
      user: formatUser(user),
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login error' });
  }
});

// Current User
app.get('/api/auth/me', (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: formatUser(user) });
});

// Update Profile
app.put('/api/auth/profile', (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { displayName, avatar, statusMessage } = req.body;
  if (displayName) user.displayName = displayName;
  if (avatar !== undefined) user.avatar = avatar;
  if (statusMessage !== undefined) user.statusMessage = statusMessage;

  return res.json({ user: formatUser(user) });
});

// Search / Add Contact by Email
app.get('/api/users/search', (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const query = (req.query.email as string || '').toLowerCase().trim();
  if (!query) return res.json({ users: [] });

  const results = Array.from(usersDB.values())
    .filter((u) => u.email.includes(query) && u.id !== user.id)
    .map(formatUser);

  return res.json({ users: results });
});

// Get All Users (for demo contact browsing)
app.get('/api/users', (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const all = Array.from(usersDB.values())
    .filter((u) => u.id !== user.id)
    .map(formatUser);

  return res.json({ users: all });
});

// Get User Chats
app.get('/api/chats', (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const userChats = Array.from(chatsDB.values()).filter((c) =>
    c.participantIds.includes(user.id)
  );

  const formattedChats = userChats.map((chat) => {
    const participants = chat.participantIds
      .map((pid) => usersDB.get(pid))
      .filter((u): u is UserDB => Boolean(u))
      .map(formatUser);

    const msgs = messagesDB.get(chat.id) || [];
    const lastMessage = msgs[msgs.length - 1] || undefined;

    // Calculate unread
    const unreadCount = msgs.filter(
      (m) => m.senderId !== user.id && !m.isReadBy.includes(user.id)
    ).length;

    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      avatar: chat.avatar,
      participants,
      lastMessage,
      unreadCount,
      updatedAt: chat.updatedAt,
      createdBy: chat.createdBy,
    };
  });

  // Sort by latest updated
  formattedChats.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return res.json({ chats: formattedChats });
});

// Create Direct Chat by Target Email ID
app.post('/api/chats/direct', (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { targetEmail } = req.body;
  if (!targetEmail) {
    return res.status(400).json({ error: 'Target email is required' });
  }

  const cleanTargetEmail = targetEmail.trim().toLowerCase();
  if (cleanTargetEmail === user.email) {
    return res.status(400).json({ error: 'You cannot start a direct chat with yourself' });
  }

  let targetUser = Array.from(usersDB.values()).find((u) => u.email === cleanTargetEmail);

  // If target user doesn't exist yet, auto-create a placeholder user account so chat is ready!
  if (!targetUser) {
    const newTargetId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nameFromEmail = cleanTargetEmail.split('@')[0];
    const capitalizedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    
    targetUser = {
      id: newTargetId,
      email: cleanTargetEmail,
      displayName: capitalizedName,
      avatar: '',
      passwordHash: 'password123',
      statusMessage: 'Joined via Email invite',
      isOnline: false,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    usersDB.set(newTargetId, targetUser);
  }

  // Check if direct chat already exists
  const existingChat = Array.from(chatsDB.values()).find(
    (c) =>
      c.type === 'direct' &&
      c.participantIds.includes(user.id) &&
      c.participantIds.includes(targetUser!.id)
  );

  if (existingChat) {
    const participants = existingChat.participantIds
      .map((pid) => usersDB.get(pid))
      .filter((u): u is UserDB => Boolean(u))
      .map(formatUser);

    const msgs = messagesDB.get(existingChat.id) || [];
    return res.json({
      chat: {
        id: existingChat.id,
        type: existingChat.type,
        participants,
        lastMessage: msgs[msgs.length - 1],
        updatedAt: existingChat.updatedAt,
      },
    });
  }

  // Create new direct chat
  const newChatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newChat: ChatDB = {
    id: newChatId,
    type: 'direct',
    participantIds: [user.id, targetUser.id],
    updatedAt: new Date().toISOString(),
  };

  chatsDB.set(newChatId, newChat);
  messagesDB.set(newChatId, []);

  const participants = [user, targetUser].map(formatUser);

  // Notify target user via WS if online
  notifyChatCreated(newChatId, [user.id, targetUser.id]);

  return res.json({
    chat: {
      id: newChatId,
      type: 'direct',
      participants,
      updatedAt: newChat.updatedAt,
    },
  });
});

// Create Group Chat
app.post('/api/chats/group', (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { name, participantEmails, avatar } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const memberIds: string[] = [user.id];

  if (Array.isArray(participantEmails)) {
    participantEmails.forEach((emailStr: string) => {
      const cleanEmail = emailStr.trim().toLowerCase();
      let found = Array.from(usersDB.values()).find((u) => u.email === cleanEmail);
      if (!found) {
        // Auto create account for email
        const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const nameFromEmail = cleanEmail.split('@')[0];
        found = {
          id: newId,
          email: cleanEmail,
          displayName: nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
          avatar: '',
          passwordHash: 'password123',
          statusMessage: 'Group member',
          isOnline: false,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        usersDB.set(newId, found);
      }
      if (!memberIds.includes(found.id)) {
        memberIds.push(found.id);
      }
    });
  }

  const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const groupChat: ChatDB = {
    id: groupId,
    type: 'group',
    name,
    avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
    participantIds: memberIds,
    updatedAt: new Date().toISOString(),
    createdBy: user.id,
  };

  chatsDB.set(groupId, groupChat);
  messagesDB.set(groupId, []);

  // System welcome message
  const sysMsg: MessageDB = {
    id: `msg_sys_${Date.now()}`,
    chatId: groupId,
    senderId: user.id,
    senderEmail: user.email,
    senderName: user.displayName,
    senderAvatar: user.avatar,
    content: `${user.displayName} created group "${name}"`,
    timestamp: new Date().toISOString(),
    isReadBy: [user.id],
  };
  messagesDB.get(groupId)!.push(sysMsg);

  notifyChatCreated(groupId, memberIds);

  const participants = memberIds
    .map((pid) => usersDB.get(pid))
    .filter((u): u is UserDB => Boolean(u))
    .map(formatUser);

  return res.json({
    chat: {
      id: groupId,
      type: 'group',
      name,
      avatar: groupChat.avatar,
      participants,
      lastMessage: sysMsg,
      updatedAt: groupChat.updatedAt,
      createdBy: user.id,
    },
  });
});

// Get Messages for a Chat
app.get('/api/chats/:chatId/messages', (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { chatId } = req.params;
  const chat = chatsDB.get(chatId);

  if (!chat || !chat.participantIds.includes(user.id)) {
    return res.status(403).json({ error: 'Access denied or chat not found' });
  }

  const msgs = messagesDB.get(chatId) || [];

  // Mark all messages as read by current user
  let updatedCount = 0;
  msgs.forEach((m) => {
    if (!m.isReadBy.includes(user.id)) {
      m.isReadBy.push(user.id);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    broadcastReadStatus(chatId, user.id);
  }

  return res.json({ messages: msgs });
});

// Send Message REST API
app.post('/api/chats/:chatId/messages', (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { chatId } = req.params;
  const { content, attachments } = req.body;

  const chat = chatsDB.get(chatId);
  if (!chat || !chat.participantIds.includes(user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Message content or attachment required' });
  }

  const newMsg: MessageDB = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    chatId,
    senderId: user.id,
    senderEmail: user.email,
    senderName: user.displayName,
    senderAvatar: user.avatar,
    content: content || '',
    attachments: attachments || [],
    reactions: [],
    timestamp: new Date().toISOString(),
    isReadBy: [user.id],
  };

  if (!messagesDB.has(chatId)) {
    messagesDB.set(chatId, []);
  }
  messagesDB.get(chatId)!.push(newMsg);

  chat.updatedAt = newMsg.timestamp;

  broadcastMessage(newMsg, chat.participantIds);

  return res.json({ message: newMsg });
});

// Add Reaction to Message
app.post(['/api/messages/:messageId/reaction', '/api/messages/:messageId/reactions'], (req, res) => {
  const user = (req as any).user as UserDB;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { messageId } = req.params;
  const { emoji } = req.body;

  let targetMsg: MessageDB | null = null;
  let targetChat: ChatDB | null = null;

  for (const [cId, msgs] of messagesDB.entries()) {
    const found = msgs.find((m) => m.id === messageId);
    if (found) {
      targetMsg = found;
      targetChat = chatsDB.get(cId) || null;
      break;
    }
  }

  if (!targetMsg || !targetChat) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (!targetMsg.reactions) {
    targetMsg.reactions = [];
  }

  // Toggle reaction
  const existingIdx = targetMsg.reactions.findIndex(
    (r) => r.userId === user.id && r.emoji === emoji
  );

  if (existingIdx >= 0) {
    targetMsg.reactions.splice(existingIdx, 1);
  } else {
    targetMsg.reactions.push({
      emoji,
      userId: user.id,
      userName: user.displayName,
    });
  }

  broadcastReaction(targetChat.id, targetMsg.id, targetMsg.reactions, targetChat.participantIds);

  return res.json({ reactions: targetMsg.reactions });
});

// Catch-all 404 for unhandled API requests
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map of userId -> Set of WebSocket clients
const userSockets: Map<string, Set<WebSocket>> = new Map();

wss.on('connection', (ws: WebSocket) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const parsed = JSON.parse(data.toString());
      const { type, payload } = parsed;

      if (type === 'auth') {
        const token = payload?.token;
        const user = getUserByToken(token);
        if (user) {
          authenticatedUserId = user.id;
          if (!userSockets.has(user.id)) {
            userSockets.set(user.id, new Set());
          }
          userSockets.get(user.id)!.add(ws);

          user.isOnline = true;
          user.lastSeen = new Date().toISOString();

          ws.send(
            JSON.stringify({
              type: 'authenticated',
              payload: { user: formatUser(user) },
            })
          );

          broadcastPresence(user.id, true);
        } else {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Invalid token' },
            })
          );
        }
      }

      if (type === 'typing:start' && authenticatedUserId) {
        const { chatId } = payload;
        const chat = chatsDB.get(chatId);
        if (chat && chat.participantIds.includes(authenticatedUserId)) {
          const sender = usersDB.get(authenticatedUserId);
          chat.participantIds.forEach((pid) => {
            if (pid !== authenticatedUserId) {
              sendToUser(pid, {
                type: 'typing:status',
                payload: {
                  chatId,
                  userId: authenticatedUserId,
                  userName: sender?.displayName || 'Someone',
                  isTyping: true,
                },
              });
            }
          });
        }
      }

      if (type === 'typing:stop' && authenticatedUserId) {
        const { chatId } = payload;
        const chat = chatsDB.get(chatId);
        if (chat && chat.participantIds.includes(authenticatedUserId)) {
          chat.participantIds.forEach((pid) => {
            if (pid !== authenticatedUserId) {
              sendToUser(pid, {
                type: 'typing:status',
                payload: {
                  chatId,
                  userId: authenticatedUserId,
                  isTyping: false,
                },
              });
            }
          });
        }
      }
    } catch (e) {
      console.error('WS error:', e);
    }
  });

  ws.on('close', () => {
    if (authenticatedUserId) {
      const sockets = userSockets.get(authenticatedUserId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userSockets.delete(authenticatedUserId);
          const user = usersDB.get(authenticatedUserId);
          if (user) {
            user.isOnline = false;
            user.lastSeen = new Date().toISOString();
            broadcastPresence(authenticatedUserId, false);
          }
        }
      }
    }
  });
});

function sendToUser(userId: string, data: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const jsonStr = JSON.stringify(data);
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(jsonStr);
      }
    });
  }
}

function broadcastMessage(message: MessageDB, participantIds: string[]) {
  participantIds.forEach((pid) => {
    sendToUser(pid, {
      type: 'message:new',
      payload: { message },
    });
  });
}

function broadcastReadStatus(chatId: string, userId: string) {
  const chat = chatsDB.get(chatId);
  if (chat) {
    chat.participantIds.forEach((pid) => {
      sendToUser(pid, {
        type: 'message:read',
        payload: { chatId, readByUserId: userId },
      });
    });
  }
}

function broadcastReaction(
  chatId: string,
  messageId: string,
  reactions: any[],
  participantIds: string[]
) {
  participantIds.forEach((pid) => {
    sendToUser(pid, {
      type: 'message:reaction',
      payload: { chatId, messageId, reactions },
    });
  });
}

function broadcastPresence(userId: string, isOnline: boolean) {
  const allUserIds = Array.from(usersDB.keys());
  allUserIds.forEach((pid) => {
    if (pid !== userId) {
      sendToUser(pid, {
        type: 'presence:update',
        payload: { userId, isOnline, lastSeen: new Date().toISOString() },
      });
    }
  });
}

function notifyChatCreated(chatId: string, participantIds: string[]) {
  participantIds.forEach((pid) => {
    sendToUser(pid, {
      type: 'chat:new',
      payload: { chatId },
    });
  });
}

function seedInitialData() {
  if (usersDB.size > 0) return;

  const user1: UserDB = {
    id: 'user_alex',
    email: 'alex@email.com',
    displayName: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    passwordHash: 'password123',
    statusMessage: 'Available for email chat!',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const user2: UserDB = {
    id: 'user_sarah',
    email: 'sarah@email.com',
    displayName: 'Sarah Connor',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    passwordHash: 'password123',
    statusMessage: 'Working on product design 🚀',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const demoUser: UserDB = {
    id: 'user_demo',
    email: 'demo@email.com',
    displayName: 'Demo User',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    passwordHash: '123456',
    statusMessage: 'Testing Nex Email Messenger!',
    isOnline: true,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  usersDB.set(user1.id, user1);
  usersDB.set(user2.id, user2);
  usersDB.set(demoUser.id, demoUser);

  // Direct Chat between Demo & Alex
  const chat1: ChatDB = {
    id: 'chat_demo_alex',
    type: 'direct',
    participantIds: ['user_demo', 'user_alex'],
    updatedAt: new Date().toISOString(),
  };
  chatsDB.set(chat1.id, chat1);

  messagesDB.set(chat1.id, [
    {
      id: 'msg_1',
      chatId: chat1.id,
      senderId: 'user_alex',
      senderEmail: 'alex@email.com',
      senderName: 'Alex Rivera',
      senderAvatar: user1.avatar,
      content: 'Hey! Welcome to Nex Chat. You can connect with anyone using their Email ID.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isReadBy: ['user_demo'],
    },
    {
      id: 'msg_2',
      chatId: chat1.id,
      senderId: 'user_demo',
      senderEmail: 'demo@email.com',
      senderName: 'Demo User',
      senderAvatar: demoUser.avatar,
      content: 'Awesome! Real-time messaging without phone numbers is super convenient.',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      isReadBy: ['user_alex'],
    }
  ]);

  // Group Chat
  const group1: ChatDB = {
    id: 'chat_team_group',
    type: 'group',
    name: 'Project Discussion Group',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    participantIds: ['user_demo', 'user_alex', 'user_sarah'],
    updatedAt: new Date().toISOString(),
    createdBy: 'user_alex',
  };
  chatsDB.set(group1.id, group1);

  messagesDB.set(group1.id, [
    {
      id: 'msg_g1',
      chatId: group1.id,
      senderId: 'user_sarah',
      senderEmail: 'sarah@email.com',
      senderName: 'Sarah Connor',
      senderAvatar: user2.avatar,
      content: 'Hello team! Group messaging is working live.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      isReadBy: ['user_demo', 'user_alex'],
    }
  ]);
}

// -------------------------------------------------------------
// Vite Middleware / Static Server
// -------------------------------------------------------------
async function startServer() {
  seedInitialData();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
