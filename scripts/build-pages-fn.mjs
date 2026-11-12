// 把 worker/entry.ts 打包成 Cloudflare Pages Function（functions/api/[[path]].js）。
// 产物是自包含的单个 ESM 文件，不依赖 node_modules。
import { build } from 'esbuild';

await build({
  entryPoints: ['worker/entry.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  mainFields: ['browser', 'module', 'main'],
  conditions: ['worker', 'browser'],
  outfile: 'functions/api/[[path]].js',
  logLevel: 'info',
});

console.log('[build-pages-fn] functions/api/[[path]].js 已生成');
