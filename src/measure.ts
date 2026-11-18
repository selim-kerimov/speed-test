export interface RequestResult {
  bytes: number;
  durationMs: number;
  /** True when the server compressed the body despite "identity": `bytes` are then decompressed bytes. */
  compressed?: boolean;
}

/** Called after headers arrive (with 0 bytes) and after every received chunk. */
export type ProgressCallback = (bytes: number, totalBytes: number | undefined) => void;

/** Downloads the full response body once and measures how long it took. */
export async function measureRequest(
  url: string,
  timeoutMs: number,
  onProgress?: ProgressCallback,
): Promise<RequestResult> {
  try {
    return await download(url, timeoutMs, onProgress);
  } catch (error) {
    // The original TimeoutError message doesn't say which limit was hit.
    if (error instanceof Error && error.name === "TimeoutError") {
      // oxlint-disable-next-line preserve-caught-error
      throw new Error(`request timed out after ${timeoutMs} ms`);
    }
    throw error;
  }
}

async function download(
  url: string,
  timeoutMs: number,
  onProgress?: ProgressCallback,
): Promise<RequestResult> {
  const start = performance.now();

  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      // Count the bytes that actually travel over the network.
      "Accept-Encoding": "identity",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  // Some servers compress anyway. fetch() decompresses the body, so Content-Length
  // (the compressed size) no longer matches the bytes we count.
  const encoding = response.headers.get("content-encoding")?.toLowerCase();
  const compressed = encoding !== undefined && encoding !== "identity";

  const contentLength = Number(response.headers.get("content-length"));
  const totalBytes = !compressed && contentLength > 0 ? contentLength : undefined;
  onProgress?.(0, totalBytes);

  let bytes = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      onProgress?.(bytes, totalBytes);
    }
  }

  return { bytes, durationMs: performance.now() - start, compressed };
}
