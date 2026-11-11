// Deterministic HTTP+browser test server. This entry point is never used by npm start.
// Fixture responses are deliberately isolated from the production Codex adapter.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../server/app.ts';
import type { Agent, AgentRequest } from '../server/codex.ts';
import { reflowPdfText } from '../shared/excerpts.ts';
import { plan, material, labMaterial, assessment, defense, completion } from './fixtures.ts';
class BrowserFixture implements Agent {
  async status() {
    return { connected: true, auth: 'Deterministic test fixture', models: [] };
  }
  async run(request: AgentRequest) {
    const p = request.prompt;
    if (p.startsWith('Format')) {
      const pages = JSON.parse(p.split('UNTRUSTED SOURCE PAGES:\n')[1]);
      return {
        fragments: pages.map((page: any) => ({
          sourceId: page.sourceId,
          page: page.page,
          blocks: [{ kind: 'paragraph', text: reflowPdfText(page.text) }],
        })),
      };
    }
    if (p.startsWith('Construct')) return plan;
    if (p.startsWith('Prepare')) {
      const context = JSON.parse(p.split('UNTRUSTED STRUCTURED CONTEXT:\n')[1]);
      return context.activity.kind === 'lab'
        ? labMaterial
        : context.sources[0]?.mediaType === 'application/pdf'
          ? {
              ...material,
              references: [
                {
                  sourceId: context.sources[0].id,
                  page: 1,
                  quote: '',
                  purpose: 'Examine the dependence assumption in the original text.',
                },
              ],
            }
          : material;
    }
    if (p.startsWith('Critique')) return assessment;
    if (p.startsWith('Conduct')) return defense;
    if (p.startsWith('Synthesize')) return completion;
    return {
      answer:
        'Consider which covariance terms vanish under independence. This is a test-fixture response.',
      references: [],
    };
  }
}
const directory = await mkdtemp(join(tmpdir(), 'margin-browser-'));
const { app } = await createApp({
  directory,
  agent: new BrowserFixture(),
  staticRoot: resolve('dist'),
  port: 4517,
});
await app.listen({ host: '127.0.0.1', port: 4517 });
console.log('Browser fixture server: http://127.0.0.1:4517');
const close = async () => {
  await app.close();
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
