import React, { useState } from 'react';
import { X, Mail, Search, UserPlus, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { User, Chat } from '../types';
import { Avatar } from './Avatar';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatStarted: (chat: Chat) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  onChatStarted,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const users = await api.searchUsersByEmail(emailInput.trim());
      setSearchResults(users);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChatWithEmail = async (targetEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const chat = await api.startDirectChat(targetEmail);
      onChatStarted(chat);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">Email ID se Connect karein</h2>
              <p className="text-xs text-slate-400">Add or message anyone via Email ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">Target Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="e.g. sara@email.com or ali@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Quick Direct Chat Option */}
          {emailInput.trim().includes('@') && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-300">Direct Chat with Email</p>
                <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{emailInput.trim()}</p>
              </div>
              <button
                type="button"
                onClick={() => handleStartChatWithEmail(emailInput.trim())}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 shadow transition-all"
              >
                <span>Start Chat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search Results list */}
          {searchResults.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Matching Registered Users</p>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar
                          src={user.avatar}
                          name={user.displayName}
                          size="sm"
                        />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${user.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{user.displayName}</h4>
                        <p className="text-[11px] text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartChatWithEmail(user.email)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
