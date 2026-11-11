import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RpcClient, CodexAgent } from '../server/codex.ts';
import { MaterialSchema } from '../shared/schema.ts';

test('JSON-RPC correlates responses, handles server tool requests and notifications, and rejects explicit errors', async () => {
  const script = `const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='echo'){console.log(JSON.stringify({method:'item/started',params:{item:{type:'webSearch'}}}));console.log(JSON.stringify({id:m.id,result:m.params}));}else if(m.method==='tool'){console.log(JSON.stringify({id:99,method:'item/tool/call',params:{tool:'read_source'}}));console.log(JSON.stringify({id:m.id,result:{accepted:true}}));}else if(m.id===99)console.log(JSON.stringify({method:'tool/result',params:m.result}));else if(m.method==='fail')console.log(JSON.stringify({id:m.id,error:{code:-1,message:'Explicit protocol failure'}}));});`;
  const rpc = new RpcClient(spawn(process.execPath, ['-e', script], { stdio: 'pipe' }));
  const seen: string[] = [];
  rpc.onNotification = (m) => seen.push(m.method);
  rpc.onRequest = async (m) => rpc.respond(m.id, { success: true });
  try {
    const [a, b] = await Promise.all([
      rpc.call('echo', { value: 1 }),
      rpc.call('echo', { value: 2 }),
    ]);
    assert.deepEqual(a, { value: 1 });
    assert.deepEqual(b, { value: 2 });
    assert.ok(seen.includes('item/started'));
    await rpc.call('tool', {});
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(seen.includes('tool/result'));
    await assert.rejects(rpc.call('fail', {}), /Explicit protocol failure/);
  } finally {
    rpc.close();
  }
});
test('Codex adapter refuses API-key authentication and never starts a billable inference turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-auth-test-'));
  const binary = join(directory, 'fake-codex');
  const script = `#!/usr/bin/env node
const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{}}));else if(m.method==='account/read')console.log(JSON.stringify({id:m.id,result:{account:{type:'apiKey'}}}));else if(m.id)console.log(JSON.stringify({id:m.id,error:{code:-1,message:'INFERENCE MUST NOT START'}}));});`;
  await writeFile(binary, script, { mode: 0o700 });
  const agent = new CodexAgent(directory, binary);
  try {
    const status = await agent.status();
    assert.equal(status.connected, false);
    assert.equal(status.auth, 'apiKey');
    await assert.rejects(
      agent.run({
        instructions: 'test',
        prompt: 'test',
        schema: MaterialSchema,
        model: '',
        webResearch: false,
        tools: {},
        onProgress: () => {},
      }),
      /not signed in with ChatGPT/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
