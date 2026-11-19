/** Fetch may already decode Content-Encoding. Only decompress bytes with the gzip signature. */
export async function readGzipResponse(response: Response): Promise<ArrayBuffer> {
  const raw = await response.arrayBuffer();
  const head = new Uint8Array(raw, 0, Math.min(2, raw.byteLength));
  return head[0] === 0x1f && head[1] === 0x8b
    ? new Response(
        new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).arrayBuffer()
    : raw;
}
