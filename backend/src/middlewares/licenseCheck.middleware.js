const crypto = require('node:crypto');

function expectedLicense(fingerprint) {
  return crypto.createHash('sha256').update(`taskflow:${fingerprint}`).digest('hex');
}

function validateLicense(env) {
  if (env.nodeEnv !== 'production') return;
  if (!env.hostFingerprint || !env.licenseKey || !/^[a-f0-9]{64}$/i.test(env.licenseKey)) {
    throw new Error('Production license configuration is missing');
  }
  const expected = expectedLicense(env.hostFingerprint);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(env.licenseKey.toLowerCase()))) {
    throw new Error('Production license validation failed');
  }
}

module.exports = { expectedLicense, validateLicense };
