import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AddContactModal } from './components/AddContactModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { ProfileModal } from './components/ProfileModal';
import { User, Chat, Message } from './types';
import { api } from './services/api';
import { wsClient } from './services/websocket';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('chat_app_token'));
  const [loading, setLoading] = useState(true);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({}); // chatId -> array of typing userNames

  // Modals
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('chat_app_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          setCurrentUser(res.user);
          setToken(storedToken);
          wsClient.connect(storedToken);
        } catch (e) {
          localStorage.removeItem('chat_app_token');
          setToken(null);
          setCurrentUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Fetch User Chats
  const loadChats = useCallback(async () => {
    if (!token) return;
    try {
      const fetchedChats = await api.getChats();
      setChats(fetchedChats);

      if (fetchedChats.length > 0 && !activeChatId) {
        setActiveChatId(fetchedChats[0].id);
      }
    } catch (e) {
      console.error('Failed to load chats:', e);
    }
  }, [token, activeChatId]);

  useEffect(() => {
    if (currentUser && token) {
      loadChats();
    }
  }, [currentUser, token, loadChats]);

  // Fetch Messages for Active Chat
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const fetchedMsgs = await api.getMessages(chatId);
      setMessages(fetchedMsgs);

      // Reset unread count locally for this chat
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, []);

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    }
  }, [activeChatId, loadMessages]);

  // Handle WebSocket Real-Time Events
  useEffect(() => {
    if (!token) return;

    // New Message
    const unsubMsg = wsClient.on('message:new', ({ message }: { message: Message }) => {
      if (message.chatId === activeChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      // Update chats list lastMessage & unread count
      setChats((prevChats) => {
        return prevChats.map((c) => {
          if (c.id === message.chatId) {
            const isCurrentChat = c.id === activeChatId;
            return {
              ...c,
              lastMessage: message,
              updatedAt: message.timestamp,
              unreadCount: isCurrentChat
                ? 0
                : (c.unreadCount || 0) + (message.senderId !== currentUser?.id ? 1 : 0),
            };
          }
          return c;
        });
      });
    });

    // Message Read Event
    const unsubRead = wsClient.on('message:read', ({ chatId }: { chatId: string }) => {
      if (chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) =>
            currentUser
              ? {
                  ...m,
                  isReadBy: m.isReadBy?.includes(currentUser.id)
                    ? m.isReadBy
                    : [...(m.isReadBy || []), currentUser.id],
                }
              : m
          )
        );
      }
    });

    // Reaction Event
    const unsubReaction = wsClient.on(
      'message:reaction',
      ({ chatId, messageId, reactions }: { chatId: string; messageId: string; reactions: any[] }) => {
        if (chatId === activeChatId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
          );
        }
      }
    );

    // Typing Event
    const unsubTyping = wsClient.on(
      'typing:status',
      ({
        chatId,
        userName,
        isTyping,
      }: {
        chatId: string;
        userId: string;
        userName?: string;
        isTyping: boolean;
      }) => {
        setTypingMap((prev) => {
          const currentList = prev[chatId] || [];
          if (isTyping && userName && !currentList.includes(userName)) {
            return { ...prev, [chatId]: [...currentList, userName] };
          } else if (!isTyping) {
            return {
              ...prev,
              [chatId]: currentList.filter((name) => name !== userName),
            };
          }
          return prev;
        });
      }
    );

    // Presence Event
    const unsubPresence = wsClient.on(
      'presence:update',
      ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
        setChats((prev) =>
          prev.map((c) => ({
            ...c,
            participants: c.participants.map((p) =>
              p.id === userId ? { ...p, isOnline } : p
            ),
          }))
        );
      }
    );

    // New Chat Created Event
    const unsubChatNew = wsClient.on('chat:new', () => {
      loadChats();
    });

    return () => {
      unsubMsg();
      unsubRead();
      unsubReaction();
      unsubTyping();
      unsubPresence();
      unsubChatNew();
    };
  }, [token, activeChatId, currentUser, loadChats]);

  // Action Handlers
  const handleLoginSuccess = (user: User, userToken: string) => {
    localStorage.setItem('chat_app_token', userToken);
    setCurrentUser(user);
    setToken(userToken);
    wsClient.connect(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_app_token');
    wsClient.disconnect();
    setCurrentUser(null);
    setToken(null);
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
  };

  const handleSendMessage = async (content: string, attachments?: any[]) => {
    if (!activeChatId) return;

    try {
      const newMsg = await api.sendMessage(activeChatId, content, attachments);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, lastMessage: newMsg, updatedAt: newMsg.timestamp }
            : c
        )
      );
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const handleMessageReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await api.toggleReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (e) {
      console.error('Failed to add reaction:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading Email Messenger...</p>
      </div>
    );
  }

  if (!currentUser || !token) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const activeChat = chats.find((c) => c.id === activeChatId);

  return (
    <div className="h-screen w-screen bg-slate-950 flex overflow-hidden font-sans text-slate-100">
      {/* Sidebar Navigation & Chat List */}
      <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full shrink-0`}>
        <Sidebar
          currentUser={currentUser}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={(id) => setActiveChatId(id)}
          onOpenAddContact={() => setIsAddContactOpen(true)}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Chat Area Viewport */}
      <div className={`${!activeChatId ? 'hidden md:flex' : 'flex'} flex-1 h-full`}>
        {activeChat ? (
          <ChatArea
            chat={activeChat}
            currentUser={currentUser}
            messages={messages}
            typingUsers={typingMap[activeChat.id] || []}
            onBackMobile={() => setActiveChatId(null)}
            onSendMessage={handleSendMessage}
            onMessageReaction={handleMessageReaction}
          />
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 shadow-xl">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200">Email ID Real-time Messenger</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Select a conversation or click "Add Contact by Email" to start messaging securely in real-time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onChatStarted={(newChat) => {
          setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
          setActiveChatId(newChat.id);
        }}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(groupChat) => {
          setChats((prev) => [groupChat, ...prev.filter((c) => c.id !== groupChat.id)]);
          setActiveChatId(groupChat.id);
        }}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}
