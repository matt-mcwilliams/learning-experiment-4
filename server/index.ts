import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createApp } from './app.ts';
const dev = process.argv.includes('--dev');
const port = Number(process.env.MARGIN_PORT || 4317);
const directory = resolve(
  process.env.MARGIN_DATA_DIR ||
    join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'margin'),
);
const { app } = await createApp({
  directory,
  port,
  dev,
  staticRoot: dev ? undefined : resolve('dist'),
  logger: true,
});
await app.listen({ port, host: '127.0.0.1' });
let vite: { close: () => Promise<void> } | undefined;
if (dev) {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: port + 1,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${port}` },
    },
  });
  await server.listen();
  vite = server;
}
console.log(
  `\n  Margin · http://127.0.0.1:${dev ? port + 1 : port}\n  Private data: ${directory}\n  Press Ctrl+C to stop.\n`,
);
const stop = async () => {
  await vite?.close();
  await app.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
