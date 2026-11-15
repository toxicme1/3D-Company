'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, test } = require('node:test');
const { fetchModels } = require('./3DCOMPANY.js');

let server;
let baseUrl;
let receivedAuthorization;

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('fetches model IDs from the authenticated models endpoint', async () => {
  server = http.createServer((request, response) => {
    receivedAuthorization = request.headers.authorization;
    if (request.url !== '/v1/models') {
      response.writeHead(404).end();
      return;
    }
    if (receivedAuthorization !== 'Bearer test-key') {
      response.writeHead(401, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: { message: 'Invalid API key' } }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-a' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/v1';

  assert.deepEqual(await fetchModels(baseUrl, 'test-key'), ['model-a', 'model-b']);
  assert.equal(receivedAuthorization, 'Bearer test-key');
});

test('surfaces provider authentication errors from the models endpoint', async () => {
  await assert.rejects(fetchModels(baseUrl, 'wrong-key'), /HTTP 401.*Invalid API key/);
});
