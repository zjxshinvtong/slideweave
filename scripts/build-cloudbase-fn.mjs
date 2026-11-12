// 打包 CloudBase HTTP 云函数（CJS 单文件）→ cloudbase/functions/api/index.js
import { build } from 'esbuild';

await build({
  entryPoints: ['cloudbase/functions/api/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'cloudbase/functions/api/index.js',
  logLevel: 'info',
});

console.log('[build-cloudbase-fn] cloudbase/functions/api/index.js 已生成');
