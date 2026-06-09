export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const leftHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(left)));
  const rightHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(right)));

  let diff = leftHash.length ^ rightHash.length;
  const length = Math.max(leftHash.length, rightHash.length);

  for (let index = 0; index < length; index += 1) {
    diff |= (leftHash[index] ?? 0) ^ (rightHash[index] ?? 0);
  }

  return diff === 0;
}
