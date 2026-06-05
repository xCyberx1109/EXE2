import { Resend } from 'resend';
import { mailLogger, maskEmail } from './logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_NAME = 'FnB Store System';

function getFromEmail() {
  return process.env.FROM_EMAIL || 'onboarding@resend.dev';
}

function formatDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

async function sendMailInternal({ to, subject, html, requestId }) {
  const reqId = requestId || 'no-req';
  const startTime = Date.now();

  mailLogger.log(reqId, '[EMAIL_START]', { to: maskEmail(to), subject: subject?.substring(0, 50) });

  if (!process.env.RESEND_API_KEY) {
    mailLogger.warn(reqId, '[EMAIL_SKIPPED] RESEND_API_KEY not configured', { to: maskEmail(to) });
    return { success: false, reason: 'Resend chưa được cấu hình' };
  }

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${getFromEmail()}>`,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw error;
  }

  const duration = Date.now() - startTime;
  mailLogger.log(reqId, '[EMAIL_SENT]', {
    messageId: data?.id,
    to: maskEmail(to),
    duration: formatDuration(duration),
  });

  return { success: true, messageId: data?.id };
}

export async function sendMail({ to, subject, html, requestId }) {
  try {
    return await sendMailInternal({ to, subject, html, requestId });
  } catch (error) {
    const reqId = requestId || 'no-req';
    mailLogger.error(reqId, '[EMAIL_ERROR]', error, {
      to: maskEmail(to),
      subject: subject?.substring(0, 50),
    });
    return { success: false, error: error.message };
  }
}

export function sendMailAsync({ to, subject, html, requestId }) {
  const reqId = requestId || 'no-req';

  setImmediate(() => {
    sendMailInternal({ to, subject, html, requestId }).catch((error) => {
      mailLogger.error(reqId, '[EMAIL_ERROR][ASYNC]', error, {
        to: maskEmail(to),
        subject: subject?.substring(0, 50),
      });
    });
  });

  mailLogger.log(reqId, '[EMAIL_DISPATCHED]', { to: maskEmail(to) });
  return { success: true, dispatched: true };
}

const sentRequests = new Set();

export function hasEmailBeenSent(requestId) {
  if (!requestId) return false;
  return sentRequests.has(requestId);
}

export function markEmailSent(requestId) {
  if (!requestId) return;
  sentRequests.add(requestId);
  if (sentRequests.size > 1000) {
    const iter = sentRequests.values().next();
    if (iter.value) sentRequests.delete(iter.value);
  }
}
