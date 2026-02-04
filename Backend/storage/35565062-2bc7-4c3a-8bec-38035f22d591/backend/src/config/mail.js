import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config();
// console.log("email user",process.env.EMAIL_USER);

export const transporter=nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS
    }
})

transporter.verify((error, success) => {
  if (error) {
    console.error("Email Server Error:", error);
  } else {
    console.log("Email Server is ready to take messages");
  }
});