import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  MicOff,
  Image as ImageIcon,
  MoreVertical,
  ArrowLeft,
  Check,
  CheckCheck,
  Heart,
  ThumbsUp,
  Flame,
  Volume2,
  Play,
  Pause,
  X,
  FileText,
  Users,
} from 'lucide-react';
import { Chat, Message, User as UserType } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';

interface ChatAreaProps {
  chat: Chat;
  currentUser: UserType;
  messages: Message[];
  typingUsers: string[];
  onBackMobile?: () => void;
  onSendMessage: (content: string, attachments?: any[]) => void;
  onMessageReaction: (messageId: string, emoji: string) => void;
}

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏', '🙏', '✨'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  currentUser,
  messages,
  typingUsers,
  onBackMobile,
  onSendMessage,
  onMessageReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGroup = chat.type === 'group';
  const otherUser = isGroup ? null : chat.participants.find((p) => p.id !== currentUser.id);
  const title = isGroup ? chat.name : otherUser?.displayName || 'Chat';
  const subtitle = isGroup ? `${chat.participants.length} members` : otherUser?.email || '';
  const avatar = isGroup ? chat.avatar : otherUser?.avatar;

  const isOnline = isGroup ? false : otherUser?.isOnline;

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    wsClient.send('typing:start', { chatId: chat.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      wsClient.send('typing:stop', { chatId: chat.id });
    }, 2000);
  };

  const handleSend = () => {
    if (!inputText.trim() && attachments.length === 0) return;

    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachments([]);
    setShowEmojiPicker(false);
    wsClient.send('typing:stop', { chatId: chat.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  // Image Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url,
            name: file.name,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Voice Note Recording Simulation/Handler
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);

      // Create synthetic audio message note
      const mockAudioAttachment = {
        type: 'audio',
        url: 'https://cdn.freesound.org/previews/536/536108_11861866-lq.mp3', // sample voice note audio clip
        name: `Voice Note (${recordingDuration}s)`,
        duration: recordingDuration || 3,
      };

      setAttachments((prev) => [...prev, mockAudioAttachment]);
      setRecordingDuration(0);
    } else {
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <Avatar
              src={avatar}
              name={title}
              size="md"
              isGroup={isGroup}
              className="border border-slate-700"
            />
            {!isGroup && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>{title}</span>
              {!isGroup && otherUser && (
                <span className="text-[10px] font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  {otherUser.email}
                </span>
              )}
            </h3>

            <p className="text-xs text-slate-400">
              {typingUsers.length > 0 ? (
                <span className="text-blue-400 font-medium animate-pulse">
                  {typingUsers.join(', ')} is typing...
                </span>
              ) : isGroup ? (
                subtitle
              ) : isOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
              <Send className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-300 text-sm">Start your conversation</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Messages sent here are delivered in real-time via pure Email ID!
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;

            return (
              <div
                key={`${msg.id}_${index}`}
                className={`flex gap-3 max-w-[85%] md:max-w-[70%] group ${
                  isMe ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {/* Sender Avatar */}
                {!isMe && (
                  <Avatar
                    src={msg.senderAvatar}
                    name={msg.senderName}
                    size="sm"
                    className="mt-1 shrink-0"
                  />
                )}

                <div className="space-y-1">
                  {/* Sender Name in Groups */}
                  {!isMe && isGroup && (
                    <div className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5 px-1">
                      <span>{msg.senderName}</span>
                      <span className="text-[9px] text-slate-500">({msg.senderEmail})</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative p-3.5 rounded-2xl shadow-md text-sm leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {/* Attachment rendering */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {msg.attachments.map((att, idx) => {
                          if (att.type === 'image') {
                            return (
                              <img
                                key={idx}
                                src={att.url}
                                className="max-w-xs max-h-60 rounded-xl object-cover border border-slate-800"
                                alt="Attachment"
                              />
                            );
                          }
                          if (att.type === 'audio') {
                            const isPlaying = playingAudioId === `${msg.id}_${idx}`;
                            return (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => setPlayingAudioId(isPlaying ? null : `${msg.id}_${idx}`)}
                                  className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0"
                                >
                                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-200 truncate">{att.name}</div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div
                                      className={`h-full bg-blue-400 ${
                                        isPlaying ? 'animate-pulse w-2/3' : 'w-1/3'
                                      }`}
                                    />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0">0:03</span>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={idx}
                              className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs"
                            >
                              <FileText className="w-4 h-4 text-blue-400" />
                              <span className="truncate">{att.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    {/* Timestamp & Read Receipt */}
                    <div
                      className={`flex items-center gap-1 justify-end text-[10px] mt-1 ${
                        isMe ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMe && (
                        <span>
                          {msg.isReadBy && msg.isReadBy.length > 1 ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-blue-300" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Reaction Floating Bar on Hover */}
                    <div
                      className={`absolute -top-3 ${
                        isMe ? 'left-0' : 'right-0'
                      } opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5 flex gap-1 shadow-lg z-10`}
                    >
                      {COMMON_EMOJIS.slice(0, 5).map((e) => (
                        <button
                          key={e}
                          onClick={() => onMessageReaction(msg.id, e)}
                          className="hover:scale-125 transition-transform text-xs"
                        >
                          {e}
                        </button>
                      ))}
                    </div>

                    {/* Active Message Reactions Display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-slate-800/40">
                        {msg.reactions.map((r, i) => (
                          <span
                            key={i}
                            onClick={() => onMessageReaction(msg.id, r.emoji)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300 cursor-pointer hover:border-blue-500"
                            title={r.userName}
                          >
                            <span>{r.emoji}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Drawer */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="relative group shrink-0 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs"
            >
              {att.type === 'image' ? (
                <img src={att.url} className="w-10 h-10 rounded-lg object-cover" alt="" />
              ) : (
                <Volume2 className="w-5 h-5 text-blue-400" />
              )}
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button
                type="button"
                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Control Area */}
      <div className="p-3 bg-slate-900 border-t border-slate-800/80 shrink-0">
        <div className="relative flex items-center gap-2">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,audio/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Attach file or image"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji Picker Modal */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-50 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl grid grid-cols-5 gap-2 w-52">
                {COMMON_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleAddEmoji(e)}
                    className="p-1.5 text-lg hover:bg-slate-800 rounded-lg transition-transform hover:scale-125"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Note Record Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-2.5 rounded-xl transition-all ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record Voice Note'}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <textarea
            rows={1}
            placeholder={isRecording ? `Recording voice note... (${recordingDuration}s)` : 'Type a message...'}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isRecording}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none max-h-24"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() && attachments.length === 0}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
