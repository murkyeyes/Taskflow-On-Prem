const assert = require('node:assert/strict');
const test = require('node:test');

const express = require('express');

const {
  errorHandler,
  notFoundHandler,
} = require('../src/middlewares/errorHandler.middleware');
const HttpError = require('../src/utils/httpError');

async function withServer(app, run) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('central handler serializes an HttpError', async () => {
  const app = express();
  app.get('/failure', (request, response, next) => {
    next(new HttpError(409, 'CONFLICT', 'Resource conflict'));
  });
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: { code: 'CONFLICT', message: 'Resource conflict' },
    });
  });
});

test('unknown routes use the centralized handler', async () => {
  const app = express();
  app.use(notFoundHandler);
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
    });
  });
});
