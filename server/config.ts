import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config as loadEnv } from 'dotenv';

const cwd = process.cwd();
const initialKey = process.env.DEEPSEEK_API_KEY?.trim();

loadEnv({ path: path.join(cwd, '.env.local'), quiet: true });
loadEnv({ path: path.join(cwd, '.env'), quiet: true });

export interface AuthCredential {
  header: string;
  value: string;
  source: 'environment' | 'dotenv' | 'dsh-account';
}

function cleanKey(value: string | undefined): string {
  const key = value?.trim().replace(/^["']|["']$/g, '') ?? '';
  if (!key || /^(your|replace|paste|sk-xxx|changeme)/i.test(key)) return '';
  return key;
}

/**
 * The DeepSeek Harness desktop app keeps its account grant in a local
 * credentials file. Reading it here is opt-in through DEEPSEEK_AUTH_MODE and
 * keeps the secret on the server; it is never serialized to the browser.
 */
function readDshAccountToken(): string {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const credentialFile = path.join(home, '.credentials.yaml');
  try {
    const raw = fs.readFileSync(credentialFile, 'utf8');
    const match = raw.match(
      /deepseek-account-platform\/default:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+token:\s*([^\n#]+)/,
    );
    return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  } catch {
    return '';
  }
}

export function resolveAuth(): AuthCredential | null {
  const apiKey = cleanKey(process.env.DEEPSEEK_API_KEY);
  if (apiKey) {
    return {
      header: 'Authorization',
      value: `Bearer ${apiKey}`,
      source: initialKey ? 'environment' : 'dotenv',
    };
  }

  const mode = (process.env.DEEPSEEK_AUTH_MODE || '').trim().toLowerCase();
  if (mode === 'dsh-account' || mode === 'dsh_account') {
    const token = readDshAccountToken();
    if (token) {
      return { header: 'x-dsh-auth-token', value: token, source: 'dsh-account' };
    }
  }

  return null;
}

const port = Number(process.env.PORT || 4173);

export const appConfig = {
  port: Number.isFinite(port) && port > 0 ? port : 4173,
  host: process.env.HOST || '127.0.0.1',
  baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
  model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
  mockAI: /^(1|true|yes)$/i.test(process.env.MOCK_AI || ''),
  thinking: (process.env.DEEPSEEK_THINKING || 'disabled').toLowerCase() === 'enabled',
  isProduction: process.env.NODE_ENV === 'production',
  maxSourceLength: 24_000,
};

export function publicAIConfig() {
  const auth = resolveAuth();
  return {
    configured: Boolean(auth) || appConfig.mockAI,
    mock: appConfig.mockAI,
    model: appConfig.model,
    baseUrl: appConfig.baseUrl,
    keySource: auth?.source ?? 'missing',
  };
}
