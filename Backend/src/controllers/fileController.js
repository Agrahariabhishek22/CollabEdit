import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises"; // Promises waala (Async methods ke liye)
import simpleGit from "simple-git";
import { getIO } from "../config/socketio.js";

/**
 * HELPER: Verify access (Admin or Editor)
 * Returns true if user has write access to fileMetaId
 */
async function verifyWriteAccess(userId, fileMetaId) {
  const collabDetail = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId },
  });

  if (!collabDetail) return false;
  if (collabDetail.adminId === userId) return true;
  if (collabDetail.editors.includes(userId)) return true;

  return false;
}

/**
 * HELPER: Get all descendant IDs recursively
 * Used for soft-delete to mark children as deleted too
 */
async function getAllDescendantIds(fileMetaId) {
  const descendants = [];
  const queue = [fileMetaId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    descendants.push(currentId);

    const children = await prisma.fileMeta.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });

    children.forEach((child) => queue.push(child.id));
  }

  return descendants;
}

/**
 * HELPER: Create ProjectLog entry
 */
async function createProjectLog(
  projectId,
  userId,
  actionType,
  fileMetaId,
  fileName,
  details,
) {
  await prisma.projectLog.create({
    data: {
      projectId,
      userId,
      actionType,
      fileMetaId,
      fileName,
      details,
    },
  });
}

/**
 * HELPER: Recursively inherit CollaboratorDetail from parent
 */
async function inheritCollaboratorPermissions(fileMetaId, parentFileMetaId) {
  if (!parentFileMetaId) {
    // Root file: Create with admin = creator
    await prisma.collaboratorDetail.create({
      data: {
        fileMetaId,
        adminId: "system", // Will be overridden in caller
        editors: [],
        viewers: [],
      },
    });
    return;
  }

  const parentCollab = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId: parentFileMetaId },
  });

  if (parentCollab) {
    await prisma.collaboratorDetail.create({
      data: {
        fileMetaId,
        adminId: parentCollab.adminId,
        editors: parentCollab.editors,
        viewers: parentCollab.viewers,
      },
    });
  }
}

/**
 * CREATE: Add a new file or folder
 * Endpoint: POST /api/files/create
 * Body: { parentFileMetaId, projectId, name, isFolder, content (optional for files) }
 */
export const createFileOrFolder = asyncHandler(async (req, res) => {
  const { parentFileMetaId, name, isFolder, content } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  const userEmail = req.user.email;

  let fileMeta;
  let projectId;

  // --- CASE 1: NEW PROJECT (No parentFileMetaId) ---
  if (!parentFileMetaId) {
    // 1. Create a new Project entry first
    const newProject = await prisma.project.create({
      data: {
        name: name, // Project ka naam wahi jo root folder ka hai
        ownerId: userId,
        rootPath: "temp", // Placeholder, niche update hoga
      },
    });

    projectId = newProject.id;
    const projectRoot = path.join(process.env.STORAGE_PATH, projectId);

    // 2. Physical Disk Creation
    if (!fs.existsSync(projectRoot)) {
      await fsPromises.mkdir(projectRoot, { recursive: true });
    }
    // 3. Create the Root FileMeta (The 'Jadd' of the project)
    fileMeta = await prisma.fileMeta.create({
      data: {
        name: name,
        isFolder,
        projectId: projectId,
        absolutePath: projectRoot,
        creatorId: userId,
        collaboratorDetail: {
          create: { adminId: userId },
        },
      },
    });

    // 4. Link Project to its Root FileMeta
    await prisma.project.update({
      where: { id: projectId },
      data: {
        rootFileMetaId: fileMeta.id,
        rootPath: projectRoot,
      },
    });

    // Optional: Agar user root level par hi content bhej raha hai (rare but possible)
    if (!isFolder && content) {
      const filePath = path.join(projectRoot, name);
      await fsPromises.writeFile(filePath, content, "utf-8");
    }
  }
  // --- CASE 2: EXISTING PROJECT (parentFileMetaId exists) ---
  else {
    // 1. Verify Parent & Project
    const parent = await prisma.fileMeta.findUnique({
      where: { id: parentFileMetaId },
      include: { project: true },
    });

    if (!parent) throw new AppError("Parent directory not found", 404);
    projectId = parent.projectId;

    // 2. Path Calculation
    const newAbsolutePath = path.join(parent.absolutePath, name);

    // 3. Physical Disk Action
    if (isFolder) {
      await fsPromises.mkdir(newAbsolutePath, { recursive: true });
    } else {
      await fsPromises.writeFile(newAbsolutePath, content || "", "utf-8");
    }

    // 4. Database Entry
    fileMeta = await prisma.fileMeta.create({
      data: {
        name,
        isFolder,
        projectId,
        parentId: parentFileMetaId,
        absolutePath: newAbsolutePath,
        creatorId: userId,
        // ...( !isFolder && {
        //   editorState: {
        //     create: { content: content || "" }
        //   }
        // })
      },
    });

    // 5. Inherit Permissions
    await inheritCollaboratorPermissions(fileMeta.id, parentFileMetaId, userId);

    // 6. Git Operations (Only for Existing Git Projects)
    if (parent.project.sourceType === "GIT") {
      const git = simpleGit(parent.project.rootPath);
      await git.add(newAbsolutePath);
      await git.commit(`feat: added ${name}`, {
        "--author": `"${userName} <${userEmail}>"`,
      });
    }
  }

  // --- COMMON STEPS: Real-time & Logs ---

  // Create Project Log
  await createProjectLog(
    projectId,
    userId,
    isFolder ? "FOLDER_ADD" : "FILE_ADD",
    fileMeta.id,
    name,
  );

  // Broadcast
  const io = getIO();
  io.to(`project:${projectId}`).emit("FILE_CREATED", {
    fileMeta,
    createdBy: userName,
  });

  res.status(201).json({
    success: true,
    data: fileMeta,
  });
});

