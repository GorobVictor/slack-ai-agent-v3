export type SendSlackMessageInput = {
  channelId: string;
  threadTs: string;
  text: string;
};

export interface SlackMessengerPort {
  sendMessage(input: SendSlackMessageInput): Promise<void>;
}
