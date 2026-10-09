const VERIFIED_EMAIL = 'vishnubangaru001@gmail.com';

const isVerifiedAccount = (email) => (
  typeof email === 'string' && email.trim().toLowerCase() === VERIFIED_EMAIL
);

module.exports = { isVerifiedAccount };
