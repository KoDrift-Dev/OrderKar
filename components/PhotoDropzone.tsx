'use client';

// Drag-and-drop photo field: drop a file or click to browse. Auto-resizes and
// uploads to Supabase Storage, returns the public URL via onChange.

import { useRef, useState } from 'react';
import { cdnUrl, uploadPhoto } from '@/lib/images';

export default function PhotoDropzone({
  bucket,
  folder,
  value,
  onChange,
  onError,
  hint = 'JPG/PNG — auto-resized',
}: {
  bucket: 'menu-images' | 'staff-photos';
  folder: string;
  value: string;
  onChange: (url: string) => void;
  onError: (msg: string) => void;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handleFile = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPhoto(bucket, folder, file);
      onChange(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-[16px] border-2 border-dashed p-3 transition-all ${
          dragging ? 'border-brand bg-brand-soft scale-[1.01]' : 'border-line bg-soft/50 hover:border-brand/50'
        }`}
      >
        {uploading ? (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] bg-soft text-[22px]">
            <span className="animate-spin">⏳</span>
          </div>
        ) : value ? (
          <img src={cdnUrl(value)} alt="" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" />
        ) : (
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] text-[26px] transition-all ${
              dragging ? 'bg-brand text-white' : 'bg-soft text-muted'
            }`}
          >
            {dragging ? '⬇' : '🖼️'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13.5px] font-extrabold text-ink">
            {uploading ? 'Uploading…' : dragging ? 'Drop to upload' : value ? 'Drag new or click to change' : 'Drag photo here or click to browse'}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p>
        </div>
      </div>
      {value && !uploading && (
        <button type="button" onClick={() => onChange('')} className="mt-1.5 text-[12px] font-bold text-danger">
          Remove photo
        </button>
      )}
    </div>
  );
}
