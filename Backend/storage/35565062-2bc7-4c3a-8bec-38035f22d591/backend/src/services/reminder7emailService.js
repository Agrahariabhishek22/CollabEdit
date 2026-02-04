import { transporter } from "../config/mail.js";

export const reminder7emailService = async (to, title) => {
  try {
    return await transporter.sendMail({
      from: `"Digital Time Capsule" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Reminder for your Capsule "${title}" to be unlocked after 7 days!`,
      html:`
         <div>
            Dear User your Capsule with title ${title} will be unlocking after 7 days cheers!!
         </div>
      `
    });
  } catch (error) {
    throw new Error(`Nodemailer Error ${error.message}`);
  }
};
