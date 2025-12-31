import request from 'supertest';
import app from '../src/app';
import { AgentRepository } from '../src/db/repositories/agentRepository';
import { QueueRepository } from '../src/db/repositories/queueRepository';
import { CallRepository } from '../src/db/repositories/callRepository';

describe('Agent and Queue APIs', () => {
  let agentId: string;
  let callId: string;

  beforeAll(async () => {
    const agentRepo = new AgentRepository();
    const callRepo = new CallRepository();

    const agent = await agentRepo.createAgent({
      name: 'Test Agent',
      email: 'test@example.com',
      phone: '+15551234567',
      availabilityStatus: 'online'
    });
    agentId = agent.id;

    const call = await callRepo.createCall({
      streamSid: 'test-stream-' + Date.now(),
      caller: '+12223334444',
      callSid: 'CA' + Math.random().toString(36).substring(7)
    });
    callId = call.id;
  });

  it('should list agents', async () => {
    const response = await request(app).get('/api/agents');
    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
  });

  it('should update agent status', async () => {
    const response = await request(app)
      .post(`/api/agents/${agentId}/status`)
      .send({ status: 'busy' });
    expect(response.status).toBe(200);
    expect(response.body.data.availabilityStatus).toBe('busy');
  });

  it('should initiate a transfer', async () => {
    const response = await request(app)
      .post(`/api/calls/${callId}/transfer`)
      .send({
        reason: 'Test transfer',
        priority: 1
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('status');
  });

  it('should get queue status', async () => {
    const response = await request(app).get('/api/queue');
    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
