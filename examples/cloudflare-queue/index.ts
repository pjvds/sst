import { Resource } from "sst";

export default {
  async fetch(req: Request) {
    await Resource.MyQueue.send("Hello, World!");

    return new Response("Message sent to the queue!");
  },

  async queue(batch: MessageBatch<string>): Promise<void> {
    for (const message of batch.messages) {
      console.log("Processing message:", message.body);
      message.ack();
    }
  },
};
