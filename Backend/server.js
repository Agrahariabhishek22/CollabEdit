import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser" 

const PORT = process.env.PORT || 3000;

const app = express();
// middlewares 
app.use(cors({
  origin:true,
  credentials: true
}));
// it parses json data sent by client into js object and put it in req.body
app.use(express.json()); 
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running ",
  });
});

// routes


const HOST = '0.0.0.0';
const startServer = async () => {
  try {
    app.listen(PORT,HOST,() => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  } 
};

startServer();
