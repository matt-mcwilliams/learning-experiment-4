import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, symlink, access, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { AppError } from './store.ts';

export type SourceTool = {
  description: string;
  schema: z.ZodType;
  call: (args: any) => Promise<unknown>;
};
export type AgentRequest = {
  instructions: string;
  prompt: string;
  schema: z.ZodType;
  model: string;
  webResearch: boolean;
  threadId?: string | null;
  tools: Record<string, SourceTool>;
  signal?: AbortSignal;
  onProgress: (phase: string, ids?: { threadId?: string; turnId?: string }) => void;
};
export interface Agent {
  run(request: AgentRequest): Promise<unknown>;
  status(): Promise<{
    connected: boolean;
    auth: string;
    models: { id: string; label: string; isDefault: boolean }[];
    error?: string;
  }>;
}

// Codex uses its native credential manager. No token values are read by Margin.
// A separate home prevents user MCP, plugins, hooks, shell permissions, or project instructions
// from expanding the educational agent's capabilities.
export class CodexAgent implements Agent {
  constructor(
    public dataDirectory: string,
    public binary = process.env.MARGIN_CODEX_BIN || 'codex',
  ) {}
  async prepareHome() {
    const home = join(this.dataDirectory, 'codex');
    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(join(this.dataDirectory, 'agent-workspace'), { recursive: true, mode: 0o700 });
    const nativeHome =
      process.env.MARGIN_NATIVE_CODEX_HOME || process.env.CODEX_HOME || join(homedir(), '.codex');
    try {
      await access(join(home, 'auth.json'));
    } catch {
      try {
        await access(join(nativeHome, 'auth.json'));
        await symlink(join(nativeHome, 'auth.json'), join(home, 'auth.json'));
      } catch {
        /* keyring users can sign in to the isolated home; never copy secrets */
      }
    }
    await writeFile(
      join(home, 'config.toml'),
      `model_provider = "openai"
approval_policy = "never"
sandbox_mode = "read-only"
web_search = "disabled"
[features]
shell_tool = false
unified_exec = false
apps = false
plugins = false
multi_agent = false
memories = false
browser_use = false
computer_use = false
skill_search = false
[skills]
include_instructions = false
[skills.bundled]
enabled = false
[analytics]
enabled = false
`,
      { mode: 0o600 },
    );
    return home;
  }
  async client() {
    const home = await this.prepareHome();
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: homedir(),
      CODEX_HOME: home,
      RUST_LOG: 'error',
      LANG: 'C.UTF-8',
    };
    // Preserve desktop keyring access without inheriting API keys or arbitrary shell secrets.
    for (const key of [
      'XDG_RUNTIME_DIR',
      'DBUS_SESSION_BUS_ADDRESS',
      'SSL_CERT_FILE',
      'SSL_CERT_DIR',
    ])
      if (process.env[key]) env[key] = process.env[key];
    const rpc = new RpcClient(
      spawn(this.binary, ['app-server', '--listen', 'stdio://'], {
        cwd: join(this.dataDirectory, 'agent-workspace'),
        env,
        stdio: 'pipe',
      }),
    );
    try {
      await rpc.call('initialize', {
        clientInfo: { name: 'margin_learning', title: 'Margin Learning', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      rpc.notify('initialized', {});
      return rpc;
    } catch (e) {
      rpc.close();
      throw e;
    }
  }
  async status(): ReturnType<Agent['status']> {
    let rpc: RpcClient | undefined;
    try {
      rpc = await this.client();
      const auth = await rpc.call('account/read', { refreshToken: false });
      if (auth.account?.type !== 'chatgpt')
        return {
          connected: false,
          auth: auth.account?.type ?? 'signed-out',
          models: [],
          error:
            'Sign in with ChatGPT using codex login. API-key billing is intentionally disabled.',
        };
      const models = await rpc.call('model/list', { limit: 100 });
      return {
        connected: true,
        auth: 'ChatGPT subscription',
        models: models.data.map((m: any) => ({
          id: m.model,
          label: m.displayName,
          isDefault: m.isDefault,
        })),
      };
    } catch (e) {
      return { connected: false, auth: 'unavailable', models: [], error: (e as Error).message };
    } finally {
      rpc?.close();
    }
  }
  async run(request: AgentRequest) {
    const rpc = await this.client();
    let abort: (() => void) | undefined;
    try {
      const account = await rpc.call('account/read', { refreshToken: false });
      if (account.account?.type !== 'chatgpt')
        throw new AppError(
          'Codex is not signed in with ChatGPT. Run npm run setup for sign-in instructions. API-key billing is disabled.',
          503,
        );
      const config = { web_search: request.webResearch ? 'live' : 'disabled' };
      let threadId = request.threadId;
      if (threadId) {
        await rpc.call('thread/resume', {
          threadId,
          cwd: join(this.dataDirectory, 'agent-workspace'),
          sandbox: 'read-only',
          approvalPolicy: 'never',
          config,
          baseInstructions: request.instructions,
          ...(request.model ? { model: request.model } : {}),
        });
      } else {
        const start = await rpc.call('thread/start', {
          cwd: join(this.dataDirectory, 'agent-workspace'),
          sandbox: 'read-only',
          approvalPolicy: 'never',
          config,
          baseInstructions: request.instructions,
          serviceName: 'margin_learning',
          ...(request.model ? { model: request.model } : {}),
          dynamicTools: Object.entries(request.tools).map(([name, tool]) => ({
            type: 'function',
            name,
            description: tool.description,
            inputSchema: jsonSchema(tool.schema),
          })),
        });
        threadId = start.thread.id;
      }
      request.onProgress('Preparing learning material', { threadId: threadId! });
      return await new Promise<unknown>((resolve, reject) => {
        let final = '';
        let turnId: string | undefined;
        const timer = setTimeout(
          () => {
            if (turnId) void rpc.call('turn/interrupt', { threadId, turnId }).catch(() => {});
            reject(
              new Error(
                'Codex reached the 12 minute task limit. Your existing work is safe; retry this task.',
              ),
            );
          },
          12 * 60 * 1000,
        );
        const finish = (fn: () => void) => {
          clearTimeout(timer);
          fn();
        };
        abort = () => {
          if (turnId) void rpc.call('turn/interrupt', { threadId, turnId }).catch(() => {});
          finish(() => reject(new Error('Task cancelled.')));
        };
        request.signal?.addEventListener('abort', abort, { once: true });
        if (request.signal?.aborted) {
          abort();
          return;
        }
        rpc.onExit = (error) => finish(() => reject(error));
        rpc.onRequest = async (message) => {
          if (message.method !== 'item/tool/call') {
            rpc.respond(message.id, null, {
              code: -32601,
              message:
                'Margin denies filesystem, execution, permission, and external action requests. Use only declared source tools.',
            });
            return;
          }
          const { tool, arguments: args } = message.params;
          const selected = request.tools[tool];
          if (!selected) {
            rpc.respond(message.id, {
              success: false,
              contentItems: [{ type: 'inputText', text: 'Tool not allowed' }],
            });
            return;
          }
          request.onProgress(
            tool === 'import_source'
              ? 'Retrieving a source'
              : tool === 'read_run'
                ? 'Inspecting execution evidence'
                : tool === 'read_submission'
                  ? 'Reading your reasoning'
                  : tool === 'read_artifact'
                    ? 'Inspecting an attached artifact'
                    : 'Inspecting source pages',
          );
          try {
            const output = await selected.call(selected.schema.parse(args));
            rpc.respond(message.id, {
              success: true,
              contentItems: [{ type: 'inputText', text: JSON.stringify(output) }],
            });
          } catch (error) {
            rpc.respond(message.id, {
              success: false,
              contentItems: [{ type: 'inputText', text: (error as Error).message }],
            });
          }
        };
        rpc.onNotification = (message) => {
          const p = message.params;
          if (p?.threadId && p.threadId !== threadId) return;
          if (message.method === 'item/started') {
            const kind = p.item?.type;
            if (kind === 'webSearch') request.onProgress('Researching instructional sources');
            else if (kind === 'agentMessage')
              request.onProgress('Writing and checking the response');
          }
          if (message.method === 'item/completed' && p.item?.type === 'agentMessage')
            final = p.item.text;
          if (message.method === 'turn/completed')
            finish(() => {
              if (p.turn.status !== 'completed')
                reject(new Error(p.turn.error?.message ?? `Codex turn ${p.turn.status}`));
              else {
                try {
                  resolve(request.schema.parse(JSON.parse(final)));
                } catch (e) {
                  reject(
                    new Error(
                      `Codex returned invalid structured content: ${(e as Error).message.slice(0, 500)}`,
                    ),
                  );
                }
              }
            });
        };
        rpc
          .call('turn/start', {
            threadId,
            input: [{ type: 'text', text: request.prompt, text_elements: [] }],
            outputSchema: jsonSchema(request.schema),
            effort: 'high',
          })
          .then((result) => {
            turnId = result.turn.id;
            request.onProgress('Reasoning about the learning task', {
              threadId: threadId!,
              turnId,
            });
            if (request.signal?.aborted) abort?.();
          })
          .catch((error) => finish(() => reject(error)));
      });
    } finally {
      if (abort) request.signal?.removeEventListener('abort', abort);
      rpc.close();
    }
  }
}
export function jsonSchema(schema: z.ZodType) {
  const result = z.toJSONSchema(schema) as Record<string, unknown>;
  delete result.$schema;
  return result;
}

// Keep the small JSON-RPC transport independent of educational state and testable with a fake process.
export class RpcClient {
  pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  nextId = 1;
  stderr = '';
  closed = false;
  onNotification: (message: any) => void = () => {};
  onRequest: (message: any) => Promise<void> = async () => {};
  onExit: (error: Error) => void = () => {};
  constructor(public process: ChildProcessWithoutNullStreams) {
    const lines = createInterface({ input: process.stdout });
    lines.on('line', (line) => {
      try {
        this.receive(JSON.parse(line));
      } catch {
        /* Non-protocol output is ignored, never rendered as instructional material. */
      }
    });
    process.stderr.on('data', (data) => {
      this.stderr = (this.stderr + data).slice(-4000);
    });
    process.on('error', (error) => this.fail(new Error(`Could not start Codex: ${error.message}`)));
    process.on('exit', (code) => {
      if (!this.closed) this.fail(new Error(`Codex exited (${code}). ${this.stderr.slice(-1200)}`));
    });
    process.stdin.on('error', (error) => {
      if (!this.closed) this.fail(error);
    });
  }
  receive(message: any) {
    if (message.id !== undefined && !message.method) {
      const p = this.pending.get(message.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(message.id);
      if (message.error) p.reject(new Error(message.error.message));
      else p.resolve(message.result);
    } else if (message.id !== undefined)
      void this.onRequest(message).catch((error) =>
        this.respond(message.id, null, { code: -32603, message: String(error) }),
      );
    else this.onNotification(message);
  }
  send(message: unknown) {
    if (!this.closed) this.process.stdin.write(JSON.stringify(message) + '\n');
  }
  call(method: string, params: unknown): Promise<any> {
    if (this.closed) return Promise.reject(new Error('Codex connection closed'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out`));
      }, 45000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  notify(method: string, params: unknown) {
    this.send({ method, params });
  }
  respond(id: number | string, result: unknown, error?: unknown) {
    this.send(error ? { id, error } : { id, result });
  }
  fail(error: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    this.onExit(error);
  }
  close() {
    this.closed = true;
    this.fail(new Error('Codex connection closed'));
    this.process.stdin.end();
    this.process.kill('SIGTERM');
    const timer = setTimeout(() => this.process.kill('SIGKILL'), 2000);
    timer.unref();
  }
}