/**
 * RENAME: Rename a file or folder
 * Endpoint: PATCH /api/files/rename
 * Body: { fileMetaId, projectId, newName }
 */
export const renameFileOrFolder = asyncHandler(async (req, res) => {
  try {
    const { fileMetaId, projectId, newName } = req.body;
    const userId = req.user.id;

    // 1. Verify user has access
    const hasAccess = await verifyWriteAccess(userId, fileMetaId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 2. Get file details
    const fileMeta = await prisma.fileMeta.findUnique({
      where: { id: fileMetaId },
    });

    if (!fileMeta) {
      return res.status(404).json({ error: "File not found" });
    }

    const oldName = fileMeta.name;
    const oldPath = fileMeta.absolutePath;

    // 3. Build new path (same directory, different name)
    const parentDir = path.dirname(oldPath);
    const extension = fileMeta.extension || "";
    const newPath = path.join(
      parentDir,
      newName + (extension ? "" : extension),
    );

    // 4. Rename on disk
    await fsPromises.rename(oldPath, newPath);

    // 5. Update FileMeta
    const updated = await prisma.fileMeta.update({
      where: { id: fileMetaId },
      data: {
        name: newName,
        absolutePath: newPath,
      },
    });

    // 6. Get project for Git context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: true },
    });

    // 7. For Git projects: Stage & commit
    if (project?.sourceType === "GIT") {
      const git = simpleGit(project.rootPath);
      await git.rm(oldPath);
      await git.add(newPath);
      await git.commit(`chore: Renamed ${oldName} to ${newName}`, [
        `--author="${project.owner.name} <${project.owner.email}>"`,
      ]);
    }

    // 8. Create ProjectLog
    await createProjectLog(
      projectId,
      userId,
      fileMeta.isFolder ? "FOLDER_RENAME" : "FILE_RENAME",
      fileMetaId,
      newName,
      { oldName, newName, branchName: project?.currentBranch },
    );

    // 9. Real-time broadcast
    const io = getIO();
    io.to(`project:${projectId}`).emit("FILE_RENAMED", {
      fileMetaId,
      oldName,
      newName,
      renamedBy: req.user.name,
    });

    res.json(updated);
  } catch (error) {
    console.error("renameFileOrFolder error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE: Soft-delete a file or folder
 * Endpoint: DELETE /api/files/delete
 * Body: { fileMetaId, projectId }
 *
 * Soft delete: Mark isDeleted: true for file and all descendants
 * Physical delete from disk: Move to .trash folder or rm from git
 */
export const deleteFileOrFolder = asyncHandler(async (req, res) => {
  try {
    const { fileMetaId, projectId } = req.body;
    const userId = req.user.id;

    // 1. Verify user has access
    const hasAccess = await verifyWriteAccess(userId, fileMetaId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 2. Get file and all descendants
    const fileMeta = await prisma.fileMeta.findUnique({
      where: { id: fileMetaId },
    });

    if (!fileMeta) {
      return res.status(404).json({ error: "File not found" });
    }

    const descendantIds = await getAllDescendantIds(fileMetaId);

    // 3. Soft-delete in DB: Mark all descendants as deleted
    await prisma.fileMeta.updateMany({
      where: { id: { in: descendantIds } },
      data: { isDeleted: true },
    });

    // 4. Physical delete from disk
    // try {
    //   await fs.rm(fileMeta.absolutePath, { recursive: true, force: true });
    // } catch (diskError) {
    //   console.warn("Disk deletion warning:", diskError.message);
    //   // Continue even if disk delete fails (DB is source of truth)
    // }

    // 5. Get project for Git context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: true },
    });

    // 6. For Git projects: Stage & commit removal
    if (project?.sourceType === "GIT") {
      const git = simpleGit(project.rootPath);
      try {
        await git.rm(fileMeta.absolutePath, ["-r", "-f"]);
        await git.commit(
          `chore: Deleted ${fileMeta.isFolder ? "folder" : "file"} ${fileMeta.name}`,
          [`--author="${project.owner.name} <${project.owner.email}>"`],
        );
      } catch (gitError) {
        console.warn("Git deletion warning:", gitError.message);
      }
    }

    // 7. Create ProjectLog
    await createProjectLog(
      projectId,
      userId,
      fileMeta.isFolder ? "FOLDER_DELETE" : "FILE_DELETE",
      fileMetaId,
      fileMeta.name,
      {
        deletedCount: descendantIds.length,
        branchName: project?.currentBranch,
        isSoftDelete: true,
      },
    );

    // 8. Real-time broadcast
    const io = getIO();
    io.to(`project:${projectId}`).emit("FILE_DELETED", {
      fileMetaId,
      fileName: fileMeta.name,
      deletedCount: descendantIds.length,
      deletedBy: req.user.name,
    });

    res.json({
      success: true,
      message: `Deleted ${fileMeta.name} and ${descendantIds.length - 1} descendants`,
      deletedCount: descendantIds.length,
    });
  } catch (error) {
    console.error("deleteFileOrFolder error:", error);
    res.status(500).json({ error: error.message });
  }
});



