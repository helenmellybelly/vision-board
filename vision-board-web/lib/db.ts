import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// 빌드 타임 평가를 피하려고 lazy — env는 런타임(API 라우트)에만 필요하다
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}
