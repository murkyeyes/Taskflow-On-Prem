const app = require('./app');
const env = require('./config/env');
const systemRepository = require('./repositories/system.repository');
const { validateLicense } = require('./middlewares/licenseCheck.middleware');

validateLicense(env);

function startServer(port = env.port) {
  return app.listen(port, '0.0.0.0', () => {
    if (env.nodeEnv !== 'test') {
      console.log(`Taskflow API listening on port ${port}`);
    }
  });
}

async function startApplication(port = env.port) {
  await systemRepository.checkConnection();
  return startServer(port);
}

if (require.main === module) {
  startApplication().catch((error) => {
    const errorCode = error?.code ? ` [${error.code}]` : '';
    const errorMessage = error?.message ? `: ${error.message}` : '';
    console.error(`Taskflow API failed to start${errorCode}${errorMessage}`);
    process.exitCode = 1;
  });
}

module.exports = startServer;
module.exports.startApplication = startApplication;
