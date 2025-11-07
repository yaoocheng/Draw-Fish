import { db } from '@/lib/db';
import { fishes } from '@/lib/schema';
import { sql, InferSelectModel } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const userIdParam = url.searchParams.get('user_id');
        const limit = 20;

        // 使用 drizzle 的推断类型，确保不要出现 any
        type FishRecord = InferSelectModel<typeof fishes>;
        let latestForUser: FishRecord | null = null;

        if (userIdParam) {
            const userId = Number(userIdParam);
            if (!Number.isNaN(userId)) {
                try {
                    const latestList = await db
                        .select()
                        .from(fishes)
                        .where(sql`user_id = ${userId}`)
                        .orderBy(sql`created_at DESC`)
                        .limit(1);
                    latestForUser = latestList[0] ?? null;
                } catch (e) {
                    console.warn('⚠️ Failed to fetch latest user fish, continuing without it:', e);
                }
            }
        }

        let result: FishRecord[];
        try {
            if (latestForUser) {
                const others = await db
                    .select()
                    .from(fishes)
                    .where(sql`fish_id != ${latestForUser.fish_id}`)
                    .orderBy(sql`RANDOM()`)
                    .limit(limit - 1);
                result = [latestForUser, ...others];
            } else {
                result = await db
                    .select()
                    .from(fishes)
                    .orderBy(sql`RANDOM()`)
                    .limit(limit);
            }
        } catch (err) {
            console.warn('⚠️ RANDOM() not supported, fallback to in-memory shuffle');
            const all: FishRecord[] = await db.select().from(fishes);
            if (latestForUser) {
                const filtered = all.filter((f) => f.fish_id !== latestForUser!.fish_id);
                const shuffled = filtered.sort(() => Math.random() - 0.5);
                result = [latestForUser, ...shuffled.slice(0, limit - 1)];
            } else {
                const shuffled = all.sort(() => Math.random() - 0.5);
                result = shuffled.slice(0, limit);
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('❌ Failed to fetch fishes:', error);
        return NextResponse.json({ error: 'Failed to fetch fishes' }, { status: 500 });
    }
}
