const bcrypt = require('bcryptjs');
const settingsRepository = require('../repositories/settings.repository');
const userRepository = require('../repositories/user.repository');
const HttpError = require('../utils/httpError');

async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepository.findWithPasswordById(userId);
  if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) throw new HttpError(400, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect');
  await userRepository.updatePasswordHash(userId, await bcrypt.hash(newPassword, 12));
}

module.exports = {
  changePassword,
  getPreferences: settingsRepository.getPreferences,
  getSystem: settingsRepository.getSystem,
  updatePreferences: settingsRepository.updatePreferences,
  updateSystem: settingsRepository.updateSystem,
};
