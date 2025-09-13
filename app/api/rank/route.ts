import { auth } from '@/auth';
import { updateLeaderboardTop10, fetchLeaderboardTop10, type Difficulty } from '@/lib/redis';

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const secondsRaw = body?.seconds;
    const seconds = typeof secondsRaw === 'number' && isFinite(secondsRaw) && secondsRaw >= 0 ? secondsRaw : null;
    const difficultyRaw = body?.difficulty;
    const difficulty: Difficulty =
      difficultyRaw === 'easy' || difficultyRaw === 'normal' || difficultyRaw === 'hard'
        ? difficultyRaw
        : 'normal';
    if (seconds === null) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const userId = (session.user as any).id || session.user.email || session.user.name || 'unknown';
    const name = session.user.name ?? null;
    const email = session.user.email ?? null;

    await updateLeaderboardTop10({ userId, name, email, seconds, difficulty });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('rank POST error', error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}

export async function GET() {
  try {
    const [easy, normal, hard] = await Promise.all([
      fetchLeaderboardTop10('easy'),
      fetchLeaderboardTop10('normal'),
      fetchLeaderboardTop10('hard'),
    ]);
    return new Response(
      JSON.stringify({
        entriesByDifficulty: { easy, normal, hard },
        entries: normal,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('rank GET error', error);
    return new Response(
      JSON.stringify({ entriesByDifficulty: { easy: [], normal: [], hard: [] }, entries: [] }),
      { status: 200 }
    );
  }
}

