const { Client } = require('pg');

(async () => {
  const c = new Client({
    connectionString: 'postgresql://postgres:huybm2k6@localhost:5432/eduflow',
  });
  await c.connect();
  const tables = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  );
  console.log('TABLES:', tables.rows.map((r) => r.table_name).join(', '));
  try {
    const users = await c.query(
      'SELECT id, email, "fullName", status FROM users LIMIT 20',
    );
    console.log('USERS:');
    for (const row of users.rows) console.log(JSON.stringify(row));
  } catch (e) {
    console.log('USERS query failed:', e.message);
  }
  await c.end();
  const m = new Client({
    connectionString: 'postgresql://postgres:huybm2k6@localhost:5432/eduflow',
  });
  await m.connect();
  try {
    const mem = await m.query(
      'SELECT m.id, m."userId", m."organizationId", r.name AS role FROM memberships m LEFT JOIN roles r ON r.id = m."roleId" LIMIT 30',
    );
    console.log('MEMBERSHIPS:');
    for (const row of mem.rows) console.log(JSON.stringify(row));
  } catch (e) {
    console.log('MEMBERSHIPS query failed:', e.message);
  }
  await m.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});