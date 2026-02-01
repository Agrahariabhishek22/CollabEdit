// Socket.io Event Emitters
export const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToProject = (io, projectId, event, data) => {
  io.to(`project:${projectId}`).emit(event, data);
};

export const emitToProjectExcept = (io, projectId, userId, event, data) => {
  io.to(`project:${projectId}`).except(`user:${userId}`).emit(event, data);
};

export const broadcastToAll = (io, event, data) => {
  io.emit(event, data);
};
