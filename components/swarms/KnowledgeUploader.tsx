"use client";

import { useState, useRef, useCallback } from "react";

interface KnowledgeUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  uploadedAt: Date;
}

const SUPPORTED_TYPES = {
  "text/plain": { ext: ".txt", icon: "📄" },
  "text/markdown": { ext: ".md", icon: "📝" },
  "application/json": { ext: ".json", icon: "📋" },
  "text/csv": { ext: ".csv", icon: "📊" },
  "application/pdf": { ext: ".pdf", icon: "📕" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: ".docx",
    icon: "📘",
  },
};

export default function KnowledgeUploader({
  files,
  onChange,
  maxFiles = 10,
  maxSizeMB = 5,
}: KnowledgeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File): Promise<UploadedFile | null> => {
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File "${file.name}" exceeds ${maxSizeMB}MB limit`);
      return null;
    }

    // Check if type is supported
    const typeInfo = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
    if (!typeInfo && !file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setError(`File type "${file.type || "unknown"}" not supported`);
      return null;
    }

    try {
      let content = "";

      if (file.type === "application/pdf") {
        // For PDF, we'd normally use a PDF parser
        // For now, just store a placeholder indicating PDF was uploaded
        content = `[PDF Document: ${file.name}]\n\nThis PDF requires processing. Size: ${(file.size / 1024).toFixed(1)}KB`;
      } else {
        // Read text-based files directly
        content = await file.text();
      }

      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type || "text/plain",
        content,
        uploadedAt: new Date(),
      };
    } catch (err) {
      console.error("Error processing file:", err);
      setError(`Failed to process "${file.name}"`);
      return null;
    }
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    setError(null);
    setProcessing(true);

    const filesArray = Array.from(fileList);

    // Check max files limit
    if (files.length + filesArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      setProcessing(false);
      return;
    }

    const newFiles: UploadedFile[] = [];

    for (const file of filesArray) {
      const processed = await processFile(file);
      if (processed) {
        newFiles.push(processed);
      }
    }

    if (newFiles.length > 0) {
      onChange([...files, ...newFiles]);
    }

    setProcessing(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [files, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string, name: string): string => {
    if (name.endsWith(".md")) return "📝";
    const typeInfo = SUPPORTED_TYPES[type as keyof typeof SUPPORTED_TYPES];
    return typeInfo?.icon || "📄";
  };

  const estimateTokens = (content: string): number => {
    return Math.ceil(content.length / 4);
  };

  const totalTokens = files.reduce(
    (sum, f) => sum + estimateTokens(f.content),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <label className="text-sm text-zinc-400">Knowledge Sources</label>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">
            {files.length}/{maxFiles} files
          </span>
          {totalTokens > 0 && (
            <span className="text-xs text-purple-400">
              ~{totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          isDragging
            ? "border-purple-500 bg-purple-500/10"
            : "border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          accept=".txt,.md,.json,.csv,.pdf,.docx"
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3 text-center">
          {processing ? (
            <>
              <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Processing files...</p>
            </>
          ) : (
            <>
              <div className="text-4xl">📁</div>
              <div>
                <p className="text-sm text-white font-medium">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports TXT, MD, JSON, CSV, PDF, DOCX (max {maxSizeMB}MB each)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <p className="text-purple-300 font-medium">Drop to upload</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Uploaded Files</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-zinc-900/50 border border-white/10 rounded-lg group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{getFileIcon(file.type, file.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatSize(file.size)} · ~{estimateTokens(file.content).toLocaleString()} tokens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Preview button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Could open a modal with file content
                      console.log("Preview:", file.content.substring(0, 500));
                    }}
                    className="p-2 text-zinc-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Preview"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context Mode Info */}
      {files.length > 0 && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-sm text-blue-300 font-medium mb-1">
            Full Context Mode
          </div>
          <div className="text-xs text-blue-200/70">
            All uploaded documents will be included in the agent&apos;s system prompt.
            For large documents, consider keeping total tokens under 100K for best performance.
          </div>
        </div>
      )}
    </div>
  );
}
