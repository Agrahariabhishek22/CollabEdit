// services/yjs/YjsDocManager.js

import * as Y from 'yjs';
import { Buffer } from 'buffer'; 

class YjsDocManager {
  constructor(redis, persistence) {
    this.redis = redis;
    this.persistence = persistence;
    
    // In-memory map of active Shadow Docs
    // Key: fileId, Value: { ydoc, ytext, lastActivity, users: Set }
    this.activeDocs = new Map();
  }

  // ═══════════════════════════════════════════════════════════
  // HYDRATION (Load file into RAM)
  // ═══════════════════════════════════════════════════════════

  async getOrCreateDoc(fileId) {
    // Check if already in RAM
    if (this.activeDocs.has(fileId)) {
      const doc = this.activeDocs.get(fileId);
      doc.lastActivity = Date.now();
      return doc;
    }

    // Create new Shadow Y.Doc
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');

    // ✅ FIX: commandOptions ki jagah sendCommand use kiya hai Buffer pane ke liye
    let binary = await this.redis.sendCommand(
      ['GET', `doc:binary:${fileId}`],
      { returnBuffers: true } // Ye ensure karta hai ki binary data corrupt na ho
    );

    if (!binary) {
      // Try to load from Disk (.yjs file)
      binary = await this.persistence.loadBinaryFromDisk(fileId);
    }

    if (binary) {
      // Apply binary state to Y.Doc
      Y.applyUpdate(ydoc, new Uint8Array(binary));
    } else {
      // No binary found, load raw text from disk
      const rawText = await this.persistence.loadRawTextFromDisk(fileId);
      if (rawText) {
        ytext.insert(0, rawText);
      }
    }

    // Store in RAM
    const docData = {
      ydoc,
      ytext,
      fileId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      users: new Set(),
      flushPending: false,
    };

    this.activeDocs.set(fileId, docData);

    // Backup to Redis immediately
    await this.backupToRedis(fileId);

    return docData;
  }

  // ═══════════════════════════════════════════════════════════
  // APPLY DELTA (User edit)
  // ═══════════════════════════════════════════════════════════

  async applyDelta(fileId, binaryUpdate) {
    const doc = await this.getOrCreateDoc(fileId);
    
    // Apply update to Shadow Doc
    Y.applyUpdate(doc.ydoc, new Uint8Array(binaryUpdate));
    
    // Update activity timestamp
    doc.lastActivity = Date.now();
    doc.flushPending = true;

    return doc;
  }

  // ═══════════════════════════════════════════════════════════
  // GET CURRENT STATE (For new users joining)
  // ═══════════════════════════════════════════════════════════

  async getStateVector(fileId) {
    const doc = await this.getOrCreateDoc(fileId);
    return Y.encodeStateAsUpdate(doc.ydoc);
  }

  // ═══════════════════════════════════════════════════════════
  // BACKUP TO REDIS (Periodic safety net)
  // ═══════════════════════════════════════════════════════════

  async backupToRedis(fileId) {
    const doc = this.activeDocs.get(fileId);
    if (!doc) return;

    const binary = Y.encodeStateAsUpdate(doc.ydoc);
    
    // ✅ node-redis v4 mein setEx syntax (Capital E)
    await this.redis.setEx(
      `doc:binary:${fileId}`,
      600, // 10 min TTL
      Buffer.from(binary)
    );
  }

  // ═══════════════════════════════════════════════════════════
  // FLUSH TO DISK (Persistence)
  // ═══════════════════════════════════════════════════════════

  async flushToDisk(fileId) {
    const doc = this.activeDocs.get(fileId);
    if (!doc || !doc.flushPending) return;

    const rawText = doc.ytext.toString();
    const binary = Y.encodeStateAsUpdate(doc.ydoc);

    await this.persistence.saveToDisk(fileId, rawText, binary);
    await this.backupToRedis(fileId); // Update Redis too

    doc.flushPending = false;
    doc.lastFlushedAt = Date.now();
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP (Remove from RAM)
  // ═══════════════════════════════════════════════════════════

  async cleanup(fileId) {
    const doc = this.activeDocs.get(fileId);
    if (!doc) return;

    // Final flush
    await this.flushToDisk(fileId);

    // Destroy Y.Doc
    doc.ydoc.destroy();

    // Remove from RAM
    this.activeDocs.delete(fileId);

    console.log(`[YjsDocManager] Cleaned up Shadow Doc: ${fileId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // USER TRACKING (Who is editing)
  // ═══════════════════════════════════════════════════════════

  addUser(fileId, userId) {
    const doc = this.activeDocs.get(fileId);
    if (doc) doc.users.add(userId);
  }

  removeUser(fileId, userId) {
    const doc = this.activeDocs.get(fileId);
    if (doc) {
      doc.users.delete(userId);
      
      // If no users left, schedule cleanup
      if (doc.users.size === 0) {
        setTimeout(() => {
          if (doc.users.size === 0) {
            this.cleanup(fileId);
          }
        }, 5 * 60 * 1000); // 5 min delay
      }
    }
  }
}

export default YjsDocManager;