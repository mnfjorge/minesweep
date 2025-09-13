import { auth } from '@/auth';
import { updateLeaderboardTop10, fetchLeaderboardTop10All } from '@/lib/redis';

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
    const difficulty = difficultyRaw === 'easy' || difficultyRaw === 'normal' || difficultyRaw === 'hard' ? difficultyRaw : null;
    if (seconds === null) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }
    if (!difficulty) {
      return new Response(JSON.stringify({ error: 'Invalid difficulty' }), { status: 400 });
    }

    const firstNonEmpty = (...values: Array<unknown>): string => {
      for (const v of values) {
        if (typeof v === 'string') {
          const t = v.trim();
          if (t && t.toLowerCase() !== 'undefined' && t.toLowerCase() !== 'null') return t;
        }
      }
      return 'unknown';
    };
    const rawId = firstNonEmpty((session.user as any).id, session.user.email, session.user.name);
    const userId = rawId;
    const name = firstNonEmpty(session.user.name) || null;
    const email = firstNonEmpty(session.user.email) || null;

    await updateLeaderboardTop10({ userId, name, email, seconds, difficulty });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('rank POST error', error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}

export async function GET() {
  try {
    const { easy, normal, hard } = await fetchLeaderboardTop10All();
    return new Response(JSON.stringify({ easy, normal, hard }), { status: 200 });
  } catch (error) {
    console.error('rank GET error', error);
    return new Response(JSON.stringify({ easy: [], normal: [], hard: [] }), { status: 200 });
  }
}

