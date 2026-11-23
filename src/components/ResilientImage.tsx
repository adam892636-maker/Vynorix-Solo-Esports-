import { useState } from 'react';
import { Trophy } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackTitle = 'Vynorix Arena',
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#161D29] via-[#11161F] to-[#090C10] border border-slate-800/80 text-slate-400 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Trophy className="w-8 h-8 text-orange-500/80 mb-2" />
        <span className="text-xs font-medium text-slate-300 text-center">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
