import { NextRequest } from "next/server";
import { Logger } from "@/lib/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Folder {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = "GET";
  const url = request.url;

  try {
    Logger.request(method, url, "Retrieving all folders");

    const { env } = getCloudflareContext();
    
    // List all folder keys
    const foldersList = await env.FOLDERS_KV.list({ prefix: "folder:" });
    const folders: Array<{ id: string; name: string; createdAt: string }> = [];

    for (const key of foldersList.keys) {
      const folderData = await env.FOLDERS_KV.get(key.name);
      if (folderData) {
        const folder: Folder = JSON.parse(folderData);
        folders.push({
          id: folder.id,
          name: folder.name,
          createdAt: folder.createdAt,
        });
      }
    }

    // Sort by creation date (newest first)
    folders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const duration = Date.now() - startTime;
    Logger.response(
      method,
      url,
      200,
      duration,
      `Retrieved ${folders.length} folders`
    );

    return Response.json({ success: true, data: folders });
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.error({
      method,
      url,
      message: "Failed to get folders",
      error: error instanceof Error ? error.message : String(error),
      statusCode: 500,
      duration,
    });
    return Response.json(
      { success: false, error: "Failed to get folders" },
      { status: 500 }
    );
  }
}