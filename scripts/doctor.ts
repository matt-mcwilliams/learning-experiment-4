import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { CodexAgent } from '../server/codex.ts';
import { sandboxAvailable, boundedProcess } from '../server/sandbox.ts';
const directory = resolve(
  process.env.MARGIN_DATA_DIR ||
    join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'margin'),
);
console.log('Margin environment check\n');
console.log(`Node ${process.version} · requires 24+`);
for (const command of ['codex', 'python3', 'pdftotext', 'bwrap']) {
  try {
    const r = await boundedProcess(command, command === 'pdftotext' ? ['-v'] : ['--version'], {
      timeout: 5000,
    });
    console.log(`${command}: ${(r.stdout || r.stderr).trim().split('\n')[0]}`);
  } catch {
    console.log(`${command}: MISSING`);
  }
}
console.log(
  `Linux execution sandbox: ${(await sandboxAvailable()) ? 'available' : 'UNAVAILABLE (code execution will be blocked)'}`,
);
const agent = new CodexAgent(directory);
const status = await agent.status();
console.log(`Codex: ${status.auth}${status.error ? ' · ' + status.error : ''}`);
console.log(
  `Models in catalog: ${status.models.map((m) => m.id).join(', ') || 'none'} (catalog does not establish entitlement)`,
);
if (!status.connected)
  console.log(
    `\nSign in with ChatGPT, then retry:\nCODEX_HOME='${join(directory, 'codex').replace(/'/g, "'\\''")}' codex login\n\nIf your native login uses auth.json it is reused through a symlink. Keyring users may need the separate sign-in above.`,
  );
console.log(
  `\nData directory: ${directory}\nLaunch: npm run dev (development) or npm run build && npm start`,
);
