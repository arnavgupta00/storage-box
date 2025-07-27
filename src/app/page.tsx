'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Folder, HardDrive, Lock, Plus, Search, Calendar } from 'lucide-react'

interface FolderInfo {
  id: string;
  name: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [isAccessing, setIsAccessing] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [password, setPassword] = useState('')
  const [folderId, setFolderId] = useState('')
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [accessPassword, setAccessPassword] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(null)

  useEffect(() => {
    fetchFolders()
  }, [])

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders')
      const data = await res.json() as { success: boolean; data: FolderInfo[] }
      if (data.success) {
        setFolders(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }

  const createFolder = async () => {
    if (!folderName || !password) {
      toast({
        title: "Error",
        description: "Please enter folder name and password",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, password })
      })

      const data = await res.json() as any
      
      if (data.success) {
        setIsCreating(false)
        setFolderName('')
        setPassword('')
        fetchFolders()
        router.push(`/folder/${data.data.id}?pwd=${password}`)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create folder",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive"
      })
    }
  }

  const accessFolder = async () => {
    if (!folderId || !password) {
      toast({
        title: "Error",
        description: "Please enter folder ID and password",
        variant: "destructive"
      })
      return
    }

    router.push(`/folder/${folderId}?pwd=${password}`)
  }

  const accessExistingFolder = async (folder: FolderInfo) => {
    if (!accessPassword) {
      toast({
        title: "Error",
        description: "Please enter the folder password",
        variant: "destructive"
      })
      return
    }

    router.push(`/folder/${folder.id}?pwd=${accessPassword}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full mx-auto text-center space-y-8">
        <div className="space-y-4">
          <HardDrive className="w-16 h-16 mx-auto text-primary" />
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            SecureDrive
          </h1>
          <p className="text-xl text-muted-foreground">
            Password-protected cloud storage without accounts
          </p>
        </div>

        {!loading && folders.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Available Folders</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <div key={folder.id} className="bg-card border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary" />
                    <h3 className="font-medium truncate">{folder.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(folder.createdAt).toLocaleDateString()}
                  </div>
                  <Dialog onOpenChange={(open) => {
                    if (!open) {
                      setAccessPassword('')
                      setSelectedFolder(null)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => setSelectedFolder(folder)}
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Access Folder
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Access {folder.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">
                          Enter the password for "{folder.name}" to access its contents.
                        </p>
                        <Input
                          type="password"
                          placeholder="Folder password"
                          value={accessPassword}
                          onChange={(e) => setAccessPassword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              accessExistingFolder(folder)
                            }
                          }}
                        />
                        <Button 
                          onClick={() => accessExistingFolder(folder)} 
                          className="w-full"
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Open Folder
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-12">
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-32 text-lg flex flex-col gap-3">
                <Plus className="w-8 h-8" />
                Create New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Folder name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button onClick={createFolder} className="w-full">
                  <Lock className="w-4 h-4 mr-2" />
                  Create Secure Folder
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAccessing} onOpenChange={setIsAccessing}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="h-32 text-lg flex flex-col gap-3">
                <Folder className="w-8 h-8" />
                Access Existing Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Access Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Folder ID"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button onClick={accessFolder} className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Access Folder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-16 p-6 bg-card rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="space-y-2">
              <div className="text-3xl">🔐</div>
              <h3 className="font-semibold">Create Folder</h3>
              <p className="text-sm text-muted-foreground">
                Set a password when creating a folder. This becomes the only key to access it.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">📤</div>
              <h3 className="font-semibold">Upload Files</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop files or click to upload. Preview images and videos directly.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">🔗</div>
              <h3 className="font-semibold">Share Access</h3>
              <p className="text-sm text-muted-foreground">
                Share the folder ID and password with anyone who needs access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
