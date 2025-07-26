import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { Logger } from '@/lib/logger'
import { getCloudflareContext } from '@opennextjs/cloudflare'


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

function getPasswordFromAuth(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return null
  }
  return auth.substring(7)
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
    
    const password = getPasswordFromAuth(request)
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
    
    const folderData = await env.FOLDERS_KV.get(`folder:${folderId}`)
    if (!folderData) {
      Logger.warn({ 
        method, 
        url, 
        folderId, 
        message: 'Folder not found',
        statusCode: 404
      })
      return Response.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    const folder: Folder = JSON.parse(folderData)
    const isValid = await bcrypt.compare(password, folder.passwordHash)

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

    // Get files
    const filesData = await env.FOLDERS_KV.get(`files:${folderId}`)
    const files: FileRecord[] = filesData ? JSON.parse(filesData) : []

    const duration = Date.now() - startTime
    Logger.response(method, url, 200, duration, `Folder retrieved with ${files.length} files`)

    return Response.json({
      success: true,
      data: {
        folder: { ...folder, passwordHash: undefined },
        files
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