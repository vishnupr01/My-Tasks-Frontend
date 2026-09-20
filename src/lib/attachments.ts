import type { AttachmentType } from '@/types';

// Short text stand-in for an attachment-only message (no caption) --
// used anywhere a message needs to be summarized as plain text, like a
// notification toast, since there's no image/audio to actually show there.
export function attachmentLabel(type?: AttachmentType): string {
  switch (type) {
    case 'image': return '[image]';
    case 'video': return '[video]';
    case 'audio': return '[voice message]';
    default: return '[attachment]';
  }
}

export function messagePreview(content: string | undefined, attachmentType: AttachmentType | undefined): string {
  return content || attachmentLabel(attachmentType);
}
