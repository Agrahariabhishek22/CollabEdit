import prisma from "../../prisma.js";
import fs from "fs/promises";
import { cleanupEverywhere } from "../services/incrementalHelper/cleanupFromGroups.js";
import trash from "trash";

export const bulkDeleteFiles = async (req, res) => {
  try {
      console.log("we are inside bulkDeleteFiles");
    console.log(req.body);

    const { fileIds, sessionId, mode } = req.body;
    fileIds.map((i) => console.log(i));
    const files = await prisma.fileMeta.findMany({
      where: { id: { in: fileIds }, scanSessionId: sessionId },
    });

    for (const file of files) {
      //Physical Delete
      if (mode === "permanent") {
        await fs
          .unlink(file.absolutePath)
          .catch((err) => console.log("File already gone"));
      } else {
        await trash(file.absolutePath);
      }

      await prisma.$transaction([
        prisma.deletedRecord.create({
          data: { fileId: file.id, scanSessionId: sessionId },
        }),
        prisma.fileMeta.delete({ where: { id: file.id } }),
      ]);

      await cleanupEverywhere(file.id);
    }

    res.json({
      success: true,
      message: `${mode} delete successful and tracked`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
