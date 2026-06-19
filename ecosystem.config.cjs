// PM2 ecosystem file. Usar con:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 start ecosystem.config.cjs --env staging
//
// Variables de entorno: ver apps/api/.env.example

module.exports = {
  apps: [
    {
      name: "polar-school-api",
      cwd: "./apps/api",
      script: "node",
      args: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "polar-school-web",
      cwd: "./apps/web",
      script: "node",
      args: "./node_modules/.bin/astro preview --port 3000 --host 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "development",
      },
      env_staging: {
        NODE_ENV: "staging",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
