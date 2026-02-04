import { Worker } from "bullmq";
import Capsule from "../models/capsule.js";
import { redisConnection } from "../config/redis.js";
import { reminder1emailService } from "../services/reminder1emailService.js";
import { reminder7emailService } from "../services/reminder7emailService.js";

export const initReminderWorker = () => {
  console.log("Reminder worker started");
  
  const worker=new Worker(
    "capsule-reminder",
    async (job) => {
      const { capsuleId,emails } = job.data;
      console.log("inside capsule delivery worker",job.data,job.id);

      const capsule = await Capsule.findById(capsuleId).populate("ownerId","email");

      if (!capsule) {
        throw new Error("capsule not find");
      }
      if (job.name.startsWith("reminder1")) {
        try {
          await reminder1emailService([capsule.ownerId.email,emails], capsule.title);
          console.log(`Reminder1 Email sent for capsule: ${capsuleId}`);
        } catch (error) {
          console.error(
            `Failed to send email for ${capsuleId}:`,
            error.message
          );
          throw error; //will ask for bull mq for retry
        }
      } else if (job.name.startsWith("reminder7")) {
        try {
          await reminder7emailService([capsule.ownerId.email,emails], capsule.title);
          console.log(`Reminder7 Email sent for capsule: ${capsuleId}`);
        } catch (error) {
          console.error(
            `Failed to send email for ${capsuleId}:`,
            error.message
          );
          throw error;
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: { max: 50, duration: 1000 }, // in 1 sec max 10 mails
    }
  );
};
