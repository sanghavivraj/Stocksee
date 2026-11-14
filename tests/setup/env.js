// Runs before every test file: use the separate test database, never the dev one.
require('dotenv').config();
process.env.NODE_ENV = 'test';
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set in .env to run tests');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
