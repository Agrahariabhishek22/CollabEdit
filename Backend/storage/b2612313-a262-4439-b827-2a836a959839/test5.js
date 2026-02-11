const projectRoot = path.join(process.env.STORAGE_PATH, projectId, finalFileName); 
// projectRoot ban gaya: /app/storage/00c76.../test3.js

if (!fs.existsSync(projectRoot)) {
  await fsPromises.mkdir(projectRoot, { recursive: true }); 
  // Yahan "test3.js" naam ka FOLDER ban gaya!
}
if (!isFolder && content) {
  const filePath = path.join(projectRoot, name); 
  // filePath ban gaya: /app/storage/00c76.../test3.js/test3.js
  await fsPromises.writeFile(filePath, content, "utf-8");
}