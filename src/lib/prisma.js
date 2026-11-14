const { PrismaClient } = require('@prisma/client');

// One PrismaClient (and connection pool) for the whole process.
const prisma = globalThis.__stockseePrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__stockseePrisma = prisma;

module.exports = prisma;
