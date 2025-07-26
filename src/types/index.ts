export interface Folder {
  id: string
  name: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface File {
  id: string
  folderId: string
  name: string
  size: number
  mimeType: string
  url: string
  createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}