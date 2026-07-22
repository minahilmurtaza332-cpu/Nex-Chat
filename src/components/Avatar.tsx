import React, { useState } from 'react';
import { Users } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isGroup?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  isGroup = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-24 h-24 text-3xl',
  };

  const initial = name ? name.trim().charAt(0).toUpperCase() : 'U';
  const baseSize = sizeClasses[size] || 'w-10 h-10 text-sm';

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`${baseSize} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  if (isGroup) {
    return (
      <div
        className={`${baseSize} rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-bold shrink-0 ${className}`}
      >
        <Users className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`${baseSize} rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold shrink-0 uppercase select-none ${className}`}
    >
      {initial}
    </div>
  );
};
