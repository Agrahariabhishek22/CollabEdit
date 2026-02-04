export const checkTotalSize = async (req, res, next) => {
  try {
    // console.log("inside total size");

    if (!req.files) return next();

    const totalsize = req.files.reduce((acc, file) => acc + file.size, 0);
    const MAX = 16 * 1024 * 1024;

    if (totalsize > MAX) {
      return res.status(400).json({
        message: "Total size of all files should not exceed 16MB",
      });
    }
    next();
  } catch (error) {
    console.log("Error", error.message);
  }
};
