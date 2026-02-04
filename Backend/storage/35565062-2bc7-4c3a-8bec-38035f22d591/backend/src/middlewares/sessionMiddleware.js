import jwt from "jsonwebtoken";

export const validateDecryptionSession = async (req, res, next) => {
  try {
    console.log("Validating Decryption Session...");

    const token = req.cookies?.decrypt_token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        isAuthenticated: false, 
        message: "No decryption session found" 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.DECRYPT_SECRET);
    } catch (error) {
      console.log("JWT Error:", error.message);
      return res.status(401).json({ 
        success: false, 
        isAuthenticated: false, 
        message: "Session expired or invalid" 
      });
    }

    req.decryptionPassword = decoded.passHash;
    console.log("Decryption Password attached successfully");
    console.log(req.path);
    

    if (req.path === "/check") {
      return res.status(200).json({ success: true, isAuthenticated: true });
    }

    next();

  } catch (error) {
    console.error("Middleware Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};