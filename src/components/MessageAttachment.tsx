import { PaperclipIcon } from '@/components/Icons';
import VoiceMessagePlayer from '@/components/VoiceMessagePlayer';
import type { AttachmentType } from '@/types';

interface MessageAttachmentProps {
  url: string;
  type?: AttachmentType;
  name?: string;
  timestamp?: string;
  duration?: number;
}

export default function MessageAttachment({ url, type, name, timestamp, duration }: MessageAttachmentProps) {
  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- external, user-uploaded, arbitrary dimensions */}
        <img
          src={url}
          alt={name || 'image attachment'}
          className="max-w-full max-h-64 rounded-sm border border-green-900/40 object-cover"
        />
      </a>
    );
  }

  if (type === 'video') {
    return (
      <video controls src={url} className="max-w-full max-h-64 rounded-sm border border-green-900/40 mt-1.5" />
    );
  }

  if (type === 'audio') {
    return <VoiceMessagePlayer url={url} timestamp={timestamp} knownDuration={duration} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1.5 px-2.5 py-2 border border-green-900/40 rounded-sm hover:border-green-700/60 transition-colors text-xs text-green-400"
    >
      <PaperclipIcon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{name || 'attachment'}</span>
    </a>
  );
}
