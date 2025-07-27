import { NextRequest } from "next/server";
import { Logger } from "@/lib/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyPassword, getPasswordFromAuth } from "@/lib/auth";

interface Folder {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface FileRecord {
  id: string;
  folderId: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const method = "POST";
  const url = request.url;

  try {
    const { id: folderId } = await params;
    Logger.request(method, url, `Uploading file to folder ${folderId}`);

    const password = getPasswordFromAuth(request.headers.get("Authorization"));
    if (!password) {
      Logger.warn({
        method,
        url,
        folderId,
        message: "Unauthorized upload attempt - no password provided",
        statusCode: 401,
      });
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { env } = getCloudflareContext();
    // Verify folder access
    const folderData = await env.FOLDERS_KV.get(`folder:${folderId}`);
    if (!folderData) {
      Logger.warn({
        method,
        url,
        folderId,
        message: "Folder not found for upload",
        statusCode: 404,
      });
      return Response.json(
        { success: false, error: "Folder not found" },
        { status: 404 }
      );
    }

    const folder: Folder = JSON.parse(folderData);
    const isValid = await verifyPassword(password, folder.passwordHash);

    if (!isValid) {
      Logger.warn({
        method,
        url,
        folderId,
        message: "Invalid password for file upload",
        statusCode: 401,
      });
      return Response.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      Logger.warn({
        method,
        url,
        folderId,
        message: "No file provided in upload request",
        statusCode: 400,
      });
      return Response.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const fileId = generateId();
    const fileKey = `${folderId}/${fileId}-${file.name}`;

    Logger.debug({
      method,
      url,
      folderId,
      fileId,
      message: `Uploading file ${file.name} (${file.size} bytes)`,
    });

    // Upload to R2
    await env.FILES_BUCKET.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Create file record
    const fileRecord: FileRecord = {
      id: fileId,
      folderId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url: `/api/files/${fileId}`,
      createdAt: new Date().toISOString(),
    };

    // Update files list
    const filesData = await env.FOLDERS_KV.get(`files:${folderId}`);
    const files: FileRecord[] = filesData ? JSON.parse(filesData) : [];
    files.push(fileRecord);
    await env.FOLDERS_KV.put(`files:${folderId}`, JSON.stringify(files));

    // Store file metadata for retrieval
    await env.FOLDERS_KV.put(
      `file:${fileId}`,
      JSON.stringify({
        ...fileRecord,
        key: fileKey,
        folderId,
      })
    );

    const duration = Date.now() - startTime;
    Logger.response(
      method,
      url,
      200,
      duration,
      `File '${file.name}' uploaded successfully`
    );

    return Response.json({
      success: true,
      data: fileRecord,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error({
      method,
      url,
      message: "Failed to upload file",
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration,
    });
    return Response.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
