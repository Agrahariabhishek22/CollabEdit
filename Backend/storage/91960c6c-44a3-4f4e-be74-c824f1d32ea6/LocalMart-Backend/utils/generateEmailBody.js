const generateEmailBody = (formData) => {
    const { name, email, message } = formData;
  
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f4f4f4; padding: 10px; border-left: 4px solid #007bff;">
          ${message}
        </p>
        <hr>
        <p style="font-size: 12px; color: #888;">This email was generated from the contact form on your website.</p>
      </div>
    `;
  };
  
  export default generateEmailBody;