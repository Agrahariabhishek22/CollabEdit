// services/yjs/YjsDocManager.js

import * as Y from "yjs";
import { Buffer } from "buffer";

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
    const logPrefix = `[Yjs-Manager][${fileId}]`; // For easy filtering in logs
    console.log(`${logPrefix} 🔍 Fetching or creating document...`);

    try {
      // 1. Check if already in RAM
      if (this.activeDocs.has(fileId)) {
        console.log(`${logPrefix} 🚀 Cache Hit: Document found in RAM.`);
        const doc = this.activeDocs.get(fileId);
        doc.lastActivity = Date.now();
        return doc;
      }

      console.log(`${logPrefix} 📥 Cache Miss: Initializing fresh Y.Doc...`);
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("content");

      let binary = null;

      // 2. Redis Fetch
      try {
        console.log(`${logPrefix} 📦 Attempting to load from Redis...`);
        binary = await this.redis.sendCommand(["GET", `doc:binary:${fileId}`], {
          returnBuffers: true,
        });
        if (binary)
          console.log(
            `${logPrefix} ✅ Found binary in Redis (Size: ${binary.length} bytes)`,
          );
      } catch (redisErr) {
        console.error(`${logPrefix} ❌ Redis GET error:`, redisErr.message);
      }

      // 3. Disk Load (Binary)
      if (!binary) {
        try {
          console.log(
            `${logPrefix} 📂 Redis empty, attempting to load .yjs from Disk...`,
          );
          binary = await this.persistence.loadBinaryFromDisk(fileId);
          if (binary) console.log(`${logPrefix} ✅ Found binary on Disk.`);
        } catch (diskErr) {
          console.error(
            `${logPrefix} ❌ Disk Binary load error:`,
            diskErr.message,
          );
        }
      }

      // 4. Apply Updates or Load Raw Text
      if (binary) {
        try {
          console.log(`${logPrefix} ⚙️ Applying binary update to Y.Doc..., size: ${binary.length} bytes, binary: ${binary}`);
          // Y.applyUpdate(ydoc, new Uint8Array(binary));
          // console.log(
          //   `${logPrefix} ✨ Binary applied successfully. Current text length: ${ytext.toString().length}`,
          // );
          try {
            const updateArray = new Uint8Array(binary);
            Y.applyUpdate(ydoc, updateArray);

            // 1. Check karo binary ne ydoc ke andar kaun-kaun si keys banayi hain
            const keysInDoc = Array.from(ydoc.share.keys());
            console.log(
              `${logPrefix} 🔎 Binary ke andar ye keys mili:`,
              keysInDoc,
            );

            // 2. Har key ka content print karo taaki pata chale data kahan chhupa hai
            ydoc.share.forEach((type, keyName) => {
              console.log(
                `${logPrefix} 📝 Key: "${keyName}" | Type: ${type.constructor.name} | Content: "${type.toString().substring(0, 50)}..."`,
              );
            });

            if (!keysInDoc.includes("content")) {
              console.error(
                `${logPrefix} ❌ Locha Mil Gaya! Binary mein "content" naam ki key hi nahi hai. Isliye ytext.toString() 0 aa raha hai.`,
              );
            }
                      console.log(
            `${logPrefix} ✨ Binary applied successfully. Current text length: ${ytext.toString().length}`,
          );
          } catch (err) {
            console.error("Binary inspect karne mein error:", err);
          }
        } catch (yjsErr) {
          console.error(
            `${logPrefix} 💥 Yjs applyUpdate failed (Corrupt Binary?):`,
            yjsErr.message,
          );
        }
      } else {
        try {
          console.log(
            `${logPrefix} 📄 No binary found anywhere. Loading raw text from Disk...`,
          );
          const rawText = await this.persistence.loadRawTextFromDisk(fileId);
          if (rawText) {
            console.log(
              `${logPrefix} ✅ Raw text loaded (Length: ${rawText.length}). Inserting into Y.Text...`,
            );
            ytext.insert(0, rawText);
          } else {
            console.log(
              `${logPrefix} ℹ️ No raw text found. Starting with an empty document.`,
            );
          }
        } catch (rawErr) {
          console.error(`${logPrefix} ❌ Raw text load error:`, rawErr.message);
        }
      }

      // 5. Store in RAM
      const docData = {
        ydoc,
        ytext,
        fileId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        users: new Set(),
        flushPending: false,
      };
      console.log(docData);

      this.activeDocs.set(fileId, docData);
      console.log(`${logPrefix} 💾 Document stored in active RAM.`);

      // 6. Backup to Redis immediately
      try {
        console.log(`${logPrefix} 🔄 Triggering immediate Redis backup...`);
        await this.backupToRedis(fileId);
        console.log(`${logPrefix} ✅ Initial backup complete.`);
      } catch (backupErr) {
        console.error(
          `${logPrefix} ⚠️ Initial backup failed:`,
          backupErr.message,
        );
      }

      return docData;
    } catch (globalErr) {
      console.error(
        `${logPrefix} 🚨 FATAL ERROR in getOrCreateDoc:`,
        globalErr,
      );
      throw globalErr; // Re-throw so the caller knows it failed
    }
  }

  // ═══════════════════════════════════════════════════════════
  // APPLY DELTA (User edit)
  // ═══════════════════════════════════════════════════════════

  async applyDelta(fileId, binaryUpdate) {
    const logPrefix = `[yjs doc manager apply delta][${fileId}]`;
    console.log(`${logPrefix} 📥 Received a new binary delta update.`);

    try {
      // 1. Validation Check
      // [yjs doc manager apply delta ] Pehle check karo ki network se kachra toh nahi aaya
      if (!binaryUpdate) {
        console.error(
          `${logPrefix} ❌ Validation Failed: binaryUpdate is null or undefined.`,
        );
        throw new Error("Binary update data gayab hai bhai!");
      }

      // 2. Document Retrieval
      // [yjs doc manager apply delta ] RAM ya Storage se target document uthao
      console.log(`${logPrefix} 🔍 Fetching document instance...`);
      const doc = await this.getOrCreateDoc(fileId);

      // 3. Applying Binary Update (The CRDT Merge)
      // [yjs doc manager apply delta ] Is chote se binary update ko existing Y.Doc ke saath merge karo
      try {
        console.log(
          `${logPrefix} ⚙️ Applying binary to Y.Doc (Size: ${binaryUpdate.byteLength || binaryUpdate.length} bytes)`,
        );

        const updateArray = new Uint8Array(binaryUpdate);
        Y.applyUpdate(doc.ydoc, updateArray);

        console.log(
          `${logPrefix} ✅ Sync Successful. New text length: ${doc.ytext.toString().length}`,
        );
      } catch (yjsError) {
        // [yjs doc manager apply delta ] Agar binary format corrupted hai toh crash hone se bachao
        console.error(
          `${logPrefix} 💥 Critical Error: Yjs merge failed. Corrupt binary update!`,
          yjsError,
        );
        throw new Error("Invalid Yjs binary update format");
      }

      // 4. Marking for Persistence
      // [yjs doc manager apply delta ] Last activity time update karo taaki Cleanup worker isse delete na kare
      // [yjs doc manager apply delta ] flushPending = true matlab ab isse Redis/Disk mein save karna bacha hai
      doc.lastActivity = Date.now();
      doc.flushPending = true;

      console.log(`${logPrefix} 🏁 Delta applied and marked for flush.`);
      return doc;
    } catch (error) {
      // 5. Global Error Handling
      // [yjs doc manager apply delta ] Poore flow mein kahin bhi error aaye toh yahan log hoga
      console.error(
        `${logPrefix} 🚨 Fatal error in applyDelta:`,
        error.message,
      );
      throw error;
    }
  }
  // ═══════════════════════════════════════════════════════════
  // GET CURRENT STATE (For new users joining)
  // ═══════════════════════════════════════════════════════════

  // AFTER (CORRECT):
  async getStateVector(fileId) {
    // 🟢 FIX: Pehle check kar - doc already loaded hai?
    let docData = this.activeDocs.get(fileId);

    if (!docData) {
      // Agar नहीं है तो load karo
      docData = await this.getOrCreateDoc(fileId);
    }

    // 🟢 अब doc निश्चित रूप से loaded है content के साथ
    const snapshot = Y.encodeStateAsUpdate(docData.ydoc);

    console.log(
      `[getStateVector] File: ${fileId}, Snapshot size: ${snapshot.length}`,
    );

    return snapshot;
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
      Buffer.from(binary),
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
        setTimeout(
          () => {
            if (doc.users.size === 0) {
              this.cleanup(fileId);
            }
          },
          5 * 60 * 1000,
        ); // 5 min delay
      }
    }
  }
}

export default YjsDocManager;
