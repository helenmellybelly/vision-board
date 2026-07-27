import { notFound } from 'next/navigation';
import { getRegisteredUser } from '@/lib/authServer';
import { getSql } from '@/lib/db';

// 오너 전용 운영 현황판 (v7.9) — ADMIN_EMAIL 불일치·비로그인은 404로 존재 자체를 숨긴다
export const dynamic = 'force-dynamic';

type UserRow = {
  email: string;
  name: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  created_at: string;
  board_updated_at: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function AdminPage() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) notFound();
  const me = await getRegisteredUser();
  if (!me || me.email !== adminEmail) notFound();

  const sql = getSql();
  const [stats] = await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last7,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30,
      count(*) FILTER (WHERE marketing_consent)::int AS marketing
    FROM users`;
  const [boardStats] = await sql`
    SELECT count(*)::int AS boards,
      count(*) FILTER (WHERE updated_at >= now() - interval '7 days')::int AS active7
    FROM boards`;
  const users = (await sql`
    SELECT u.email, u.name, u.marketing_consent, u.marketing_consent_at, u.created_at,
           b.updated_at AS board_updated_at
    FROM users u LEFT JOIN boards b ON b.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT 100`) as unknown as UserRow[];

  const cards: Array<[string, string | number, string]> = [
    ['가입자', stats.total, `최근 7일 +${stats.last7} · 30일 +${stats.last30}`],
    ['마케팅 동의', stats.marketing, stats.total ? `${Math.round((stats.marketing / stats.total) * 100)}%` : '0%'],
    ['서버 보드', boardStats.boards, `최근 7일 활동 ${boardStats.active7}명`],
  ];

  return (
    <main className="min-h-screen max-w-3xl mx-auto w-full px-6 py-10">
      <h1 className="text-display font-bold mb-1">운영 현황</h1>
      <p className="text-body text-[#6B7280] mb-6">{me.email} · 서버 시각 기준</p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[#E5E1DA] bg-white p-4">
            <p className="text-caption text-[#6B7280]">{label}</p>
            <p className="text-title font-bold">{value}</p>
            <p className="text-caption text-[#6B7280]">{sub}</p>
          </div>
        ))}
      </div>

      <h2 className="text-heading font-bold mb-3">가입 유저 (최근 100명)</h2>
      <div className="overflow-x-auto rounded-2xl border border-[#E5E1DA] bg-white">
        <table className="w-full text-caption">
          <thead>
            <tr className="text-left text-[#6B7280] border-b border-[#E5E1DA]">
              <th className="px-3 py-2 font-medium">이메일</th>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium">가입</th>
              <th className="px-3 py-2 font-medium">마케팅 동의</th>
              <th className="px-3 py-2 font-medium">보드 최근 저장</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-[#F0EEE9] last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{u.email}</td>
                <td className="px-3 py-2 whitespace-nowrap">{u.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(u.created_at)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {u.marketing_consent ? `✅ ${fmt(u.marketing_consent_at)}` : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(u.board_updated_at)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[#6B7280]">
                  아직 가입 유저가 없어요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
