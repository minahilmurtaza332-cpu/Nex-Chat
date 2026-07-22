import React, { useState, useRef } from 'react';
import { X, User, Mail, Copy, Check, Camera, Upload, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';
import { Avatar } from './Avatar';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onUpdateUser: (updated: UserType) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || '');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(currentUser.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await api.updateProfile({
        displayName,
        statusMessage,
      });
      onUpdateUser(res.user);
      setMsg('Profile updated successfully!');
      setTimeout(() => setMsg(null), 2500);
    } catch (err: any) {
      setMsg(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMsg('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    setUploadingAvatar(true);
    setMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const res = await api.updateProfile({ avatar: dataUrl });
        onUpdateUser(res.user);
        setMsg('Profile picture updated successfully!');
        setTimeout(() => setMsg(null), 2500);
      } catch (err: any) {
        setMsg(err.message || 'Failed to update profile picture');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setUploadingAvatar(true);
    try {
      const res = await api.updateProfile({ avatar: '' });
      onUpdateUser(res.user);
      setMsg('Profile photo removed');
      setTimeout(() => setMsg(null), 2500);
    } catch (err: any) {
      setMsg('Failed to remove photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">Your Profile</h2>
              <p className="text-xs text-slate-400">Manage your account & profile picture</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          {msg && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs text-center">
              {msg}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer"
              title="Click to upload profile picture"
            >
              <Avatar
                src={currentUser.avatar}
                name={currentUser.displayName}
                size="xl"
                className="border-2 border-blue-500/50 shadow-lg group-hover:opacity-80 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                <Camera className="w-6 h-6 mb-1 text-blue-400" />
                <span className="text-[10px] font-semibold">Change Photo</span>
              </div>
            </div>

            {/* Upload & Remove Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Picture'}</span>
              </button>

              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Email Box */}
            <div className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between mt-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Registered Email ID</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status Message</label>
            <input
              type="text"
              value={statusMessage}
              placeholder="e.g. Available for chat | Ping me"
              onChange={(e) => setStatusMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            {loading ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};
