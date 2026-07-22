import React, { useState } from 'react';
import {
  MessageSquare,
  UserPlus,
  Users,
  Search,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  Circle,
  Copy,
  Check,
} from 'lucide-react';
import { Chat, User as UserType } from '../types';
import { Avatar } from './Avatar';

interface SidebarProps {
  currentUser: UserType;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onSwitchUser?: (email: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  chats,
  activeChatId,
  onSelectChat,
  onOpenAddContact,
  onOpenCreateGroup,
  onOpenProfile,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentUser.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const filteredChats = chats.filter((chat) => {
    if (filter === 'direct' && chat.type !== 'direct') return false;
    if (filter === 'group' && chat.type !== 'group') return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    if (chat.type === 'group') {
      return chat.name?.toLowerCase().includes(query);
    } else {
      const otherUser = chat.participants.find((p) => p.id !== currentUser.id);
      return (
        otherUser?.displayName.toLowerCase().includes(query) ||
        otherUser?.email.toLowerCase().includes(query)
      );
    }
  });

  return (
    <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800/80 flex flex-col h-full select-none">
      {/* User Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-opacity min-w-0"
        >
          <div className="relative shrink-0">
            <Avatar
              src={currentUser.avatar}
              name={currentUser.displayName}
              size="md"
              className="border border-blue-500/30"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-blue-400 transition-colors">
              {currentUser.displayName}
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
              <span className="truncate">{currentUser.email}</span>
              <button
                onClick={handleCopyEmail}
                className="hover:text-blue-400 p-0.5 transition-colors"
                title="Copy my Email ID"
              >
                {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenAddContact}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Add / Search Contact by Email"
          >
            <UserPlus className="w-4 h-4 text-blue-400" />
          </button>
          <button
            onClick={onOpenCreateGroup}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Create Group Chat"
          >
            <Users className="w-4 h-4 text-indigo-400" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="p-3 space-y-2 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search email or chat name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex p-0.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1 rounded-lg font-medium transition-all ${filter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`flex-1 py-1 rounded-lg font-medium transition-all ${filter === 'direct' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Direct
          </button>
          <button
            onClick={() => setFilter('group')}
            className={`flex-1 py-1 rounded-lg font-medium transition-all ${filter === 'group' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/30">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">No chats found</p>
            <button
              onClick={onOpenAddContact}
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold hover:bg-blue-600/30 transition-colors"
            >
              Add Contact by Email
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isGroup = chat.type === 'group';
            const otherUser = isGroup
              ? null
              : chat.participants.find((p) => p.id !== currentUser.id);

            const title = isGroup ? chat.name : otherUser?.displayName || 'Unknown';
            const subtitle = isGroup
              ? `${chat.participants.length} members`
              : otherUser?.email || '';

            const avatar = isGroup ? chat.avatar : otherUser?.avatar;
            const isOnline = isGroup ? false : otherUser?.isOnline;
            const isActive = chat.id === activeChatId;

            // Formatted timestamp
            let timeStr = '';
            if (chat.lastMessage?.timestamp) {
              const d = new Date(chat.lastMessage.timestamp);
              timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar
                    src={avatar}
                    name={title}
                    size="lg"
                    isGroup={isGroup}
                    className="border border-slate-700/60"
                  />
                  {!isGroup && (
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    />
                  )}
                  {isGroup && (
                    <span className="absolute bottom-0 right-0 p-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-semibold text-xs text-slate-100 truncate">{title}</h4>
                    {timeStr && <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>}
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">
                    {chat.lastMessage ? (
                      <span>
                        {chat.lastMessage.senderId === currentUser.id ? 'You: ' : ''}
                        {chat.lastMessage.content || 'Attachment'}
                      </span>
                    ) : (
                      <span className="italic">{subtitle}</span>
                    )}
                  </p>
                </div>

                {/* Unread badge */}
                {chat.unreadCount && chat.unreadCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow shrink-0">
                    {chat.unreadCount}
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
