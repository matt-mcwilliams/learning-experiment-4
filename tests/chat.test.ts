import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';
import { Store, id } from '../server/store.ts';
import type { Agent, AgentRequest } from '../server/codex.ts';
import type { Chat, Job, Message } from '../shared/schema.ts';

class ChatAgent implements Agent {
  calls: AgentRequest[] = [];
  fail = false;
  async status() {
    return { connected: true, auth: 'Test fixture', models: [] };
  }
  async run(request: AgentRequest) {
    this.calls.push(request);
    request.onProgress('Answering', {
      threadId: request.threadId ?? `thread-${this.calls.length}`,
    });
    if (this.fail) throw new Error('Test transport failure');
    return { answer: 'A saved reply.', references: [] };
  }
}
async function settled(store: Store, job: Job) {
  for (let i = 0; i < 100; i++) {
    const current = store.get<Job>('jobs', job.id);
    if (current.status !== 'running') return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Chat task did not settle');
}

test('chat API preserves independent histories, resumes the correct thread, and retries in the original chat', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-chat-'));
  const agent = new ChatAgent();
  const { app, store } = await createApp({ directory, agent });
  const headers = { host: '127.0.0.1:4317', 'x-margin-client': '1' };
  const post = (url: string, payload = {}) => app.inject({ method: 'POST', url, headers, payload });
  const session = store.createSession({ objective: 'Learning context', mode: 'concept', hours: 1 });
  const base = `/api/sessions/${session.id}`;
  const send = async (chatId: string, text: string) => {
    const response = await post(`${base}/tasks`, { kind: 'tutor', chatId, text });
    assert.equal(response.statusCode, 200, response.body);
    return settled(store, response.json<Job>());
  };
  try {
    const first = (await post(`${base}/chats`)).json<Chat>();
    const a = await send(first.id, 'FIRST_CHAT_ONLY: independence');
    assert.equal(a.status, 'succeeded');
    assert.equal(agent.calls[0].threadId, undefined);
    assert.match(agent.calls[0].prompt, /FIRST_CHAT_ONLY/);
    const second = (await post(`${base}/chats`)).json<Chat>();
    const b = await send(second.id, 'SECOND_CHAT_ONLY: covariance');
    assert.equal(b.status, 'succeeded');
    assert.equal(agent.calls[1].threadId, undefined);
    assert.ok(!agent.calls[1].prompt.includes('FIRST_CHAT_ONLY'));
    assert.match(agent.calls[1].prompt, /Learning context/);
    const c = await send(first.id, 'Continue the first conversation');
    assert.equal(c.status, 'succeeded');
    assert.equal(agent.calls[2].threadId, a.threadId);
    assert.ok(!agent.calls[2].prompt.includes('SECOND_CHAT_ONLY'));
    assert.match(agent.calls[2].prompt, /FIRST_CHAT_ONLY/);

    agent.fail = true;
    const failed = await send(first.id, 'Retry this question');
    assert.equal(failed.status, 'failed');
    await post(`${base}/chats`); // Changing chats must not redirect a retry.
    agent.fail = false;
    const retried = await post(`/api/jobs/${failed.id}/retry`);
    const retry = await settled(store, retried.json<Job>());
    assert.equal(retry.status, 'succeeded');
    assert.equal(retry.chatId, first.id);
    assert.equal(agent.calls.at(-1)!.threadId, a.threadId);
    const detail = store.detail(session.id);
    assert.equal(detail.messages.filter((m) => m.text === 'Retry this question').length, 1);
    assert.equal(detail.messages.filter((m) => m.chatId === second.id).length, 2);
    assert.equal(
      detail.chats.find((c) => c.id === first.id)!.title,
      'FIRST_CHAT_ONLY: independence',
    );

    const other = store.createSession({ objective: 'Other session', mode: 'concept', hours: 1 });
    const invalid = await post(`/api/sessions/${other.id}/tasks`, {
      kind: 'tutor',
      chatId: first.id,
      text: 'Wrong owner',
    });
    assert.equal(invalid.statusCode, 404);
    assert.equal(store.detail(other.id).messages.length, 0);
    const blank = await post(`${base}/tasks`, { kind: 'tutor', text: '  ' });
    assert.equal(blank.statusCode, 400);
    assert.equal(store.detail(session.id).chats.length, 3);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('existing transcripts migrate once without losing messages, jobs, or native thread history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-chat-migration-'));
  let store = new Store(directory);
  try {
    const session = store.createSession({
      objective: 'Existing session',
      mode: 'concept',
      hours: 1,
    });
    const createdAt = '2026-01-01T00:00:00.000Z';
    const message: Message = {
      id: id(),
      sessionId: session.id,
      activityId: null,
      role: 'user',
      text: 'An existing question',
      createdAt,
    };
    store.put('messages', message);
    const job = store.createJob(session.id, 'tutor', null, null, message.text);
    store.updateJob(job.id, { status: 'succeeded', threadId: 'existing-native-thread' });
    store.db.exec('PRAGMA user_version=1');
    store.close();
    store = new Store(directory);
    const detail = store.detail(session.id);
    assert.equal(detail.chats.length, 1);
    assert.equal(detail.chats[0].title, message.text);
    assert.equal(detail.chats[0].createdAt, createdAt);
    assert.deepEqual(detail.messages[0], { ...message, chatId: detail.chats[0].id });
    assert.equal(detail.jobs[0].chatId, detail.chats[0].id);
    assert.equal(detail.jobs[0].threadId, 'existing-native-thread');
    store.close();
    store = new Store(directory);
    assert.deepEqual(store.detail(session.id), detail);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a new chat can be opened during a reply without moving that reply or accepting a duplicate task', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-chat-pending-'));
  let finish!: () => void;
  const agent: Agent = {
    status: async () => ({ connected: true, auth: 'Test fixture', models: [] }),
    run: async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return { answer: 'Reply to the original chat.', references: [] };
    },
  };
  const { app, store, learning } = await createApp({ directory, agent });
  try {
    const session = store.createSession({ objective: 'Pending reply', mode: 'concept', hours: 1 });
    const job = learning.start(session.id, 'tutor', null, null, 'Original question');
    const next = store.createChat(session.id);
    assert.throws(
      () => learning.start(session.id, 'tutor', null, null, 'Too soon', next.id),
      /already running/,
    );
    assert.equal(store.detail(session.id).messages.length, 1);
    finish();
    assert.equal((await settled(store, job)).status, 'succeeded');
    const detail = store.detail(session.id);
    assert.equal(detail.messages.at(-1)!.chatId, job.chatId);
    assert.equal(detail.messages.filter((m) => m.chatId === next.id).length, 0);
  } finally {
    finish?.();
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
