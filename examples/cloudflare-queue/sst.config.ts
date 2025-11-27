/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cloudflare-queue",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
    };
  },
  async run() {
    const queue = new sst.cloudflare.Queue("MyQueue");
    const worker = new sst.cloudflare.Worker("MyWorker", {
      handler: "./index.ts",
      link: [queue],
      url: true,
      transform: {
        worker: (args) => {
          args.observability = {
            enabled: false,
            headSamplingRate: 1,
            logs: {
              enabled: true,
              headSamplingRate: 1,
              persist: true,
              invocationLogs: true

            },
          }
        }
      }
    });

    queue.consume(worker)

    return {
      api: worker.url,
    };
  },
});
