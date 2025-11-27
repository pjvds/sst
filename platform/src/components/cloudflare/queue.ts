import { ComponentResourceOptions, output } from "@pulumi/pulumi";
import { Worker } from "./worker";
import * as cloudflare from "@pulumi/cloudflare";
import { Component, Transform, transform } from "../component";
import { Link } from "../link";
import { binding } from "./binding";
import { DEFAULT_ACCOUNT_ID } from "./account-id";
import { Input } from "../input";
import { subscribe } from "diagnostics_channel";
import { logicalName } from "../naming";
import { VisibleError } from "../error";

export interface QueueArgs {
  /**
   * [Transform](/docs/components/#transform) how this component creates its underlying
   * resources.
   */
  transform?: {
    /**
     * Transform the Queue resource.
     */
    queue?: Transform<cloudflare.QueueArgs>;
  };
}

export interface QueueSubscriberArgs {
  /**
   * The maximum number of messages to include in a batch.
   */
  batchSize?: Input<number>;
  /**
   * Maximum number of concurrent consumers that may consume from this Queue. Set to `null` to automatically opt in to the platform's maximum (recommended).
   */
  maxConcurrency?: Input<number>;
  /**
   * The maximum number of retries
   */
  maxRetries?: Input<number>;
  /**
   * The number of milliseconds to wait for a batch to fill up before attempting to deliver it
   */
  maxWaitTimeMs?: Input<number>;
  /**
   * The number of seconds to delay before making the message available for another attempt.
   */
  retryDelay?: Input<number>;
  /**
   * The number of milliseconds that a message is exclusively leased. After the timeout, the message becomes available for another attempt.
   */
  visibilityTimeoutMs?: Input<number>;
}

/**
 * The `Queue` component lets you add a [Cloudflare Queue](https://developers.cloudflare.com/queues/) to
 * your app.
 */
export class Queue extends Component implements Link.Linkable {
  private constructorName: string;
  private queue: cloudflare.Queue;
  private isSubscribed: boolean = false;

  constructor(name: string, args?: QueueArgs, opts?: ComponentResourceOptions) {
    super(__pulumiType, name, args, opts);
    this.constructorName = name;

    const parent = this;

    const queue = create();

    this.queue = queue;

    function create() {
      return new cloudflare.Queue(
        ...transform(
          args?.transform?.queue,
          `${name}Queue`,
          {
            queueName: "",
            accountId: DEFAULT_ACCOUNT_ID,
          },
          { parent },
        ),
      );
    }
  }

  getSSTLink() {
    return {
      properties: {},
      include: [
        binding({
          type: "queueBindings",
          properties: {
            queueName: this.queue.queueName,
          },
        }),
      ],
    };
  }

  /**
   * The generated id of the queue
   */
  public get id() {
    return this.queue.id;
  }

  /**
   * The underlying [resources](/docs/components/#nodes) this component creates.
   */
  public get nodes() {
    return {
      /**
       * The Cloudflare queue.
       */
      queue: this.queue,
    };
  }

  /**
   * Connect a Worker as a consumer to this Queue.
   *
   * The worker will be a push-based consumer of the queue.
   * A queue can only have a single consumer.
   *
   * @param subscriber The Worker to subscribe.
   * @param args Arguments to control the consumer behavior.
   *
   * @example
   *
   * ```ts title="sst.config.ts"
   * const queue = new cloudflare.Queue("MyQueue");
   * const worker = new cloudflare.Worker("MyWorker", {
   *  // ...
   * });
   *
   * queue.consume(worker, {
   *   batchSize: 10,
   *   maxConcurrency: 5,
   * });
   */
  public consume(
    subscriber: Input<Worker>,
    args?: QueueSubscriberArgs,
  ) {
    output(subscriber).apply((subscriber) => {
      if (this.isSubscribed) {
        throw new VisibleError(
          `Cannot subscribe to the ${this.constructorName} queue more than once. An Queue can only have one push-based consumer.`,
        );
      }
      this.isSubscribed = true;

      return new cloudflare.QueueConsumer(
        `${this.constructorName}Consumer`,
        {
          accountId: DEFAULT_ACCOUNT_ID,
          queueId: this.queue.id,
          consumerId: this.queue.id,
          scriptName: subscriber.nodes.worker.scriptName,
          type: "worker",
          settings: args,
        },
        {
          parent: this.queue,
          dependsOn: [subscriber],
        }
      );
    })
  }
}
