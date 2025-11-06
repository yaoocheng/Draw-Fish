import { db } from '@/lib/db';
import { fishes } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        let allFishes;

        try {
            // ✅ 优先使用数据库随机函数（Postgres/SQLite: RANDOM(), MySQL: RAND()）
            allFishes = await db
                .select()
                .from(fishes)
                .orderBy(sql`RANDOM()`)
                .limit(50);
        } catch (err) {
            console.warn('⚠️ RANDOM() not supported, fallback to in-memory shuffle');
            // 如果数据库不支持 RANDOM()，则全取再随机
            const all = await db.select().from(fishes);
            const shuffled = all.sort(() => Math.random() - 0.5);
            allFishes = shuffled.slice(0, 50);
        }

        return NextResponse.json(allFishes);
    } catch (error) {
        console.error('❌ Failed to fetch fishes:', error);
        return NextResponse.json({ error: 'Failed to fetch fishes' }, { status: 500 });
    }
}
