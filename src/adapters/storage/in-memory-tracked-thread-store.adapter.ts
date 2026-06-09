import type { TrackedThreadStorePort } from "../../ports/tracked-thread-store.port.js";

export class InMemoryTrackedThreadStoreAdapter implements TrackedThreadStorePort {
  // TODO: For production multi-instance listener deployments, move tracked threads to persistent/shared storage.
  private readonly threads = new Set<string>();

  async hasThread(key: string): Promise<boolean> {
    return this.threads.has(key);
  }

  async addThread(key: string): Promise<void> {
    this.threads.add(key);
  }
}
