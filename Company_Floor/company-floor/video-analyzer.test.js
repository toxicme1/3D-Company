'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  extractYouTubeId,
  formatTimestamp,
  generateTimestamps,
  analyzeVideo
} = require('./video-analyzer.js');

test('video analyzer extracts IDs only from supported HTTPS YouTube URLs', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYouTubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYouTubeId('http://youtube.com/watch?v=abcdefghijk'), null);
  assert.equal(extractYouTubeId('https://youtube.com.evil.example/watch?v=abcdefghijk'), null);
});

test('video analyzer produces bounded timestamps and formats them', () => {
  assert.deepEqual(generateTimestamps(60, 6), [0, 15, 30, 45, 55]);
  assert.equal(formatTimestamp(125.8), '2:05');
  assert.throws(() => generateTimestamps(60, 1), /between 2 and 20/);
});

test('YouTube processing requires an explicit permission confirmation', async () => {
  await assert.rejects(
    analyzeVideo('https://www.youtube.com/watch?v=abcdefghijk'),
    /requires permission/
  );
});
