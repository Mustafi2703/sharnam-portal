/** PM2 process manager — Hostinger VPS */
module.exports = {
  apps: [
    {
      name: "sharnam-portal",
      cwd: __dirname,
      script: "bash",
      args: "scripts/start-production.sh",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        SKIP_SEED: "1",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      time: true,
    },
  ],
};
