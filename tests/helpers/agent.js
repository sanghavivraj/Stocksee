const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp();

/** A browser that has saved something, so it has an anonymous visitor cookie. */
async function visitorAgent() {
  const agent = request.agent(app);
  const res = await agent.patch('/api/me').send({ language: 'en' });
  if (res.status !== 200) throw new Error(`visitor creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

module.exports = { app, request, visitorAgent };
