const fs = require('fs');

// TekCard runs on its own Node 22 (/opt/node22) so other apps on the VPS keep their Node version.
const NODE = process.env.TEKCARD_NODE || (fs.existsSync('/opt/node22/bin/node') ? '/opt/node22/bin/node' : 'node');

module.exports = {
  apps: [{
    name: 'tekcard-api',
    script: 'src/server.js',
    cwd: __dirname,
    interpreter: NODE,
    instances: 1, // SQLite: keep a single instance
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
  }],
};
