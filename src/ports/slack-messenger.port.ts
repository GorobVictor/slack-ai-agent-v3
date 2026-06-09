export type SendSlackMessageInput = {
  channelId: string;
  threadTs: string;
  text: string;
};

export type SendSlackMessageResult = {
  messageTs: string;
};

export interface SlackMessengerPort {
  sendMessage(input: SendSlackMessageInput): Promise<SendSlackMessageResult>;
}
