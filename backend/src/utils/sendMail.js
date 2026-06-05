import nodemailer from 'nodemailer';
import { mailLogger, maskEmail } from './logger.js';

export const sendMail = async ({ to, subject, html, requestId }) => {
  const reqId = requestId || 'no-req';
  const startTime = Date.now();

  try {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    mailLogger.log(reqId, 'SMTP Config', {
      host,
      port,
      user: user ? maskEmail(user) : 'not-configured',
    });

    if (!user || !pass) {
      mailLogger.warn(reqId, 'EMAIL_SKIPPED — no SMTP credentials', { to, subject });
      return { success: false, reason: 'Chưa cấu hình thông tin SMTP để gửi mail.' };
    }

    mailLogger.log(reqId, 'EMAIL_SENDING', { to, subject });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"FnB Store System" <${user}>`,
      to,
      subject,
      html,
    });

    const duration = Date.now() - startTime;
    mailLogger.log(reqId, 'EMAIL_SENT_SUCCESS', {
      messageId: info.messageId,
      duration: `${duration}ms`,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const duration = Date.now() - startTime;
    mailLogger.error(reqId, 'EMAIL_SEND_FAILED', error, {
      duration: `${duration}ms`,
    });
    return { success: false, error: error.message };
  }
};