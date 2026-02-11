import express from "express";
import { getExplorerRoot, getFolderContents } from "../controllers/explorerGridController.js";
import { protect } from "../middlewares/auth.js";

const router=express.Router();

router.use(protect);

// router.get("/tree/:projectId",)
router.get("/tree",getExplorerRoot)
router.get("/subtree/folder/:folderId",getFolderContents)

export default router;