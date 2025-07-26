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

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const method = 'POST'
  const url = request.url
  
  try {
    Logger.request(method, url, 'Creating new folder')
    
    const body = await request.json() as { name: string; password: string }
    const { name, password } = body

    if (!name || !password) {
      Logger.warn({ 
        method, 
        url, 
        message: 'Missing required fields for folder creation',
        statusCode: 400
      })
      return Response.json({ success: false, error: 'Name and password required' }, { status: 400 })
    }

    const folderId = generateId()
    const passwordHash = await bcrypt.hash(password, 10)

    const folder: Folder = {
      id: folderId,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Note: You'll need to configure Cloudflare bindings for KV storage
    // This will work when deployed to Cloudflare but needs environment setup
    const { env } = getCloudflareContext()
    await env.FOLDERS_KV.put(`folder:${folderId}`, JSON.stringify(folder))

    const duration = Date.now() - startTime
    Logger.response(method, url, 200, duration, `Folder '${name}' created successfully`)

    return Response.json({
      success: true,
      data: { id: folderId, name }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    Logger.error({ 
      method, 
      url, 
      message: 'Failed to create folder',
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration
    })
    return Response.json({ success: false, error: 'Failed to create folder' }, { status: 500 })
  }
}