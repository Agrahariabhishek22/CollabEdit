// Logging Middleware
import { config } from "../config/env.js";

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`;

    if (config.NODE_ENV === "development") {
      if (res.statusCode >= 400) {
        console.error(` ${log}`);
      } else {
        console.log(`✓ ${log}`);
      }
    }
  });

  next();
};
