import upload from "../middlewares/fileuploadMiddleware.js";
import {checkTotalSize}  from "../middlewares/checkTotalSizeMiddleware.js";
import {authMiddleware} from "../middlewares/authMiddleware.js"

import express from "express"
import { datetimeCapsuleCreation } from "../controllers/datetimeCapsuleController.js";
import { createLocationCapsule } from "../controllers/locationCapsuleController.js";
import { createWebhookCapsule } from "../controllers/webhookCapsuleController.js";
import { getDeliveredCapsules, getUndeliveredCapsules } from "../controllers/capsuleRetrievalController.js";
import {   validateDecryptionSession } from "../middlewares/sessionMiddleware.js";
import { createGithubCapsule } from "../controllers/gitHubController.js";

const router=express.Router();

router.post("/location",authMiddleware,upload.array("files",5),checkTotalSize,createLocationCapsule)
router.post("/date",authMiddleware,upload.array("files",5),checkTotalSize,datetimeCapsuleCreation)
router.post("/custom",authMiddleware,upload.array("files",5),checkTotalSize,createWebhookCapsule)
router.post("/github",authMiddleware,upload.array("files",5),checkTotalSize,createGithubCapsule)


router.post("/delivered",authMiddleware,validateDecryptionSession,getDeliveredCapsules);
router.get("/undelivered",authMiddleware,getUndeliveredCapsules)

export default router

