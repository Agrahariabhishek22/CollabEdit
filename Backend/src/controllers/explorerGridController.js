import { prisma } from "../config/database.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

export const getExplorerRoot = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1. Fetch User with his accessible projects
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessibleProjectIds: true }
  });

  // 2. Fetch Root FileMetas of:
  // (a) Projects owned by the user
  // (b) Projects shared with the user (accessibleProjectIds)
  const rootFiles = await prisma.fileMeta.findMany({
    where: {
      OR: [
        { isRootOfProject: { ownerId: userId } }, // Owned
        { id: { in: user.accessibleProjectIds } } // Shared Roots
      ],
      isDeleted: false
    },
    include: {
      collaboratorDetail: true, // For mode of access
      project: {
        select: { name: true, sourceType: true } // Project context
      }
    }
  });

  // 3. Map to include "Access Mode" (Admin, Editor, or Viewer)
 const formattedRoots = rootFiles.reduce((acc, file) => {
    let mode = null;

    // Check permissions strictly from CollaboratorDetail
    const collab = file.collaboratorDetail;
    
    if (collab) {
      if (collab.adminId === userId) {
        mode = "ADMIN";
      } else if (collab.editors.includes(userId)) {
        mode = "EDITOR";
      } else if (collab.viewers.includes(userId)) {
        mode = "VIEWER";
      }
    }

    // Bhai, agar mode null hai matlab user ke paas ab koi access nahi hai (Revoked)
    if (mode) {
      acc.push({
        id: file.id,
        name: file.name || file.project?.name,
        isFolder: file.isFolder,
        projectId: file.projectId,
        parentId: file.parentId,
        sourceType: file.project?.sourceType,
        accessMode: mode, // Hamara calculated mode
        updatedAt: file.updatedAt
      });
    }

    return acc;
  }, []);

  res.status(200).json({ success: true, data: formattedRoots });
});

export const getFolderContents = asyncHandler(async (req, res) => {
  const { folderId } = req.params; // Clicked folder ki ID
  const userId = req.user.id;

  // 1. Fetch immediate children
  const contents = await prisma.fileMeta.findMany({
    where: {
      parentId: folderId,
      isDeleted: false
    },
    include: {
      collaboratorDetail: true
    },
    orderBy: { isFolder: 'desc' } // Folders pehle dikhe frontend pr
  });

  // 2. Formatting the response with collaboration details
  const formattedContents = contents.reduce((acc, item) => {
    let mode = null;
    const collab = item.collaboratorDetail;

    // Check permissions strictly for this specific file/folder
    if (collab) {
      if (collab.adminId === userId) {
        mode = "ADMIN";
      } else if (collab.editors.includes(userId)) {
        mode = "EDITOR";
      } else if (collab.viewers.includes(userId)) {
        mode = "VIEWER";
      }
    }

    // Bhai, agar mode null hai matlab user ka access is folder/file se hat chuka hai
    if (mode) {
      acc.push({
        id: item.id,
        name: item.name,
        extension: item.extension,
        isFolder: item.isFolder,
        projectId: item.projectId,
        parentId: item.parentId,
        accessMode: mode,
        updatedAt: item.updatedAt
      });
    }

    return acc;
  }, []);

  res.status(200).json({ success: true, data: formattedContents });
});






