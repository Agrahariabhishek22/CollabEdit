// Valid Extensions for our supported languages
const ALLOWED_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx", // JS/TS
  ".cpp",
  ".hpp",
  ".c",
  ".h", // C++
  ".py",
  ".pyc", // Python
  ".go", // Go
  ".java",
  ".class", // Java
  ".json",
  ".md",
  ".html",
  ".css", // Supporting web files
];

// Folders to completely ignore
const IGNORED_DIRS = [
  "node_modules",
  ".git",
  ".vscode",
  ".idea",
  "dist",
  "build",
  "target",
  "bin",
  "obj",
  "migrations",
  "__pycache__",
  "venv",
  "env",
];

// Blacklisted Binary/Media extensions
const FORBIDDEN_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".mov",
  ".mp3", // Media
  ".zip",
  ".rar",
  ".7z",
  ".tar", // Archives
  ".exe",
  ".dmg",
  ".iso",
  ".bin", // Binaries
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg", // Images
  ".db",
  ".sqlite",
  ".sql", // DB files (Safety first)
];

export const validateFile = (file) => {
  const path = file.webkitRelativePath.toLowerCase();
  const fileName = file.name.toLowerCase();

  // 1. Check for Ignored Directories
  const isIgnoredDir = IGNORED_DIRS.some((dir) => path.includes(`/${dir}/`));
  if (isIgnoredDir) return { valid: false, reason: "Ignored Directory" };

  // 2. Check for Forbidden Extensions
  const isForbidden = FORBIDDEN_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext),
  );
  if (isForbidden) return { valid: false, reason: "Unsupported File Type" };

  // 3. Size Check (Safety Limit: 50MB per file for Editor)
  if (file.size > 50 * 1024 * 1024)
    return { valid: false, reason: "File too large (>50MB)" };

  // 4. Final check: Is it in our allowed list?
  const isAllowed = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  return { valid: isAllowed, reason: isAllowed ? "OK" : "Unknown Extension" };
};

export const scanFolder = async (webkitFiles) => {
  const queue = [];

  const rejected = [];

  for (const file of webkitFiles) {
    const { valid, reason } = validateFile(file);

    if (valid) {
      queue.push({
        fileRef: file,

        relativePath: file.webkitRelativePath,

        size: file.size,

        fileId: `${file.name}-${file.size}-${file.lastModified}`,
      });
    } else {
      rejected.push({ name: file.name, reason });
    }
  }

  return { queue, rejected };
};
