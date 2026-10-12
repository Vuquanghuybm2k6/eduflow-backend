// Preloaded with `node -r` / `ts-node -r` so that process.env is populated
// from .env.test before any application module (e.g. src/data-source) is
// imported. Keep this file plain JS so it needs no transform step.
require('dotenv').config({ path: '.env.test', override: true });
