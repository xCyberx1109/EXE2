import nodemailer from 'nodemailer';
import config from '../config/index.js';
import { mailLogger, maskEmail } from '../utils/logger.js';

let transporter = null;

function createTransporter() {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    mailLogger.log('SYSTEM', 'SMTP_HOST/USER/PASS not fully configured — skipping email send');
    return null;
  }
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

export async function verifyTransporter() {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    console.log(`[EMAIL] SMTP connection verified — ${config.email.host}:${config.email.port}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] SMTP connection failed — ${config.email.host}:${config.email.port}: ${err.message}`);
    return false;
  }
}

export async function sendWelcomeEmail({ email, fullName }) {
  const t = getTransporter();
  if (!t) return;
  try {
    mailLogger.log('SYSTEM', `[EMAIL_SEND] Sending welcome email to ${maskEmail(email)}`);
    await t.verify();
    const info = await t.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Chào mừng bạn đến với F&B Store',
      text: `Xin chào ${fullName},\n\nTài khoản của bạn đã được tạo thành công.\n\nBạn có thể đăng nhập ngay bây giờ.\n\nTrân trọng,\nĐội ngũ F&B Store`,
    });
    mailLogger.log('SYSTEM', `[EMAIL_SUCCESS] Welcome email sent to ${maskEmail(email)} — messageId=${info.messageId}`);
  } catch (err) {
    mailLogger.error('SYSTEM', `[EMAIL_ERROR] Failed to send welcome email to ${maskEmail(email)}`, err);
  }
}

export async function sendInviteEmail({ email, fullName, inviteLink }) {
  const t = getTransporter();
  if (!t) return;
  try {
    mailLogger.log('SYSTEM', `[EMAIL_SEND] Sending invite email to ${maskEmail(email)}`);
    await t.verify();
    const info = await t.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Bạn được mời tham gia F&B Store',
      text: `Xin chào ${fullName},\n\nMột tài khoản đã được tạo cho bạn trên hệ thống F&B Store.\n\nVui lòng đặt mật khẩu qua đường link sau:\n${inviteLink}\n\nLink này có hiệu lực trong 24 giờ.\n\nTrân trọng,\nĐội ngũ F&B Store`,
    });
    mailLogger.log('SYSTEM', `[EMAIL_SUCCESS] Invite email sent to ${maskEmail(email)} — messageId=${info.messageId}`);
  } catch (err) {
    mailLogger.error('SYSTEM', `[EMAIL_ERROR] Failed to send invite email to ${maskEmail(email)}`, err);
  }
}

export async function sendPasswordResetEmail({ email, fullName, inviteLink }) {
  const t = getTransporter();
  if (!t) return;
  try {
    mailLogger.log('SYSTEM', `[EMAIL_SEND] Sending password reset email to ${maskEmail(email)}`);
    await t.verify();
    const info = await t.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Đặt lại mật khẩu F&B Store',
      text: `Xin chào ${fullName},\n\nYêu cầu đặt lại mật khẩu của bạn đã được xử lý.\n\nVui lòng đặt mật khẩu mới qua đường link sau:\n${inviteLink}\n\nLink này có hiệu lực trong 24 giờ.\n\nTrân trọng,\nĐội ngũ F&B Store`,
    });
    mailLogger.log('SYSTEM', `[EMAIL_SUCCESS] Password reset email sent to ${maskEmail(email)} — messageId=${info.messageId}`);
  } catch (err) {
    mailLogger.error('SYSTEM', `[EMAIL_ERROR] Failed to send password reset email to ${maskEmail(email)}`, err);
  }
}

export async function sendCredentialsEmail({ email, fullName, password }) {
  const t = getTransporter();
  if (!t) return;
  try {
    mailLogger.log('SYSTEM', `[EMAIL_SEND] Sending credentials email to ${maskEmail(email)}`);
    await t.verify();
    const info = await t.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Thông tin đăng nhập F&B Store',
      text: `Xin chào ${fullName},\n\nTài khoản của bạn đã được tạo.\n\nEmail đăng nhập: ${email}\nMật khẩu tạm thời: ${password}\n\nVui lòng đổi mật khẩu sau khi đăng nhập.\n\nTrân trọng,\nĐội ngũ F&B Store`,
    });
    mailLogger.log('SYSTEM', `[EMAIL_SUCCESS] Credentials email sent to ${maskEmail(email)} — messageId=${info.messageId}`);
  } catch (err) {
    mailLogger.error('SYSTEM', `[EMAIL_ERROR] Failed to send credentials email to ${maskEmail(email)}`, err);
  }
}
