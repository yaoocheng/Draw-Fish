import { db } from '@/lib/db';
import { fishes, users } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const body = await request.json();
    const { artist_name, image_data, userId } = body;

    if (!artist_name || !image_data) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        let existingUser = null;

        // 1️⃣ 查找用户
        if (userId) {
            const userResult = await db.select().from(users).where(eq(users.user_id, userId)).limit(1);
            if (userResult.length > 0) {
                existingUser = userResult[0];
            }
        }

        // 2️⃣ 如果用户存在
        if (existingUser) {
            // 查这个用户已经画了多少条鱼
            const userFishes = await db
                .select()
                .from(fishes)
                .where(eq(fishes.user_id, existingUser.user_id))
                .orderBy(asc(fishes.created_at)); // 按最早时间排序

            // 如果超过 20，先删除最早的一条
            if (userFishes.length >= 20) {
                const oldestFish = userFishes[0];
                await db.delete(fishes).where(eq(fishes.fish_id, oldestFish.fish_id));
            }

            // 插入新鱼
            const [newFish] = await db
                .insert(fishes)
                .values({
                    artist_name,
                    image_data,
                    user_id: existingUser.user_id,
                })
                .returning();

            return NextResponse.json({
                success: true,
                userId: existingUser.user_id,
                fishId: newFish.fish_id,
            });
        }

        // 3️⃣ 如果是新用户
        const [newUser] = await db
            .insert(users)
            .values({ name: artist_name })
            .returning();

        const [newFish] = await db
            .insert(fishes)
            .values({
                artist_name,
                image_data,
                user_id: newUser.user_id,
            })
            .returning();

        return NextResponse.json({
            success: true,
            userId: newUser.user_id,
            fishId: newFish.fish_id,
        });
    } catch (error) {
        console.error('Error saving fish:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
