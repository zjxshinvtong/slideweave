/**
 * API 基地址：默认同源（本地 / Express 部署）。
 * 跨域部署（如静态托管 + 独立云函数）时用 VITE_API_BASE 指定服务端地址。
 */
const raw = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export const API_BASE = raw.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
