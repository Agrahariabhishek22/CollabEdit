import cron from "node-cron";
import Capsule from "../models/capsule.js";
import { deliveryQueue } from "../queue/deliveryQueue.js";
import { reminderQueue } from "../queue/reminderQueue.js";
import axios from "axios";
import { addToDeliveryQueue } from "../utils/addToDeliveryQueue.js";

const cronService = () => {
  cron.schedule("*/2 * * * *", async () => {
    console.log("inside nodecron service");

    const now = new Date(); //will always give time in UTC
    const twoMinLater = new Date(now.getTime() + 2 * 60 * 1000);
    // console.log("current" ,now);
    // console.log("after thirty min",thirtyMinLater);

    try {
      const capsules = await Capsule.find({
        deliveryStatus: "PENDING",
        triggerType: "DATE_TIME",
        deliveryTime: { $lte: twoMinLater },
      });

      // for (const caps of capsules) {
      //   console.log("inside loop to log capsules");

      //   console.log(caps._id);
      //   console.log(caps.triggerType);
      // }

      if (capsules.length === 0) {
        console.log("No capsules found for this interval.");
        return;
      }
      console.log(`Found ${capsules.length} capsules to process`);

      const capsuleIds = capsules.map((c) => c._id);
      await Capsule.updateMany(
        { _id: { $in: capsuleIds } },
        { $set: { deliveryStatus: "PROCESSING" } }
      );

      const jobPromises = capsules.map((capsule) => {
        return addToDeliveryQueue(capsule);
      });

      const results = await Promise.allSettled(jobPromises);

      results.forEach(async (result, index) => {
        if (result.status === "fulfilled") {
          console.log(`Capsule ${index} added successfully`);
        } else {
          console.error(`Capsule ${index} failed:`, result.reason);

          const failedCapsule = capsules[index];
          await Capsule.findByIdAndUpdate(failedCapsule._id, {
            deliveryStatus: "PENDING",
          });
        }
      });

      console.log(
        "Successfully added all the date triggering into the queue via cronjob"
      );
    } catch (error) {
      console.log("Error", error);
      console.log("Something went wrong in cron-services");
    }
  });

  // for github prs running on every morning 9 and evening 9
  cron.schedule("*/1 * * * *", async () => {
    console.log("Starting GitHub PR Milestone Sync");

    try {
      const pendingCapsules = await Capsule.find({
        triggerType: "GITHUB_PR",
        deliveryStatus: "PENDING",
      }).populate({
        path: "ownerId",
        select: "githubToken githubUsername isGithubConnected",
      });

      if (pendingCapsules.length === 0) {
        console.log("No GitHub capsules to process.");
        return;
      }

      console.log(`Processing ${pendingCapsules.length} GitHub capsules...`);

      const results = await Promise.allSettled(
        pendingCapsules.map(async (capsule) => {
          const user = capsule.ownerId;

          if (!user || !user.isGithubConnected || !user.githubToken) {
            console.log(`Skipping capsule ${capsule._id}: User not connected`);
            return;
          }

          try {
            const ghRes = await axios.get(
              `https://api.github.com/search/issues?q=author:${user.githubUsername}+type:pr`,
              {
                headers: {
                  Authorization: `token ${user.githubToken}`,
                  Accept: "application/vnd.github.v3+json",
                },
                timeout: 5000, // 5 sec timeout to prevent hanging
              }
            );

            const currentPRs = ghRes.data.total_count;

            if (currentPRs >= capsule.githubPrs) {
              console.log(
                `Target Hit! Capsule ${capsule._id} unlocking at ${currentPRs} PRs`
              );

              await Capsule.findByIdAndUpdate(capsule._id, {
                deliveryStatus: "PROCESSING",
              });

              // Add to Delivery Queue (Existing logic)
              await deliveryQueue.add(
                `github_delivery-${capsule._id}`,
                {
                  capsuleId: capsule._id,
                  emails: capsule.emails,
                },
                { removeOnComplete: true }
              );
            }
          } catch (ghError) {
            console.error(
              `GitHub API Error for user ${user.githubUsername}:`,
              ghError.message
            );
          }
        })
      );

      console.log("GitHub Sync Completed.");
    } catch (error) {
      console.error("Critical Error in github-cron-service:", error);
    }
  });

  // 7-Day Reminder: Ghante ke 0th minute par
  cron.schedule("0 * * * *", async () => {
    console.log("inside 7 day reminder");

    const now = new Date();
    const windowStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    windowStart.setSeconds(0, 0);
    const windowEnd = new Date(windowStart.getTime() + 1 * 60 * 60 * 1000);
    windowEnd.setSeconds(0, 0);
    console.log("windowStart", windowStart.toLocaleString());
    console.log("windowStart", windowStart);
    console.log("windowEnd", windowEnd.toLocaleString());
    console.log("windowEnd", windowEnd);

    try {
      const capsules = await Capsule.find({
        reminder7Sent: false,
        triggerType: "DATE_TIME",
        deliveryStatus: "PENDING",
        // Logic: deliveryTime is BETWEEN (Now+7days) AND (Now+7days+1hour)
        deliveryTime: {
          // $gte: windowStart,
          $lte: windowEnd,
        },
      });

      if (capsules.length === 0) {
        console.log("No capsules found for this interval.");
        return;
      }
      console.log(`Found ${capsules.length} capsules to remind`);

      const capsuleIds = capsules.map((c) => c._id);
      await Capsule.updateMany(
        { _id: { $in: capsuleIds } },
        { $set: { reminder7Sent: true } }
      );

      const jobPromises = capsules.map((capsule) => {
        return reminderQueue.add(`reminder7-${capsule._id}`, {
          capsuleId: capsule._id,
          emails: capsule.emails,
        });
      });

      const results = await Promise.allSettled(jobPromises);

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`Capsule ${index} added successfully`);
        } else {
          console.error(`Capsule ${index} failed:`, result.reason);
        }
      });

      console.log(
        "Successfully added all the date triggering reminder capsule into the queue via cronjob"
      );
    } catch (err) {
      console.error(err);
    }
  });

  // 1-Day Reminder: Ghante ke 5th minute par (Taaki load distribute ho jaye)
  cron.schedule("5 * * * *", async () => {
    console.log("inside 1 day reminder");

    const now = new Date();
    const windowStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const windowEnd = new Date(windowStart.getTime() + 1 * 60 * 60 * 1000);

    try {
      const capsules = await Capsule.find({
        reminder1Sent: false,
        triggerType: "DATE_TIME",
        deliveryStatus: "PENDING",
        // Logic: deliveryTime is BETWEEN (Now+1days) AND (Now+1days+1hour)
        deliveryTime: {
          // $gte: windowStart,
          $lte: windowEnd,
        },
      });

      if (capsules.length === 0) {
        console.log("No capsules found for this interval.");
        return;
      }
      console.log(`Found ${capsules.length} capsules to remind`);

      const capsuleIds = capsules.map((c) => c._id);
      await Capsule.updateMany(
        { _id: { $in: capsuleIds } },
        { $set: { reminder1Sent: true } }
      );

      const jobPromises = capsules.map((capsule) => {
        return reminderQueue.add(`reminder1-${capsule._id}`, {
          capsuleId: capsule._id,
          emails: capsule.emails,
        });
      });

      const results = await Promise.allSettled(jobPromises);

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`Capsule ${index} added successfully`);
        } else {
          console.error(`Capsule ${index} failed:`, result.reason);
        }
      });

      console.log(
        "Successfully added all the date triggering reminder capsule into the queue via cronjob"
      );
    } catch (err) {
      console.error(err);
    }
  });
};
export default cronService;
