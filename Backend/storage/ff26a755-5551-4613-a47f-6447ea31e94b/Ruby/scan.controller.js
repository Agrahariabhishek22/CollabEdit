import prisma from "../../prisma.js";
import fs from "fs";
import { detectNamingAnomalies } from "../services/anomaly.service.js";
import {
  detectExactDuplicates,
  detectNearDuplicates,
} from "../services/duplicate.service.js";
import { detectInefficiencies } from "../services/inefficiency.service.js";
import { startLocalScan } from "../services/localScanner.service.js";
import { emitToSession } from "../websocket/ws.server.js";
import { registerWatchForSession } from "../watch/watchTarget.manager.js";

export const triggerScan = async (req, res) => {
  try {
    // console.log("inside the trigger scan");
    
    const { scanName, sources, localPaths = [], driveIds = [] } = req.body;
    console.log(scanName);
    
    const mappedPaths = localPaths.map((p) => {
      const cleanPath = p.startsWith("/") ? p : `/scan_data/${p}`;
      if (!fs.existsSync(cleanPath)) {
        console.error(`Path NOT accessible: ${cleanPath}`);
      }
      return cleanPath;
    });

    const session = await prisma.scanSession.create({
      data: {
        scanName,
        sources: sources.join(","),
        localRootPaths: JSON.stringify(mappedPaths),
        driveRootFolderIds: JSON.stringify(driveIds),
        status: "scanning",
        startTime: new Date(),
      },
    });
    // console.log(session);
    

    res.status(201).json({
      message: "Scan initialized",
      success: true,
      sessionId: session.id,
    });

    // Background Pipeline
    (async () => {
      const sessionId = session.id;

      try {
        emitToSession(sessionId, "scan_started", {
          phase: "Scanning Directories",
          progress: 0,
        });

        // ---------- SCANNING ----------
        emitToSession(sessionId, "phase_started", {
          phase: "Scanning Files",
          progress: 10,
        });
        if (sources.includes("local")) {
          await startLocalScan(sessionId, mappedPaths);
        }
        emitToSession(sessionId, "phase_completed", {
          phase: "Scanning Files",
          progress: 30,
        });

        // Database update status
        await prisma.scanSession.update({
          where: { id: sessionId },
          data: { status: "analyzing" },
        });

        // Fetch files for analysis
        const files = await prisma.fileMeta.findMany({
          where: { scanSessionId: sessionId, isFolder: false, hidden: false },
        });

        // ---------- EXACT DUPLICATES ----------
        emitToSession(sessionId, "phase_started", {
          phase: "Exact Duplicate Detection",
          progress: 35,
        });
        await detectExactDuplicates(sessionId, files);
        emitToSession(sessionId, "phase_completed", {
          phase: "Exact Duplicate Detection",
          progress: 50,
        });

        // ----------  NEAR DUPLICATES ----------
        emitToSession(sessionId, "phase_started", {
          phase: "Near Duplicate Detection",
          progress: 55,
        });
        await detectNearDuplicates(sessionId, files);
        emitToSession(sessionId, "phase_completed", {
          phase: "Near Duplicate Detection",
          progress: 70,
        });

        // ----------  NAMING ANOMALIES ----------
        emitToSession(sessionId, "phase_started", {
          phase: "Naming Anomalies",
          progress: 75,
        });
        await detectNamingAnomalies(sessionId, files);
        emitToSession(sessionId, "phase_completed", {
          phase: "Naming Anomalies",
          progress: 85,
        });

        // ----------  INEFFICIENCIES ----------
        emitToSession(sessionId, "phase_started", {
          phase: "Storage Inefficiencies",
          progress: 90,
        });
        await detectInefficiencies(sessionId, files);
        emitToSession(sessionId, "phase_completed", {
          phase: "Storage Inefficiencies",
          progress: 95,
        });

        // ---------- FINAL ----------
        await prisma.scanSession.update({
          where: { id: sessionId },
          data: { status: "completed", endTime: new Date() },
        });

        emitToSession(sessionId, "scan_completed", {
          sessionId,
          progress: 100,
          message: "Full Analysis Finished",
        });

        await registerWatchForSession(session);
      } catch (err) {
        console.error("Pipeline Error:", err);
        await prisma.scanSession.update({
          where: { id: sessionId },
          data: { status: "failed" },
        });
        emitToSession(sessionId, "scan_error", { message: err.message });
      }
    })();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
