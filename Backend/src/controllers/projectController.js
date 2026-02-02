import path from "path";
import fs from "fs";
import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { getPrismaClient } from "../config/database.js";

const prisma = getPrismaClient();
const IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  ".svn",
  "dist",
  "build",
  ".cache",
  ".next",
  "__pycache__",
  "vendor",
  "target",
  ".vs",
  ".idea",
  ".vscode",
  ".archived_storage",
  ".trash",
  "temp",
  "tmp",
  ".npm",
  ".yarn",
  ".hg",
  ".db",
  ".sys",
  ".log",
];
const IGNORED_FILES = [".DS_Store", "thumbs.db"];

const isIgnored = (path) => {
  return (
    IGNORED_FOLDERS.some((folder) => path.split("/").includes(folder)) ||
    IGNORED_FILES.some((file) => path.endsWith(file))
  );
};

export const createAndUploadProject = asyncHandler(async (req, res) => {
  const { projectName, description } = req.body;
  const files = req.files;
  const userId = req.user.id;

  if (!files || files.length === 0) throw new AppError("No files found", 400);

  // 1. Project Initialization
  const project = await prisma.project.create({
    data: {
      name: projectName,
      description,
      ownerId: userId,
      rootPath: "temp",
    },
  });
  let rootMetaId = null;

  const projectRoot = path.join(process.env.STORAGE_PATH, project.id);
  if (!fs.existsSync(projectRoot))
    fs.mkdirSync(projectRoot, { recursive: true });

  await prisma.project.update({
    where: { id: project.id },
    data: { rootPath: projectRoot },
  });

  // folderCache store karega pathSoFar -> metaId taaki parentId fetch ho sake
  const folderCache = new Map();

  // 2. Transactional Hierarchy Reconstruction
  await prisma.$transaction(async (tx) => {
    for (const file of files) {
      // Frontend ko 'originalname' mein full path bhejna hoga (e.g. "my-project/src/index.js")
      const relativePath = file.originalname;

      if (isIgnored(relativePath)) continue;

      const parts = relativePath.split(/[\\/]/);
      let currentParentId = null;

      // "my-project/src/index.js" ko parts mein todkar traverse karna
      for (let i = 0; i < parts.length; i++) {
        const partName = parts[i];
        const isFolder = i < parts.length - 1;
        const pathSoFar = parts.slice(0, i + 1).join("/");

        if (!folderCache.has(pathSoFar)) {
          const fullPhysicalPath = path.join(projectRoot, pathSoFar);

          // A. Disk Management
          if (isFolder) {
            if (!fs.existsSync(fullPhysicalPath)) {
              fs.mkdirSync(fullPhysicalPath, { recursive: true });
            }
          } else {
            // Ensure child file se pehle uska physical parent folder disk pr ho
            const dirName = path.dirname(fullPhysicalPath);
            if (!fs.existsSync(dirName))
              fs.mkdirSync(dirName, { recursive: true });
            fs.writeFileSync(fullPhysicalPath, file.buffer);
          }

          // B. Database Hierarchy (The Real Tree)
          const meta = await tx.fileMeta.create({
            data: {
              name: partName,
              isFolder,
              projectId: project.id,
              parentId: currentParentId, // Pichle loop ka ID automatically parent banega
              absolutePath: fullPhysicalPath,
              creatorId: userId,
              ...(!isFolder && {
                editorState: {
                  create: { content: file.buffer.toString("utf-8") },
                },
              }),
            },
          });

          // C. Recursive Permission Allocation
          await tx.collaboratorDetail.create({
            data: { fileMetaId: meta.id, adminId: userId },
          });
          if (i === 0 && !rootMetaId) {
            rootMetaId = meta.id;
          }

          // Metadata ID save kar lo agle child ke liye
          folderCache.set(pathSoFar, meta.id);
        }

        // Is loop ka current meta ID, agle iteration ke liye currentParentId ban jayega
        currentParentId = folderCache.get(pathSoFar);
      }
    }
    await tx.project.update({
      where: { id: project.id },
      data: {
        rootFileMetaId: rootMetaId,
      },
    });
  });

  res.status(201).json({
    success: true,
    message: "Project tree reconstructed successfully",
    projectId: project.id,
  });
});
