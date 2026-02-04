import { Worker } from "bullmq";
import Capsule from "../models/capsule.js";
import { redisConnection } from "../config/redis.js";
import { emailService } from "../services/emailServices.js";

export const initDeliveryWorker = () => {
  console.log("DELIVERY WORKER STARTED");
  const worker = new Worker(
    "capsule-delivery",
    async (job) => {
      const { capsuleId,emails } = job.data;
      console.log("inside capsule delivery worker",job.data,job.id);
      
      const capsule = await Capsule.findById(capsuleId).populate("ownerId","name email");
      // console.log(capsule);
      
 
      if (!capsule) {
        throw new Error("capsule not find");
      }

      try {
        await emailService([capsule.ownerId.email,...emails], capsule.title);

        await Capsule.findByIdAndUpdate(
          capsuleId,
          {
            $set: { deliveryStatus: "DELIVERED" },
          },
          { new: true }
        );

        console.log(`Email sent for capsule: ${capsuleId}`);
      } catch (error) {
        console.error(`Failed to send email for ${capsuleId}:`, error.message);
        throw error; // will go for retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: { max: 50, duration: 1000 }, // in 1 sec max 50 mails
    }
  );

  worker.on("failed", async (job, err) => {
    if (job.attemptsMade >= job.opts.attempts) {
      console.log(
        `Job ${job.id} has failed after all ${job.opts.attempts} retries.`
      );
      await Capsule.findByIdAndUpdate(job.data.capsuleId, {
        deliveryStatus: "FAILED",
      });
    } else {
      console.log(
        `Attempt ${job.attemptsMade} failed. Retrying in ${
          job.opts.backoff.delay / 1000
        }s...`
      );
    }
  });
};
