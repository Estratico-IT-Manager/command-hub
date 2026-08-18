import { google } from "googleapis";
import { env } from "./env";

function driveClient() {
  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Google Drive is not configured (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY missing)");
  }

  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

export function drivePublicUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export async function uploadToDrive(input: {
  fileName: string;
  mimeType: string;
  body: Buffer;
}): Promise<{ fileId: string; url: string; size: number }> {
  if (!env.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error("Google Drive folder is not configured (GOOGLE_DRIVE_FOLDER_ID missing)");
  }

  const drive = driveClient();

  const res = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: input.mimeType,
      body: input.body,
    },
    fields: "id,size",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Drive upload failed: no file id returned");

  await drive.permissions.create({
    fileId,
    requestBody: { type: "anyone", role: "reader" },
  });

  return {
    fileId,
    url: drivePublicUrl(fileId),
    size: Number(res.data.size ?? input.body.length),
  };
}