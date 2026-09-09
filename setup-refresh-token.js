const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const USER_ID = 'fbf0bf20-c649-4145-b42f-5ca7822c03d2';
const EMAIL = 'vuquanghuynick1bm@gmail.com';
const ORG_ID = '248a0311-d981-418f-a937-fb40c03c7822';

(async () => {
  const refreshToken = jwt.sign(
    { sub: USER_ID, email: EMAIL, organizationId: ORG_ID },
    process.env.JWT_REFRESH_SECRET || 'eduflow-refresh-secret-dev-2024',
    { expiresIn: '7d', algorithm: 'HS256' },
  );

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const c = new Client({
    connectionString: 'postgresql://postgres:huybm2k6@localhost:5432/eduflow',
  });
  await c.connect();

  await c.query(
    'UPDATE refresh_tokens SET "revokedAt" = NOW() WHERE "userId" = $1 AND "revokedAt" IS NULL',
    [USER_ID],
  );

  await c.query(
    `INSERT INTO refresh_tokens ("id", "userId", "tokenHash", "organizationId", "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
    [USER_ID, tokenHash, ORG_ID, expiresAt],
  );

  await c.end();
  console.log('REFRESH_TOKEN=' + refreshToken);
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});