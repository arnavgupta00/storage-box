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


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const method = "GET";
  const url = request.url;

  try {
    const { id: fileId } = await params;
    Logger.request(method, url, `Retrieving file ${fileId}`);

    const { env } = getCloudflareContext();
    // Get file metadata
    const fileData = await env.FOLDERS_KV.get(`file:${fileId}`);
    if (!fileData) {
      Logger.warn({
        method,
        url,
        fileId,
        message: "File metadata not found",
        statusCode: 404,
      });
      return new Response("File not found", { status: 404 });
    }

    const fileInfo = JSON.parse(fileData);
    const { key, mimeType, name } = fileInfo;

    // Get file from R2
    const object = await env.FILES_BUCKET.get(key);
    if (!object) {
      Logger.error({
        method,
        url,
        fileId,
        message: "File not found in R2 storage",
        statusCode: 404,
      });
      return new Response("File not found", { status: 404 });
    }

    // Handle range requests for large files (video streaming)
    const range = request.headers.get("range");
    const size = object.size;
    
    if (range) {
      const ranges = range.replace(/bytes=/, "").split("-");
      const start = parseInt(ranges[0], 10);
      const end = ranges[1] ? parseInt(ranges[1], 10) : size - 1;
      const chunkSize = (end - start) + 1;
      
      // Get the specific range from R2
      const rangeObject = await env.FILES_BUCKET.get(key, {
        range: { offset: start, length: chunkSize }
      });
      
      if (!rangeObject) {
        Logger.error({
          method,
          url,
          fileId,
          message: "Failed to get range from R2 storage",
          statusCode: 416,
        });
        return new Response("Range not satisfiable", { status: 416 });
      }
      
      const headers = new Headers({
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "public, max-age=3600",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": chunkSize.toString(),
      });

      const duration = Date.now() - startTime;
      Logger.response(
        method,
        url,
        206,
        duration,
        `File ${name} partial content served (${start}-${end}/${size})`
      );

      return new Response(rangeObject.body, { status: 206, headers });
    }

    // For non-range requests, still support Accept-Ranges for future range requests
    const headers = new Headers({
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
      "Content-Length": size.toString(),
    });

    const duration = Date.now() - startTime;
    Logger.response(
      method,
      url,
      200,
      duration,
      `File ${name} served successfully`
    );

    return new Response(object.body, { headers });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error({
      method,
      url,
      message: "Failed to get file",
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration,
    });
    return new Response("Failed to get file", { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const method = "DELETE";
  const url = request.url;

  try {
    const { id: fileId } = await params;
    Logger.request(method, url, `Deleting file ${fileId}`);

    const password = getPasswordFromAuth(request.headers.get("Authorization"));
    if (!password) {
      Logger.warn({
        method,
        url,
        fileId,
        message: "Unauthorized delete attempt - no password provided",
        statusCode: 401,
      });
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { env } = getCloudflareContext();
    // Get file metadata
    const fileData = await env.FOLDERS_KV.get(`file:${fileId}`);
    if (!fileData) {
      Logger.warn({
        method,
        url,
        fileId,
        message: "File metadata not found for deletion",
        statusCode: 404,
      });
      return Response.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    const fileInfo = JSON.parse(fileData);
    const { folderId, key } = fileInfo;

    // Verify folder access
    const folderData = await env.FOLDERS_KV.get(`folder:${folderId}`);
    if (!folderData) {
      Logger.warn({
        method,
        url,
        fileId,
        folderId,
        message: "Folder not found for file deletion",
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
        fileId,
        folderId,
        message: "Invalid password for file deletion",
        statusCode: 401,
      });
      return Response.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    // Delete from R2
    await env.FILES_BUCKET.delete(key);
    Logger.debug({
      method,
      url,
      fileId,
      folderId,
      message: "File deleted from R2 storage",
    });

    // Update files list
    const filesData = await env.FOLDERS_KV.get(`files:${folderId}`);
    const files: FileRecord[] = filesData ? JSON.parse(filesData) : [];
    const updatedFiles = files.filter((f) => f.id !== fileId);
    await env.FOLDERS_KV.put(`files:${folderId}`, JSON.stringify(updatedFiles));

    // Delete file metadata
    await env.FOLDERS_KV.delete(`file:${fileId}`);

    const duration = Date.now() - startTime;
    Logger.response(method, url, 200, duration, `File deleted successfully`);

    return Response.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error({
      method,
      url,
      message: "Failed to delete file",
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration,
    });
    return Response.json(
      { success: false, error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
