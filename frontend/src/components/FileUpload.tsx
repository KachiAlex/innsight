import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onUploadComplete: (urls: string[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  multiple?: boolean;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  url?: string;
  error?: string;
}

export default function FileUpload({
  onUploadComplete,
  maxFiles = 10,
  maxSizeMB = 5,
  accept = 'image/*',
  multiple = true,
}: FileUploadProps) {
  const { user } = useAuthStore();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file size and type
    const validFiles: UploadedFile[] = [];
    selectedFiles.forEach((file) => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      validFiles.push({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
      });
    });

    setFiles([...files, ...validFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      // Upload files one by one (or use FormData for multiple)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.url) {
          uploadedUrls.push(file.url);
          continue;
        }

        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], uploading: true };
          return updated;
        });

        const formData = new FormData();
        formData.append('file', file.file);

        const response = await api.post(
          `/tenants/${user?.tenantId}/upload`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        // Use the full URL from the API response
        const fileUrl = response.data.data.url;
        // If URL is relative, prepend API base URL
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${(import.meta as any).env?.VITE_API_URL || '/api'}${fileUrl}`;
        uploadedUrls.push(fullUrl);

        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], uploading: false, url: fileUrl };
          return updated;
        });
      }

      toast.success(`${uploadedUrls.length} file(s) uploaded successfully`);
      onUploadComplete(uploadedUrls);
    } catch (error: any) {
      toast.error('Failed to upload files');
      setFiles((prev) =>
        prev.map((f) => ({ ...f, uploading: false, error: 'Upload failed' }))
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          background: '#f8fafc',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#3b82f6';
          e.currentTarget.style.background = '#eff6ff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#cbd5e1';
          e.currentTarget.style.background = '#f8fafc';
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <Upload size={32} style={{ color: '#64748b', margin: '0 auto 0.5rem' }} />
        <p style={{ color: '#475569', marginBottom: '0.25rem' }}>
          Click to upload or drag and drop
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          {accept} (Max {maxSizeMB}MB per file, {maxFiles} files max)
        </p>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                }}
              >
                {file.uploading ? (
                  <div
                    style={{
                      width: '100%',
                      paddingTop: '100%',
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#64748b',
                      }}
                    >
                      Uploading...
                    </div>
                  </div>
                ) : (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}
                <button
                  onClick={() => removeFile(index)}
                  disabled={file.uploading}
                  style={{
                    position: 'absolute',
                    top: '0.25rem',
                    right: '0.25rem',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: file.uploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
                {file.error && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      fontSize: '0.75rem',
                      padding: '0.25rem',
                      textAlign: 'center',
                    }}
                  >
                    {file.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={uploadFiles}
            disabled={uploading || files.every((f) => f.uploading || f.url)}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: uploading ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              width: '100%',
            }}
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} file(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

