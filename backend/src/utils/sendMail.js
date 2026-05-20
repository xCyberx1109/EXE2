import nodemailer from 'nodemailer';

export const sendMail = async ({ to, subject, html }) => {
  // Tạo transporter. Ở môi trường local/dev, ta có thể dùng mailtrap hoặc cấu hình gmail thông thường.
  // Ở đây chúng tôi sẽ lấy cấu hình từ biến môi trường.
  // Nếu không cấu hình, để tránh lỗi, ta sẽ in log hoặc sử dụng test account.
  
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('-------- EMAIL WARNING --------');
    console.warn(`EMAIL_USER hoặc EMAIL_PASS chưa được cấu hình.`);
    console.warn(`Không thể gửi email tự động tới: ${to}`);
    console.warn(`Nội dung thư:\nSubject: ${subject}\nHTML Content: ${html}`);
    console.warn('--------------------------------');
    return { success: false, reason: 'Chưa cấu hình thông tin SMTP để gửi mail.' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true cho port 465, false cho port 587 (STARTTLS)
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"FnB Store System" <${user}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    throw error;
  }
};