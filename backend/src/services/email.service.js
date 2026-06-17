import { Resend } from 'resend';
import config from '../config/index.js';
import { mailLogger, maskEmail } from '../utils/logger.js';

let resend = null;

function getClient() {
  if (!resend) {
    if (!config.email.apiKey) {
      mailLogger.log('SYSTEM', 'RESEND_API_KEY not configured — email sending disabled');
      return null;
    }
    resend = new Resend(config.email.apiKey);
  }
  return resend;
}

async function sendEmail({ to, subject, text }) {
  const client = getClient();
  if (!client) return;

  try {
    mailLogger.log('SYSTEM', `[EMAIL_SEND] Sending to ${maskEmail(to)} — subject="${subject}"`);
    const { data, error } = await client.emails.send({
      from: config.email.from,
      to,
      subject,
      text,
    });

    if (error) {
      mailLogger.error('SYSTEM', `[EMAIL_ERROR] Resend API error for ${maskEmail(to)}`, error);
      return;
    }

    mailLogger.log('SYSTEM', `[EMAIL_SUCCESS] Sent to ${maskEmail(to)} — id=${data.id}`);
  } catch (err) {
    mailLogger.error('SYSTEM', `[EMAIL_ERROR] Failed to send to ${maskEmail(to)}`, err);
  }
}

export async function sendWelcomeEmail({ email, fullName }) {
  await sendEmail({
    to: email,
    subject: 'Chào mừng bạn đến với POS Builders',
    text: `Xin chào ${fullName},\n\nTài khoản của bạn đã được tạo thành công.\n\nBạn có thể đăng nhập ngay bây giờ.\n\nTrân trọng,\nĐội ngũ POS Builders`,
  });
}

export async function sendInviteEmail({ email, fullName, inviteLink }) {
  await sendEmail({
    to: email,
    subject: 'Bạn được mời tham gia POS Builders',
    text: `Xin chào ${fullName},\n\nMột tài khoản đã được tạo cho bạn trên hệ thống POS Builders.\n\nVui lòng đặt mật khẩu qua đường link sau:\n${inviteLink}\n\nLink này có hiệu lực trong 24 giờ.\n\nTrân trọng,\nĐội ngũ POS Builders`,
  });
}

export async function sendPasswordResetEmail({ email, fullName, inviteLink }) {
  await sendEmail({
    to: email,
    subject: 'Đặt lại mật khẩu POS Builders',
    text: `Xin chào ${fullName},\n\nYêu cầu đặt lại mật khẩu của bạn đã được xử lý.\n\nVui lòng đặt mật khẩu mới qua đường link sau:\n${inviteLink}\n\nLink này có hiệu lực trong 24 giờ.\n\nTrân trọng,\nĐội ngũ POS Builders`,
  });
}

export async function sendCredentialsEmail({ email, fullName, password }) {
  await sendEmail({
    to: email,
    subject: 'Thông tin đăng nhập POS Builders',
    text: `Xin chào ${fullName},\n\nTài khoản của bạn đã được tạo.\n\nEmail đăng nhập: ${email}\nMật khẩu tạm thời: ${password}\n\nVui lòng đổi mật khẩu sau khi đăng nhập.\n\nTrân trọng,\nĐội ngũ POS Builders`,
  });
}
