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
    let existingUser = null;
    if (userId) {
      const userResult = await db.select().from(users).where(eq(users.user_id, userId)).limit(1);
      if (userResult.length > 0) {
        existingUser = userResult[0];
      }
    }

    if (existingUser) {
      // 老用户，或者 userId 存在且有效
      const fishId = existingUser.fish_id;
      if (fishId) {
        // 更新鱼
        await db.update(fishes).set({ image_data, updated_at: new Date() }).where(eq(fishes.fish_id, fishId));
        return NextResponse.json({ success: true, userId: existingUser.user_id });
      } else {
        // 用户存在但没有鱼，为他创建一条新鱼
        const [newFish] = await db.insert(fishes).values({ artist_name, image_data }).returning();
        await db.update(users).set({ fish_id: newFish.fish_id, updated_at: new Date() }).where(eq(users.user_id, existingUser.user_id));
        return NextResponse.json({ success: true, userId: existingUser.user_id });
      }
    } else {
      // 新用户，或者 userId 无效
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