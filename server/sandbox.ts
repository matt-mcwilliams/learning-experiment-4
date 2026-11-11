import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, readdir, stat, rm, mkdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from './store.ts';

export type Execution = {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: string;
  result: Record<string, unknown> | null;
  files: { name: string; data: Buffer }[];
};
const bootstrap = `import resource, runpy, os
resource.setrlimit(resource.RLIMIT_CPU,(8,8))
resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024))
resource.setrlimit(resource.RLIMIT_FSIZE,(10*1024*1024,10*1024*1024))
resource.setrlimit(resource.RLIMIT_NOFILE,(64,64))
resource.setrlimit(resource.RLIMIT_NPROC,(32,32))
os.umask(0o077)
runpy.run_path('/work/main.py', run_name='__main__')`;
let active = 0;
let runtime: Promise<string> | undefined;
export function boundedProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    maxBytes?: number;
    env?: NodeJS.ProcessEnv;
    diskDirectory?: string;
  } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '',
      stderr = '',
      size = 0,
      failure: string | null = null;
    const stop = (reason: string) => {
      failure = reason;
      try {
        process.kill(-p.pid!, 'SIGKILL');
      } catch {
        p.kill('SIGKILL');
      }
    };
    const timer = setTimeout(
      () => stop('Execution reached its time limit.'),
      options.timeout ?? 15000,
    );
    const diskTimer = options.diskDirectory
      ? setInterval(() => {
          void directoryBytes(options.diskDirectory!)
            .then((bytes) => {
              if (bytes > 25 * 1024 * 1024) stop('Execution exceeded its disk budget.');
            })
            .catch(() => {});
        }, 100)
      : undefined;
    p.stdout.on('data', (data) => {
      size += data.length;
      if (size > (options.maxBytes ?? 1024 * 1024)) stop('Execution exceeded its output limit.');
      else stdout += data;
    });
    p.stderr.on('data', (data) => {
      size += data.length;
      if (size > (options.maxBytes ?? 1024 * 1024)) stop('Execution exceeded its output limit.');
      else stderr += data;
    });
    p.once('error', (error) => {
      clearTimeout(timer);
      clearInterval(diskTimer);
      reject(error);
    });
    p.once('close', (code) => {
      clearTimeout(timer);
      clearInterval(diskTimer);
      resolve({ stdout, stderr: stderr + (failure ? '\n' + failure : ''), exitCode: code ?? 137 });
    });
  });
}
export function sandboxArgs(work: string) {
  return [
    '--unshare-all',
    '--unshare-user',
    '--disable-userns',
    '--die-with-parent',
    '--new-session',
    '--cap-drop',
    'ALL',
    '--ro-bind',
    '/usr',
    '/usr',
    '--symlink',
    'usr/bin',
    '/bin',
    '--ro-bind-try',
    '/lib',
    '/lib',
    '--ro-bind-try',
    '/lib64',
    '/lib64',
    '--proc',
    '/proc',
    '--dev',
    '/dev',
    '--size',
    '33554432',
    '--tmpfs',
    '/tmp',
    '--dir',
    '/home',
    '--bind',
    work,
    '/work',
    '--remount-ro',
    '/',
    '--chdir',
    '/work',
    '--clearenv',
    '--setenv',
    'PATH',
    '/usr/bin',
    '--setenv',
    'HOME',
    '/tmp',
    '--setenv',
    'PYTHONHASHSEED',
    '0',
    '--setenv',
    'MPLBACKEND',
    'Agg',
  ];
}
export async function sandboxAvailable() {
  try {
    const r = await boundedProcess('bwrap', [...sandboxArgs('/tmp'), '/usr/bin/true'], {
      timeout: 3000,
    });
    return r.exitCode === 0;
  } catch {
    return false;
  }
}
export async function executePython(
  code: string,
  input: Record<string, unknown>,
): Promise<Execution> {
  if (active >= 2)
    throw new AppError('Two computations are already running. Wait for one to finish.', 429);
  active++;
  const work = await mkdtemp(join(tmpdir(), 'margin-run-'));
  try {
    await writeFile(join(work, 'main.py'), code, { mode: 0o600 });
    await writeFile(join(work, 'config.json'), JSON.stringify(input));
    await writeFile(join(work, 'trials.json'), JSON.stringify(input.trials ?? []));
    await mkdir(join(work, 'output'));
    runtime ??= boundedProcess('/usr/bin/python3', ['--version']).then((r) => r.stdout.trim());
    const run = await boundedProcess(
      'bwrap',
      [...sandboxArgs(work), '/usr/bin/python3', '-I', '-c', bootstrap],
      { diskDirectory: work },
    );
    if (run.stderr.includes('bwrap:'))
      throw new AppError(
        'The Linux sandbox could not start. Install bubblewrap and enable unprivileged user namespaces. Execution is blocked; no unsandboxed fallback is used.',
        503,
      );
    let result: Record<string, unknown> | null = null;
    try {
      const file = await lstat(join(work, 'result.json'));
      if (file.isFile() && file.size <= 2 * 1024 * 1024) {
        const value = JSON.parse(await readFile(join(work, 'result.json'), 'utf8'));
        if (value && typeof value === 'object' && !Array.isArray(value)) result = value;
      }
    } catch {
      /* results are optional; failure is visible in stdout/stderr */
    }
    const files: Execution['files'] = [];
    let total = 0;
    const outputStat = await lstat(join(work, 'output')).catch(() => null);
    const entries =
      outputStat?.isDirectory() && !outputStat.isSymbolicLink()
        ? await readdir(join(work, 'output'), { withFileTypes: true })
        : [];
    for (const entry of entries) {
      if (!entry.isFile()) continue; // Never follow generated symlinks.
      const path = join(work, 'output', entry.name),
        info = await stat(path);
      total += info.size;
      if (info.size > 5 * 1024 * 1024 || total > 10 * 1024 * 1024 || files.length >= 10) continue;
      files.push({ name: entry.name, data: await readFile(path) });
    }
    return { ...run, runtime: await runtime, result, files };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new AppError(
        'Python or bubblewrap is missing. Run npm run setup for diagnostics.',
        503,
      );
    throw error;
  } finally {
    active--;
    await rm(work, { recursive: true, force: true });
  }
}

async function directoryBytes(path: string, depth = 0): Promise<number> {
  if (depth > 6) return 26 * 1024 * 1024;
  let total = 0;
  const entries = await readdir(path, { withFileTypes: true });
  if (entries.length > 500) return 26 * 1024 * 1024;
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += await directoryBytes(file, depth + 1);
    else if (entry.isFile()) total += (await lstat(file)).size;
    if (total > 25 * 1024 * 1024) return total;
  }
  return total;
}
