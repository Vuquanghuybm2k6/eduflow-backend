const jwt = require('jsonwebtoken');

const payload = {
  sub: 'fbf0bf20-c649-4145-b42f-5ca7822c03d2',
  email: 'vuquanghuynick1bm@gmail.com',
  organizationId: '248a0311-d981-418f-a937-fb40c03c7822',
};

const token = jwt.sign(payload, 'eduflow-access-secret-dev-2024', {
  expiresIn: '60m',
  algorithm: 'HS256',
});

console.log(token);