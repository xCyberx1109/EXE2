import nodemailer from 'nodemailer';
import dns from 'dns';
import { mailLogger, maskEmail } from './logger.js';

dns.setDefaultResultOrder('ipv4first');

let transporter = null;
let transporterInitPromise = null;

const TRANSPORT_OPTIONS = () => ({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10),
  secure: false,
  requireTLS: true,
  family: 4,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  pool: true,
  maxConnections: 3,
  maxMessages: 30,
  rateDelta: 1000,
  rateLimit: 5,
  tls: {
    rejectUnauthorized: true,
    ciphers: 'HIGH',
  },
});

async function getTransporter() {
  if (transporter) return transporter;

  if (transporterInitPromise) {
    await transporterInitPromise;
    return transporter;
  }

  const opts = TRANSPORT_OPTIONS();
  if (!opts.auth.user || !opts.auth.pass) {
    mailLogger.warn('init', '[EMAIL_SKIPPED] SMTP not configured');
    return null;
  }

  transporterInitPromise = (async () => {
    try {
      const tr = nodemailer.createTransport(opts);
      await tr.verify();
      transporter = tr;
      mailLogger.log('init', '[SMTP_VERIFIED]', {
        host: opts.host,
        port: opts.port,
        user: maskEmail(opts.auth.user),
      });
    } catch (err) {
      transporter = nodemailer.createTransport(opts);
      mailLogger.warn('init', '[SMTP_VERIFY_FAILED] using fallback transport', {
        host: opts.host,
        port: opts.port,
        user: maskEmail(opts.auth.user),
        error: err.message,
      });
    } finally {
      transporterInitPromise = null;
    }
  })();

  await transporterInitPromise;
  return transporter;
}

function formatDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

async function sendMailInternal({ to, subject, html, requestId }) {
  const reqId = requestId || 'no-req';
  const startTime = Date.now();

  mailLogger.log(reqId, '[EMAIL_START]', { to: maskEmail(to), subject: subject?.substring(0, 50) });

  const tr = await getTransporter();
  if (!tr) {
    mailLogger.warn(reqId, '[EMAIL_SKIPPED] SMTP not configured', { to: maskEmail(to) });
    return { success: false, reason: 'SMTP chưa được cấu hình' };
  }

  const user = process.env.SMTP_USER || process.env.EMAIL_USER;

  const info = await tr.sendMail({
    from: `"FnB Store System" <${user}>`,
    to,
    subject,
    html,
  });

  const duration = Date.now() - startTime;
  mailLogger.log(reqId, '[EMAIL_SENT]', {
    messageId: info.messageId,
    to: maskEmail(to),
    duration: formatDuration(duration),
  });

  return { success: true, messageId: info.messageId };
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
