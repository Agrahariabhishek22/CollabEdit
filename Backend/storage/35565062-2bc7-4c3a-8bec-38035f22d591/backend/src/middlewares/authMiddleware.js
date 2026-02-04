import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res,next) => {
  try {
    console.log("inside auth");
    
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    } 
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
   
    req.user = decoded;

    next();
  } catch (error) {
    console.log("Error",error.message);
    
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


