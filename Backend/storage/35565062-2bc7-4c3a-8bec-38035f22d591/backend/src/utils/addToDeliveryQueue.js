import { deliveryQueue } from "../queue/deliveryQueue.js";


export const addToDeliveryQueue = async (capsule) => {
  const targetDelay = new Date(capsule.deliveryTime).getTime() - Date.now();
  
  await deliveryQueue.add(
    `date_time_delivery-${capsule._id}`,
    {
      capsuleId: capsule._id,
      emails: capsule.emails,
    },
    {
      delay: targetDelay > 0 ? targetDelay : 0,
      removeOnComplete: true,
    }
  );
};