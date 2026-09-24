import { promises as fs } from "node:fs";
import type { ConvexHttpClient } from "convex/browser";
import { refs } from "./convex.js";

/** Upload a local file to Convex storage; returns the storageId. */
export async function uploadFile(
  client: ConvexHttpClient,
  secret: string,
  filePath: string,
  contentType: string,
): Promise<string> {
  const uploadUrl = await client.mutation(refs.generateUploadUrl, { secret });
  const data = await fs.readFile(filePath);
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: data,
  });
  if (!res.ok) {
    throw new Error(`upload failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { storageId: string };
  return json.storageId;
}
