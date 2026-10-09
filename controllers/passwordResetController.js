const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const PasswordResetState = require('../models/PasswordResetState');
const PasswordResetCounter = require('../models/PasswordResetCounter');

const genericRequestMessage = 'If an account matches that email and email delivery is available, a reset code will arrive shortly.';
const WINDOW_MS = 30 * 60 * 1000;
const COUNTER_TTL_MS = 48 * 60 * 60 * 1000;
const pepper = () => process.env.PASSWORD_RESET_PEPPER || '';
const digest = (value) => crypto.createHmac('sha256', pepper()).update(value).digest('hex');
const matchesDigest = (left, right) => {
  const leftBytes = Buffer.from(left || '', 'hex');
  const rightBytes = Buffer.from(right || '', 'hex');
  return leftBytes.length === rightBytes.length && leftBytes.length > 0 && crypto.timingSafeEqual(leftBytes, rightBytes);
};
const ipKey = (ip) => `ip:${digest(ip || 'unknown')}`;
const userKey = (id) => `user:${digest(id.toString())}`;

const reserveCounter = async (key, limit, now = new Date()) => {
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  await PasswordResetCounter.updateOne(
    { key },
    { $setOnInsert: { key, count: 0, windowStartedAt: now, expiresAt: new Date(now.getTime() + COUNTER_TTL_MS) } },
    { upsert: true }
  );

  return PasswordResetCounter.findOneAndUpdate(
    { key, $or: [{ windowStartedAt: { $lte: cutoff } }, { count: { $lt: limit } }] },
    [{ $set: {
      count: { $cond: [{ $lte: ['$windowStartedAt', cutoff] }, 1, { $add: ['$count', 1] }] },
      windowStartedAt: { $cond: [{ $lte: ['$windowStartedAt', cutoff] }, now, '$windowStartedAt'] },
      expiresAt: new Date(now.getTime() + COUNTER_TTL_MS)
    } }],
    { new: true }
  );
};

const releaseCounter = async (key, windowStartedAt) => {
  await PasswordResetCounter.updateOne(
    { key, windowStartedAt, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
};

const hasMailConfiguration = () => Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
);

const createTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const requestPasswordReset = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET || !pepper()) {
      return res.status(503).json({ success: false, message: 'Password recovery is temporarily unavailable.' });
    }
    if (!hasMailConfiguration()) {
      return res.status(503).json({ success: false, message: 'Password recovery email is not configured on this server yet.' });
    }

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const generic = () => res.status(200).json({ success: true, message: genericRequestMessage });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic();

    const ipSlot = await reserveCounter(ipKey(req.ip), 20);
    if (!ipSlot) return generic();

    const user = await User.findOne({ email }).select('_id email');
    if (!user) return generic();

    const accountSlot = await reserveCounter(userKey(user._id), 5);
    if (!accountSlot) return generic();

    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = digest(`${user._id}:${code}`);
    await PasswordResetState.findOneAndUpdate(
      { user: user._id },
      { $set: {
        codeHash,
        codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verificationAttempts: 0,
        resetTokenHash: '',
        resetTokenExpiresAt: null,
        consumedAt: null
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      await createTransport().sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: 'Your Nexora password reset code',
        text: `Your Nexora password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`,
        html: `<p>Your Nexora password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>It expires in 10 minutes. If you did not request this, ignore this message.</p>`
      });
    } catch (mailError) {
      await Promise.all([
        PasswordResetState.updateOne({ user: user._id, codeHash }, { $set: { codeHash: '', codeExpiresAt: null } }),
        releaseCounter(userKey(user._id), accountSlot.windowStartedAt)
      ]);
      console.error('[Password Reset] Email delivery failed:', mailError.message);
      return generic();
    }

    return generic();
  } catch (error) { next(error); }
};

const verifyPasswordResetCode = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body.code === 'string' ? req.body.code : '';
    if (!/^\d{6}$/.test(code) || !email) {
      return res.status(400).json({ success: false, message: 'The code is invalid or expired.' });
    }
    if (!(await reserveCounter(ipKey(req.ip), 40))) {
      return res.status(429).json({ success: false, message: 'Too many verification attempts. Try again later.' });
    }

    const user = await User.findOne({ email }).select('_id');
    if (!user) return res.status(400).json({ success: false, message: 'The code is invalid or expired.' });
    const now = new Date();
    const state = await PasswordResetState.findOneAndUpdate(
      { user: user._id, codeExpiresAt: { $gt: now }, verificationAttempts: { $lt: 5 }, consumedAt: null },
      { $inc: { verificationAttempts: 1 } },
      { new: true }
    );
    if (!state?.codeHash || !matchesDigest(digest(`${user._id}:${code}`), state.codeHash)) {
      return res.status(400).json({ success: false, message: 'The code is invalid or expired.' });
    }

    const resetToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = digest(resetToken);
    const consumed = await PasswordResetState.findOneAndUpdate(
      { user: user._id, codeHash: state.codeHash, codeExpiresAt: { $gt: now }, resetTokenHash: '' },
      { $set: { codeHash: '', codeExpiresAt: null, resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(now.getTime() + 10 * 60 * 1000) } },
      { new: true }
    );
    if (!consumed) return res.status(400).json({ success: false, message: 'The code is invalid or expired.' });
    return res.json({ success: true, resetToken, expiresInSeconds: 600 });
  } catch (error) { next(error); }
};

const completePasswordReset = async (req, res, next) => {
  try {
    if (!(await reserveCounter(ipKey(req.ip), 100))) {
      return res.status(429).json({ success: false, message: 'Too many reset attempts. Try again later.' });
    }
    const { resetToken, newPassword, confirmPassword } = req.body;
    if (typeof resetToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(resetToken)) {
      return res.status(400).json({ success: false, message: 'The reset authorization is invalid or expired.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must be between 8 and 128 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const now = new Date();
    const state = await PasswordResetState.findOneAndUpdate(
      { resetTokenHash: digest(resetToken), resetTokenExpiresAt: { $gt: now }, consumedAt: null },
      { $set: { consumedAt: now, resetTokenHash: '', resetTokenExpiresAt: null, codeHash: '', codeExpiresAt: null } },
      { new: true }
    );
    if (!state) return res.status(400).json({ success: false, message: 'The reset authorization is invalid or expired.' });

    const user = await User.findById(state.user).select('+password tokenVersion');
    if (!user) return res.status(400).json({ success: false, message: 'The reset authorization is invalid or expired.' });
    user.password = newPassword;
    user.tokenVersion += 1;
    await user.save();
    return res.json({ success: true, message: 'Password reset. Sign in with your new password.' });
  } catch (error) { next(error); }
};

module.exports = { requestPasswordReset, verifyPasswordResetCode, completePasswordReset };
