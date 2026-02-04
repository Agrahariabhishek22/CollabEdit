import path from "path";
import fs from "fs";
import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import { log } from "console";

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

// marked to understand
export const createAndUploadProject = asyncHandler(async (req, res) => {
  const { projectName, description } = req.body;
  const files = req.files;
  const userId = req.user.id;
  const paths = req.body.paths;

  if (!files || files.length === 0) throw new AppError("No files found", 400);

  // 1. Create Project Entry
  const project = await prisma.project.create({
    data: {
      name: projectName,
      description,
      ownerId: userId,
      rootPath: "pending",
    },
  });

  const projectRoot = path.join(process.env.STORAGE_PATH, project.id);
  // Ensure Project Root exists
  if (!fs.existsSync(projectRoot))
    fs.mkdirSync(projectRoot, { recursive: true });

  await prisma.project.update({
    where: { id: project.id },
    data: { rootPath: projectRoot },
  });

  const folderCache = new Map();
  let rootMetaId = null;

  // 2. Process Files One by One
  for (let index = 0; index < files.length; index++) {
    // browser 'fullPath' ya 'originalname' mein relative path bhejta hai
    const file = files[index];
    const relativePath = Array.isArray(paths) ? paths[index] : paths;
    console.log(relativePath);

    if (isIgnored(relativePath)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      continue;
    }

    const parts = relativePath.split(/[\\/]/);
    let currentParentId = null;

    // Path tree build karna (e.g., src -> components -> App.js)
    for (let i = 0; i < parts.length; i++) {
      const partName = parts[i];
      const isFolder = i < parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");

      // Full Physical Path for this specific part
      const fullPhysicalPath = path.join(projectRoot, pathSoFar);

      if (!folderCache.has(pathSoFar)) {
        // --- DISK CREATION ---
        if (isFolder) {
          if (!fs.existsSync(fullPhysicalPath)) {
            fs.mkdirSync(fullPhysicalPath, { recursive: true });
          }
        } else {
          // It's a file: ensure parent directory exists just in case
          const dirName = path.dirname(fullPhysicalPath);
          if (!fs.existsSync(dirName))
            fs.mkdirSync(dirName, { recursive: true });

          // MOVE: Temp Multer storage to Final Project folder
          fs.renameSync(file.path, fullPhysicalPath);
        }

        // --- DATABASE ENTRY ---
        const meta = await prisma.fileMeta.create({
          data: {
            name: partName,
            isFolder,
            projectId: project.id,
            parentId: currentParentId,
            absolutePath: fullPhysicalPath,
            creatorId: userId,
          },
        });
        await prisma.collaboratorDetail.create({
          data: { fileMetaId: meta.id, adminId: userId },
        });
        // Agar i=0 hai toh ye root folder ya root file hai
        if (i === 0 && !rootMetaId) rootMetaId = meta.id;

        // Cache this meta ID for its children
        folderCache.set(pathSoFar, meta.id);
      }

      // Update parent ID for the next part in the path
      currentParentId = folderCache.get(pathSoFar);
    }
  }

  // Update Project with the root meta ID
  await prisma.project.update({
    where: { id: project.id },
    data: { rootFileMetaId: rootMetaId },
  });

  res.status(201).json({ success: true, projectId: project.id });
});
 