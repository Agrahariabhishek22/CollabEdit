import path from "path";

import prisma from "../../prisma.js";
import { calculatePHashSimilarity, calculateSimHashSimilarity } from "../services/duplicate.service.js";

export const getExactDuplicatesByFolder = async (req, res) => {
  try {
    const { sessionId } = req.query;
    const { parentId } = req.query;

    console.log(
      `[Contextual Analysis] Session: ${sessionId}, Folder: ${parentId}`,
    );

    // 1. Pehle wahi files uthao jo is specific folder (aur subfolders) mein hain
    const targetFiles = await prisma.fileMeta.findMany({
      where: {
        scanSessionId: sessionId,
        isFolder: false,
        parentId: parentId === "null" ? null : parentId,
      },
      select: {
        id: true,
        fileName: true,
        absolutePath: true,
        size: true, // Savings calculate karne ke liye
        sourceType: true,
        extension: true,
        fileType: true, // contentType ke liye
        modifiedAt: true,
        createdAt: true, // Sorting ke liye
        hashes: {
          where: { hashType: "exact" },
          select: { value: true }, // Sirf hash string laao
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!targetFiles.length) {
      return res.status(200).json({ success: true, totalGroups: 0, data: {} });
    }

    const hashMap = {};
    targetFiles.forEach((file) => {
      const hashValue = file.hashes[0]?.value;
      if (hashValue) {
        if (!hashMap[hashValue]) hashMap[hashValue] = [];
        hashMap[hashValue].push(file);
      }
    });
    const hydratedGroups = [];

    Object.keys(hashMap).forEach((hash) => {
      const files = hashMap[hash];

      if (files.length > 1) {
        const formattedFiles = files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          absolutePath: f.absolutePath,
          size: f.size.toString(),
          sourceType: f.sourceType,
          extension: f.extension,
          modifiedAt: f.modifiedAt,
        }));

        const firstFile = files[0];
        const potentialSaving =
          BigInt(firstFile.size) * BigInt(files.length - 1);

        hydratedGroups.push({
          groupId: `context_${hash.substring(0, 8)}`, // Unique ID for UI
          contentType: firstFile.fileType,
          potentialSaving: potentialSaving.toString(),
          files: formattedFiles,
          baseReference: formattedFiles[0].fileName, // Card title ke liye reference
        });
      }
    });

    // 4. Final grouping on baseReference (as per your standard)
    const finalData = hydratedGroups.reduce((acc, group) => {
      const key = group.baseReference;
      if (!acc[key]) acc[key] = [];
      acc[key].push(group);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      totalGroups: hydratedGroups.length,
      data: finalData,
    });
  } catch (error) {
    console.error("❌ Error in Contextual Duplicates:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getNearDuplicatesByFolder = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parentId } = req.query;

    const targetHashes = await prisma.fileHash.findMany({
      where: {
        hashType: "near_field",
        file: {
          scanSessionId: sessionId,
          isFolder: false,
          parentId: parentId === "null" ? null : parentId,
        },
      },
      select: {
        fileMetaId: true,
        value: true,
        algorithm: true, // pHash ya simhash check karne ke liye
        file: {
          select: {
            id: true,
            fileName: true,
            absolutePath: true,
            size: true,
            sourceType: true,
            extension: true,
            modifiedAt: true,
            fileType: true,
          },
        },
      },
    });

    if (targetHashes.length < 2) {
      return res
        .status(200)
        .json({ success: true, totalNearGroups: 0, data: [] });
    }

    const groups = [];

    // Grouping Logic with Algorithm Support
    for (const current of targetHashes) {
      let addedToGroup = false;

      for (const group of groups) {
        if (current.algorithm !== group.algorithm) continue;

        let similarity = 0;
        if (current.algorithm === "phash") {
          similarity = calculatePHashSimilarity(
            current.value,
            group.leaderHash,
          );
        } else {
          similarity = calculateSimHashSimilarity(
            current.value,
            group.leaderHash,
          );
        }

        if (similarity > 0.85) {
          group.files.push(current.file);
          group.maxSimilarity = Math.max(group.maxSimilarity, similarity);
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        groups.push({
          leaderHash: current.value,
          algorithm: current.algorithm,
          files: [current.file],
          type: current.file.fileType,
          maxSimilarity: 0,
        });
      }
    }

    // Final Formatting
    const finalGroups = groups
      .filter((g) => g.files.length > 1)
      .map((g, index) => {
        const formattedFiles = g.files.map((f) => ({
          ...f,
          size: f.size.toString(),
        }));

        return {
          groupId: `near_ctx_${index}_${Date.now()}`,
          groupName: `Similar ${g.algorithm === "phash" ? "Media" : "Content"}: ${formattedFiles[0].fileName}`,
          algorithm: g.algorithm,
          contentType: g.type,
          matchPercentage: `${(g.maxSimilarity * 100).toFixed(0)}%`,
          fileCount: formattedFiles.length,
          files: formattedFiles,
        };
      });

    finalGroups.sort(
      (a, b) => parseInt(b.matchPercentage) - parseInt(a.matchPercentage),
    );

    res.status(200).json({
      success: true,
      totalNearGroups: finalGroups.length,
      data: finalGroups,
    });
  } catch (error) {
    console.error("Contextual Near-Dup Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getContextualNamingAnomalies = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parentId } = req.query;

    const files = await prisma.fileMeta.findMany({
      where: {
        scanSessionId: sessionId,
        parentId: parentId === "null" ? null : parentId,
        isFolder: false,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!files.length) {
      return res
        .status(200)
        .json({ success: true, totalAnomalies: 0, data: [] });
    }

    const versionGroups = {};
    const missingExtFiles = [];
    const finalAnomalies = []; // Hum object ki jagah array use karenge

    for (const file of files) {
      const { baseName, versionPattern } = analyzeNameLogic(file.fileName);

      // --- RULE 1: Missing Extension ---
      const knownExtensionless = [
        "dockerfile",
        "makefile",
        "jenkinsfile",
        ".env",
        ".gitignore",
        "procfile",
      ];

      // Drive native files logic
      const isDriveNative =
        file.sourceType === "gdrive" &&
        file.mimeType?.startsWith("application/vnd.google-apps");

      if (
        !file.extension &&
        !knownExtensionless.includes(file.fileName.toLowerCase()) &&
        !isDriveNative
      ) {
        missingExtFiles.push({
          ...file,
          size: file.size.toString(),
        });
      }

      // Grouping for Rule 2
      if (!versionGroups[baseName]) versionGroups[baseName] = [];
      versionGroups[baseName].push({ file, versionPattern });
    }

    // 1. Missing Extensions ko sabse pehle add karo (Grouped)
    if (missingExtFiles.length > 0) {
      finalAnomalies.push({
        id: "missing-ext-group",
        title:
          missingExtFiles.length === 1
            ? `File "${missingExtFiles[0].fileName}" is missing an extension`
            : "Multiple files are missing extensions",
        baseName:
          missingExtFiles.length === 1
            ? missingExtFiles[0].fileName
            : "Various",
        type: "missing_extension",
        severity: "high",
        suggestedPattern: "filename.<extension>",
        fileCount: missingExtFiles.length,
        files: missingExtFiles,
      });
    }

    // 2. Inconsistent Versioning ko add karo (Grouped by BaseName)
    for (const [baseName, entries] of Object.entries(versionGroups)) {
      if (entries.length < 2) continue;

      const uniquePatterns = [
        ...new Set(entries.map((e) => e.versionPattern).filter(Boolean)),
      ];

      // Agar same basename ke liye different patterns milte hain
      if (uniquePatterns.length > 1) {
        finalAnomalies.push({
          id: `inconsistent-v-${baseName}-${Date.now()}`,
          title: `Inconsistent Versioning detected for "${baseName}"`,
          baseName: baseName,
          type: "inconsistent_versioning",
          severity: "medium",
          suggestedPattern: `${baseName}_vX`,
          fileCount: entries.length,
          files: entries.map((e) => ({
            ...e.file,
            size: e.file.size.toString(),
          })),
        });
      }
    }

    // Response exactly like your requested format
    res.status(200).json({
      success: true,
      totalAnomalies: finalAnomalies.length,
      data: finalAnomalies, // Array return ho raha hai
    });
  } catch (error) {
    console.error("Naming Anomaly Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const analyzeNameLogic = (fileName) => {
  const parsed = path.parse(fileName);
  let name = parsed.name;

  const versionRegexes = {
    v_prefix: /[vV]\d+/, // v1, V2
    version_word: /version[_\s]?\d+/i, // version 1, version_01
    underscore_num: /_\d+$/, // file_01
    bracket_num: /\(\d+\)$/, // file(1)
  };

  let detectedPattern = null;
  for (const [key, regex] of Object.entries(versionRegexes)) {
    if (regex.test(name)) {
      detectedPattern = key;
      break;
    }
  }
  const baseName = name
    .replace(/[vV]\d+/g, "")
    .replace(/version[_\s]?\d+/gi, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[_\-]\d+$/g, "")
    .replace(/[_\-]+$/g, "")
    .trim();

  return { baseName, versionPattern: detectedPattern };
};

export const getContextualInefficiencies = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parentId } = req.query;
    const now = Date.now();

    const files = await prisma.fileMeta.findMany({
      where: { 
        scanSessionId: sessionId,
        parentId: parentId === "null" ? null : parentId,
        isFolder: false,
      },
      select: {
        id: true,
        fileName: true,
        absolutePath: true,
        size: true,
        extension: true,
        fileType: true,
        createdAt: true,
        modifiedAt: true,
        accessedAt: true,
      },
    });

    if (!files.length)
      return res.status(200).json({ success: true, totalGroups: 0, data: [] });

    // 2. Simple grouping object
    const groups = {
      unused_large_files: [],
      modified_not_opened: [],
      misplaced_media: [],
      old_archives: [],
      system_noise: [],
    };

    // 3. One-pass analysis
    files.forEach((file) => {
      const ageDays = diffDays(now, file.createdAt);
      const accessDays = file.accessedAt
        ? diffDays(now, file.accessedAt)
        : ageDays;
      const sizeMB = Number(file.size) / (1024 * 1024);
      const ext = (file.extension || "").toLowerCase();

      if (sizeMB > 500 && accessDays > 180)
        groups.unused_large_files.push(file);

      if (
        file.modifiedAt &&
        file.accessedAt &&
        diffDays(file.modifiedAt, file.accessedAt) > 90
      ) {
        groups.modified_not_opened.push(file);
      }

      if (
        ["video", "image"].includes(file.fileType) &&
        sizeMB > 100 &&
        isSystemPath(file.absolutePath)
      ) {
        groups.misplaced_media.push(file);
      }

      if (
        [".zip", ".rar", ".bak", ".tmp", ".old"].includes(ext) &&
        ageDays > 180 &&
        accessDays > 180
      ) {
        groups.old_archives.push(file);
      }

      if ([".ds_store", "thumbs.db"].includes(file.fileName.toLowerCase())) {
        groups.system_noise.push(file);
      }
    });

    // 4. Clean Data Hydration
    const data = Object.entries(groups)
      .filter(([_, list]) => list.length > 0)
      .map(([type, list]) => {
        const meta = getPatternMeta(type);
        const wasted = list.reduce((acc, f) => acc + Number(f.size), 0);

        return {
          id: `ineff-${type}`,
          type,
          title: meta.title,
          description: getReason(type),
          fileCount: list.length,
          wastedSpace: wasted.toString(),
          files: list.map((f) => ({ ...f, size: f.size.toString() })),
        };
      });

    res.status(200).json({ success: true, totalGroups: data.length, data });
  } catch (error) {
    console.error("Inefficiency Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const diffDays = (a, b) =>
  Math.abs(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24);
const isSystemPath = (path = "") =>
  /node_modules|src|bin|lib|system|dist|build/i.test(path);

const getReason = (type) =>
  ({
    unused_large_files: "Large files not accessed for a long time.",
    modified_not_opened: "Files updated but rarely opened.",
    misplaced_media: "Media files in system/code folders.",
    old_archives: "Stale backup files.",
    system_noise: "System-generated clutter.",
  })[type];

const getPatternMeta = (type) =>
  ({
    unused_large_files: { title: "Unused Large Files" },
    modified_not_opened: { title: "Ghost Updates" },
    misplaced_media: { title: "Misplaced Media" },
    old_archives: { title: "Stale Archives" },
    system_noise: { title: "System Clutter" },
  })[type] || { title: "General Inefficiency" };
