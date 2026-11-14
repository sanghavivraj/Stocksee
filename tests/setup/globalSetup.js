const { execSync } = require('child_process');

module.exports = async () => {
  require('dotenv').config();
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must be set in .env to run tests');
  // Bring the test database schema up to date with the committed migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: 'ignore',
  });
};
