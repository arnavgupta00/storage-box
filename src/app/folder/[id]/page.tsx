'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { formatBytes, getFileIcon } from '@/lib/utils'
import type { File as FileType, Folder } from '@/types'
import {
  Download,
  Trash2,
  Upload,
  Eye,
  X,
  FolderOpen,
  Link,
  Copy,
  Home
} from 'lucide-react'

export default function FolderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const folderId = params.id as string
  const password = searchParams.get('pwd')

  const [folder, setFolder] = useState<Folder | null>(null)
  const [files, setFiles] = useState<FileType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)

  const loadFolder = async () => {
    if (!password) {
      router.push('/')
      return
    }

    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      })

      const data = await res.json() as any

      if (data.success) {
        setFolder(data.data.folder)
        setFiles(data.data.files)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load folder",
          variant: "destructive"
        })
        router.push('/')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load folder",
        variant: "destructive"
      })
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFolder()
  }, [folderId, password])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    setUploadProgress(0)

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`/api/folders/${folderId}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${password}`
          },
          body: formData
        })

        const data = await res.json() as any

        if (data.success) {
          setFiles(prev => [...prev, data.data])
          toast({
            title: "Success",
            description: `${file.name} uploaded successfully`
          })
        } else {
          toast({
            title: "Error",
            description: `Failed to upload ${file.name}`,
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        })
      }

      setUploadProgress(((i + 1) / acceptedFiles.length) * 100)
    }

    setUploading(false)
    setUploadProgress(0)
  }, [folderId, password])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const deleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${password}`
        }
      })

      const data = await res.json() as any

      if (data.success) {
        setFiles(prev => prev.filter(f => f.id !== fileId))
        toast({
          title: "Success",
          description: "File deleted successfully"
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete file",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      })
    }
  }

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/folder/${folderId}`
    navigator.clipboard.writeText(shareUrl)
    toast({
      title: "Link Copied",
      description: "Share this link along with the password"
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FolderOpen className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading folder...</p>
        </div>
      </div>
    )
  }

  if (!folder) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
            >
              <Home className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{folder.name}</h1>
              <p className="text-sm text-muted-foreground">
                ID: {folderId} • {files.length} files
              </p>
            </div>
          </div>
          <Button onClick={copyShareLink} variant="outline">
            <Link className="w-4 h-4 mr-2" />
            Copy Share Link
          </Button>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            or click to browse files
          </p>
        </div>

        {uploading && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Uploading files...</p>
            <Progress value={uploadProgress} />
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedFile(file)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(file.url, '_blank')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteFile(file.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {files.length === 0 && !uploading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No files yet. Upload some files to get started!</p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <Button
            className="absolute top-4 right-4"
            size="icon"
            variant="ghost"
            onClick={() => setSelectedFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="max-w-4xl max-h-full">
            {selectedFile.mimeType.startsWith('image/') ? (
              <img
                src={selectedFile.url}
                alt={selectedFile.name}
                className="max-w-full max-h-full object-contain"
              />
            ) : selectedFile.mimeType.startsWith('video/') ? (
              <video
                src={selectedFile.url}
                controls
                className="max-w-full max-h-full"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}