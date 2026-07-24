// node .claude/db-init-r2.mjs — Neon 스키마 1회 생성 (멱등, 기획서 §5 모델)
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error('DATABASE_URL not in .env.local'); process.exit(1); }
const sql = neon(m[1].trim());

await sql`CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  marketing_consent boolean NOT NULL DEFAULT false,
  marketing_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS boards (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  schema_version int NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','boards') ORDER BY table_name`;
console.log('schema OK:', t.map((r) => r.table_name).join(', '));
