import { NextRequest } from 'next/server'
import { Logger } from '@/lib/logger'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { verifyPassword, getPasswordFromAuth } from '@/lib/auth'
import { folderCache, fileCache } from '@/lib/cache'


interface Folder {
  id: string
  name: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

interface FileRecord {
  id: string
  folderId: string
  name: string
  size: number
  mimeType: string
  url: string
  createdAt: string
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  const method = 'GET'
  const url = request.url
  
  try {
    const { id: folderId } = await params
    Logger.request(method, url, `Retrieving folder ${folderId}`)
    
    const password = getPasswordFromAuth(request.headers.get('Authorization'))
    if (!password) {
      Logger.warn({ 
        method, 
        url, 
        folderId, 
        message: 'Unauthorized folder access - no password provided',
        statusCode: 401
      })
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { env } = getCloudflareContext()
    
    // Check cache first
    let folderData = folderCache.get(`folder:${folderId}`)
    if (!folderData) {
      const kvData = await env.FOLDERS_KV.get(`folder:${folderId}`)
      if (!kvData) {
        Logger.warn({ 
          method, 
          url, 
          folderId, 
          message: 'Folder not found',
          statusCode: 404
        })
        return Response.json({ success: false, error: 'Folder not found' }, { status: 404 })
      }
      folderData = kvData
      folderCache.set(`folder:${folderId}`, folderData)
    }

    const folder: Folder = JSON.parse(folderData)
    const isValid = await verifyPassword(password, folder.passwordHash)

    if (!isValid) {
      Logger.warn({ 
        method, 
        url, 
        folderId, 
        message: 'Invalid password for folder access',
        statusCode: 401
      })
      return Response.json({ success: false, error: 'Invalid password' }, { status: 401 })
    }

    // Get files with caching
    let filesData = fileCache.get(`files:${folderId}`)
    if (!filesData) {
      const kvFilesData = await env.FOLDERS_KV.get(`files:${folderId}`)
      filesData = kvFilesData || '[]'
      fileCache.set(`files:${folderId}`, filesData)
    }
    const files: FileRecord[] = JSON.parse(filesData)

    // Add pagination support
    const url_obj = new URL(request.url)
    const page = parseInt(url_obj.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url_obj.searchParams.get('limit') || '20'), 50) // Max 50 items
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedFiles = files.slice(startIndex, endIndex)

    const duration = Date.now() - startTime
    Logger.response(method, url, 200, duration, `Folder retrieved with ${paginatedFiles.length}/${files.length} files`)

    return Response.json({
      success: true,
      data: {
        folder: { ...folder, passwordHash: undefined },
        files: paginatedFiles,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(files.length / limit),
          totalFiles: files.length,
          hasNext: endIndex < files.length,
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    Logger.error({ 
      method, 
      url, 
      message: 'Failed to get folder',
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration
    })
    return Response.json({ success: false, error: 'Failed to get folder' }, { status: 500 })
  }
}