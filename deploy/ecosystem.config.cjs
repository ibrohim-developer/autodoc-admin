/**
 * pm2 unit for the admin API. It also serves the built dashboard at the admin origin.
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup     # survive a reboot
 *
 * Settings come from api/.env (copy api/.env.example). Migrations run on start.
 */
module.exports = {
  apps: [
    {
      name: 'autodoc-api',
      cwd: '/var/www/autodoc-admin/api',
      script: 'dist/main.js',

      // One instance: rate limits and the daily statistics salt live in process memory.
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
      },

      max_memory_restart: '512M',
      autorestart: true,
      // Give in-flight requests and the database pool time to close on reload.
      kill_timeout: 10_000,
    },
  ],
}
