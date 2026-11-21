module.exports = {
  apps: [{
    name: 'tekcard-api',
    script: 'src/server.js',
    cwd: __dirname,
    instances: 1, // SQLite: keep a single instance
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production' },
  }],
};
