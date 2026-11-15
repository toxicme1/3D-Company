// Regenerates company-brain.js and agent-map.js from their JSON files (the page loads the .js so it also works from file://).
var fs = require('fs');
var data = JSON.parse(fs.readFileSync(__dirname + '/company-brain.json', 'utf8'));
fs.writeFileSync(__dirname + '/company-brain.js',
  '/* Generated from company-brain.json by build.js. Edit the JSON, then run: node build.js */\nwindow.COMPANY_BRAIN = ' + JSON.stringify(data, null, 1) + ';\n');
console.log('company-brain.js written: ' + data.offices.length + ' offices, ' + data.people.length + ' people');
var map = JSON.parse(fs.readFileSync(__dirname + '/agent-map.json', 'utf8'));
if (map.offices.length !== data.offices.length) { console.error('agent-map.json needs one role profile per office (' + data.offices.length + ')'); process.exit(1); }
fs.writeFileSync(__dirname + '/agent-map.js',
  '/* Generated from agent-map.json by build.js. */\nwindow.AGENT_MAP = ' + JSON.stringify(map, null, 1) + ';\n');
console.log('agent-map.js written: ' + map.offices.length + ' office agents');
