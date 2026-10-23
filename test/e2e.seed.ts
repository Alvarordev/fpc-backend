import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Restore the local database to the deterministic demo baseline. */
export default async function restoreDemoSeed(): Promise<void> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const { stdout, stderr } = await execFileAsync(npm, ['run', 'seed:demo'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://fpc_dev:fpc_dev_password@localhost:5432/fpc_dev',
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}
