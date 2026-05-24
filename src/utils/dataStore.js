const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function read(filename) {
  const file = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function write(filename, data) {
  const file = path.join(DATA_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = { read, write, DATA_DIR };
