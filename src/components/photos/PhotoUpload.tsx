'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PHOTO_ALLOWED_TYPES, PHOTO_MAX_SIZE_MB } from '@/lib/constants';

interface PhotoUploadProps {
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function PhotoUpload({ onUploadComplete }: PhotoUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadFile[] = Array.from(newFiles)
      .filter((f) => PHOTO_ALLOWED_TYPES.includes(f.type as typeof PHOTO_ALLOWED_TYPES[number]))
      .filter((f) => f.size <= PHOTO_MAX_SIZE_MB * 1024 * 1024)
      .map((file) => ({ file, progress: 0, status: 'pending' as const }));

    setFiles((prev) => [...prev, ...validFiles]);

    // Upload each file
    for (const uf of validFiles) {
      uploadFile(uf.file);
    }
  }, []);

  const uploadFile = async (file: File) => {
    setFiles((prev) =>
      prev.map((f) => (f.file === file ? { ...f, status: 'uploading' as const } : f))
    );

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/photos', { method: 'POST', body: formData });

      if (!response.ok) throw new Error('Upload failed');

      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: 'done' as const, progress: 100 } : f
        )
      );
      onUploadComplete();
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: 'error' as const, error: 'Upload failed' } : f
        )
      );
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
        onClick={() => document.getElementById('photo-file-input')?.click()}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Drag & drop photos here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP up to {PHOTO_MAX_SIZE_MB}MB
        </p>
        <input
          id="photo-file-input"
          type="file"
          multiple
          accept={PHOTO_ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{uf.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uf.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              {uf.status === 'uploading' && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
              )}
              {uf.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {uf.status === 'error' && (
                <span className="text-xs text-destructive">{uf.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
