import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  const { fish_id, action } = await req.json();

  if (!fish_id || !action) {
    return NextResponse.json({ error: 'Missing fish_id or action' }, { status: 400 });
  }

  try {
    if (action === 'like') {
      await sql`UPDATE fishes SET likes = likes + 1 WHERE fish_id = ${fish_id}`;
    } else if (action === 'dislike') {
      await sql`UPDATE fishes SET dislikes = dislikes + 1 WHERE fish_id = ${fish_id}`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedFish = await sql`SELECT likes, dislikes FROM fishes WHERE fish_id = ${fish_id}`;
    return NextResponse.json(updatedFish[0]);
  } catch (error) {
    console.error('Error updating fish:', error);
    return NextResponse.json({ error: 'Error updating fish' }, { status: 500 });
  }
}