import { db } from '@/lib/db';
import { fishes, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { artist_name, image_data, userId } = body;

  if (!artist_name || !image_data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    if (userId) {
      // 如果有 userId，说明是老用户更新鱼
      const existingUser = await db.select().from(users).where(eq(users.user_id, userId)).limit(1);
      if (existingUser.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const fishId = existingUser[0].fish_id;
      if (fishId) {
        // 更新鱼
        await db.update(fishes).set({ image_data, updated_at: new Date() }).where(eq(fishes.fish_id, fishId));
        return NextResponse.json({ success: true, userId });
      } else {
        // 如果用户存在但没有鱼，为他创建一条新鱼
        const [newFish] = await db.insert(fishes).values({ artist_name, image_data }).returning();
        await db.update(users).set({ fish_id: newFish.fish_id, updated_at: new Date() }).where(eq(users.user_id, userId));
        return NextResponse.json({ success: true, userId });
      }
    } else {
      // 如果没有 userId，说明是新用户
      // 创建新鱼
      const [newFish] = await db.insert(fishes).values({ artist_name, image_data }).returning();
      // 创建新用户并关联鱼
      const [newUser] = await db.insert(users).values({ name: artist_name, fish_id: newFish.fish_id }).returning();
      return NextResponse.json({ success: true, userId: newUser.user_id });
    }
  } catch (error) {
    console.error('Error saving fish:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}