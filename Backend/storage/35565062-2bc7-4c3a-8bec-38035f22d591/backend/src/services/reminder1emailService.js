import { transporter } from "../config/mail.js";

export const reminder1emailService = async (to, title) => {
  try {
    return await transporter.sendMail({
      from: `"Digital Time Capsule" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Reminder for your Capsule "${title}" to be unlocked after 1 day!`,
      html:`
         <div>
            Dear User your Capsule with title ${title} will be unlocking after 1 day cheers!!
         </div>
      `
    });
  } catch (error) {
    throw new Error(`Nodemailer Error ${error.message}`);
  }
};
