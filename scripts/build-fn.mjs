// 把 Express 应用打包成 Vercel Serverless 函数（api/[...all].js）。
// 依赖保持 external，由 Vercel 安装 node_modules 后解析。
import { build } from 'esbuild';

await build({
  entryPoints: ['server/vercel.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  outfile: 'api/[...all].js',
  logLevel: 'info',
});

console.log('[build-fn] api/[...all].js 已生成');
