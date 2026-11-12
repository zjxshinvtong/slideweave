/**
 * Vercel Serverless 入口：把 Express app 直接交给运行时。
 * 构建时由 esbuild 打包成 api/[...all].js（见 package.json 的 build:vercel）。
 * 本地开发不使用本文件。
 */
import { app } from './index.js';

export const config = {
  maxDuration: 60,
};

export default app;
