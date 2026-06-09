export interface TrackedThreadStorePort {
  hasThread(key: string): Promise<boolean>;
  addThread(key: string): Promise<void>;
}
