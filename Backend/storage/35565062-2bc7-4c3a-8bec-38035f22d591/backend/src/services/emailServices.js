import { transporter } from "../config/mail.js";

export const emailService = async (to, title) => {
  try {
    return await transporter.sendMail({
      from: `"Digital Time Capsule" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Your Capsule "${title}" is now unlocked!`,
      html:`
         <div>
            Dear User your Capsule with title ${title} have been unlocked cheers!!
         </div>
      `
    });
  } catch (error) {
    throw new Error(`Nodemailer Error ${error.message}`);
  }
};
