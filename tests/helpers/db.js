const prisma = require('../../src/lib/prisma');

async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, watchlists, alerts RESTART IDENTITY CASCADE');
}

module.exports = { prisma, resetDb };
