import { auth } from '@/auth';
import { updateLeaderboardTop10 } from '@/lib/redis';

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const secondsRaw = body?.seconds;
    const seconds = typeof secondsRaw === 'number' && isFinite(secondsRaw) && secondsRaw >= 0 ? secondsRaw : null;
    if (seconds === null) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const userId = (session.user as any).id || session.user.email || session.user.name || 'unknown';
    const name = session.user.name ?? null;
    const email = session.user.email ?? null;

    await updateLeaderboardTop10({ userId, name, email, seconds });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('rank POST error', error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}

