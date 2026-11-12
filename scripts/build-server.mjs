// 把服务端打包成单文件（Node 容器 / 云托管运行时使用），依赖保持 external。
import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  outfile: 'server-dist/index.mjs',
  logLevel: 'info',
});

console.log('[build-server] server-dist/index.mjs 已生成');
