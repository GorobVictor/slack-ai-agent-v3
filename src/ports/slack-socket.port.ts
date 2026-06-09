export interface SlackSocketPort {
  onMessage(handler: (event: unknown) => Promise<void>): void;
  start(): Promise<void>;
}
