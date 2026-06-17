export type SendSlackMessageInput = {
  channelId: string;
  threadTs: string;
  text: string;
};

export type SendSlackMessageResult = {
  messageTs: string;
};

export type StartSlackMessageStreamInput = {
  channelId: string;
  threadTs: string;
  recipientTeamId: string;
  recipientUserId: string;
  text: string;
};

export type StartSlackMessageStreamResult = {
  messageTs: string;
};

export type AppendSlackMessageStreamInput = {
  channelId: string;
  streamTs: string;
  text: string;
};

export type StopSlackMessageStreamInput = {
  channelId: string;
  streamTs: string;
  text?: string;
};

export type StopSlackMessageStreamResult = {
  messageTs: string;
};

export interface SlackMessengerPort {
  sendMessage(input: SendSlackMessageInput): Promise<SendSlackMessageResult>;
  startStream(input: StartSlackMessageStreamInput): Promise<StartSlackMessageStreamResult>;
  appendStream(input: AppendSlackMessageStreamInput): Promise<void>;
  stopStream(input: StopSlackMessageStreamInput): Promise<StopSlackMessageStreamResult>;
}
