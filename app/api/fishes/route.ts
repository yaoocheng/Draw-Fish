import { db } from '@/lib/db';
import { fishes } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    try {
        const allFishes = await db.select().from(fishes).orderBy(desc(fishes.created_at)).limit(50);
        return NextResponse.json(allFishes);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch fishes' }, { status: 500 });
    }
}