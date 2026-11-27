import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error('Pass a Next.js command, such as build or start.');
}

const child = spawn(
  process.execPath,
  [resolve('node_modules/next/dist/bin/next'), command, ...args],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      RAHYAR_SERVER_MODE: '1',
      ...(command === 'build'
        ? { NEXT_PUBLIC_API_BASE_URL: 'https://api.rahyar-erp.ir' }
        : {}),
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
