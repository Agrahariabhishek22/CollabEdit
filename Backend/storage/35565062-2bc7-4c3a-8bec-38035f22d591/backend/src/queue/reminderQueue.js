import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

// bullmq is basiclly manager of redis now , it is making a queue in redis database naming capsule-delivery with some properties of retry and all 
export const reminderQueue = new Queue("capsule-reminder", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60 * 1000, // 1 minute
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
