'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InferSelectModel } from 'drizzle-orm';
import { fishes } from '@/lib/schema';

type BirdData = InferSelectModel<typeof fishes>;

interface AnimatedBird extends BirdData {
    canvas: HTMLCanvasElement;
    x: number;
    y: number;
    baseY: number; // 新增，记录初始Y
    vx: number;
    flapPhase: number;
    bobPhase: number;
    width: number;
    height: number;
}

const MAX_BIRD_WIDTH = 150;
const MAX_BIRDS = 50;

const createFlapCanvas = (sourceCanvas: HTMLCanvasElement, flap: number) => {
    const { width, height } = sourceCanvas;
    const destCanvas = document.createElement('canvas');
    destCanvas.width = width;
    destCanvas.height = height * 1.5;
    const destCtx = destCanvas.getContext('2d')!;

    const slices = 500;
    const sliceHeight = height / slices;

    for (let i = 0; i < slices; i++) {
        const y = i * sliceHeight;
        const normalizedY = (y / height) * 2 - 1;
        const yOffset = (1 - Math.cos(normalizedY * Math.PI / 2)) * height * flap * 0.6;

        destCtx.drawImage(
            sourceCanvas,
            0, y, width, sliceHeight,
            0, y + yOffset + height * 0.25, width, sliceHeight
        );
    }

    return destCanvas;
};

const BirdInfoModal = ({
    bird,
    onClose,
    birdsRef
}: { bird: AnimatedBird | null; onClose: () => void; birdsRef: React.RefObject<AnimatedBird[]> }) => {
    const [likes, setLikes] = useState(bird?.likes || 0);
    const [dislikes, setDislikes] = useState(bird?.dislikes || 0);

    if (!bird) return null;

    const handleVote = async (action: 'like' | 'dislike') => {
        try {
            const res = await fetch('/api/fishes/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fish_id: bird.fish_id, action }),
            });
            if (res.ok) {
                const updatedBird = await res.json();

                // 更新 modal 状态
                setLikes(updatedBird.likes);
                setDislikes(updatedBird.dislikes);

                // 更新 birdsRef 中对应鸟的数据
                const birdIndex = birdsRef.current.findIndex(b => b.fish_id === bird.fish_id);
                if (birdIndex !== -1) {
                    birdsRef.current[birdIndex] = {
                        ...birdsRef.current[birdIndex],
                        likes: updatedBird.likes,
                        dislikes: updatedBird.dislikes,
                    };
                }
            }
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const raw = (bird.image_data || '').trim();
    const isSvg = raw.startsWith('<svg');
    const isDataUrl = raw.startsWith('data:image/');
    const fallbackPng = bird.canvas?.toDataURL('image/png');

    return (
        <div
            style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '24px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.95)',
                boxShadow: '0 12px 48px rgba(37, 99, 235, 0.3)',
                border: '1px solid #a5d8ff',
                textAlign: 'center',
                zIndex: 100,
                maxWidth: '360px'
            }}
        >
            {isSvg ? (
                <div
                    dangerouslySetInnerHTML={{ __html: raw }}
                    style={{ maxWidth: '200px', borderRadius: '8px', margin: '0 auto 16px' }}
                />
            ) : (
                <img
                    src={isDataUrl ? raw : fallbackPng}
                    alt="鸟"
                    style={{ maxWidth: '200px', borderRadius: '8px', margin: '0 auto 16px', display: 'block' }}
                />
            )}
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>作者: {bird.artist_name}</p>
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>
                创作于: {new Date(bird.created_at).toLocaleDateString('zh-CN')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
                <button onClick={() => handleVote('like')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>👍 {likes}</button>
                <button onClick={() => handleVote('dislike')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>👎 {dislikes}</button>
            </div>
            <button
                onClick={onClose}
                style={{
                    marginTop: '16px',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                }}
            >
                关闭
            </button>
        </div>
    );
};

const BirdPage = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const birdsRef = useRef<AnimatedBird[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [isBirdReady, setIsBirdReady] = useState(false);
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedBird, setSelectedBird] = useState<AnimatedBird | null>(null);
    const [noBirdsFound, setNoBirdsFound] = useState(false);

    // Canvas 大小变化
    useLayoutEffect(() => {
        const onResize = () => setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // 加载背景
    useEffect(() => {
        const img = new Image();
        img.src = '/sky.png';
        img.onload = () => setBgImage(img);
    }, []);

    // 加载鸟群
    useEffect(() => {
        if (!canvasSize.width || !canvasSize.height) return;
        setLoading(true);
        setNoBirdsFound(false);
        birdsRef.current = [];

        const fetchAndSetBirds = async () => {
            try {
                const res = await fetch('/api/fishes');
                if (!res.ok) throw new Error('Failed to fetch birds');
                const birds: BirdData[] = await res.json();
                if (!birds.length) {
                    setNoBirdsFound(true);
                    return;
                }

                const selectedBirds = birds.slice(0, MAX_BIRDS); // 最多50只
                const loadedBirds: AnimatedBird[] = [];

                for (const data of selectedBirds) {
                    const img = new Image();
                    await new Promise<void>((resolve) => {
                        img.onload = () => {
                            const scale = MAX_BIRD_WIDTH / img.width;
                            const w = MAX_BIRD_WIDTH;
                            const h = img.height * scale;
                            const birdCanvas = document.createElement('canvas');
                            birdCanvas.width = w;
                            birdCanvas.height = h;
                            const ctx = birdCanvas.getContext('2d');
                            if (ctx) ctx.drawImage(img, 0, 0, w, h);

                            const randX = Math.random() * (canvasSize.width - w);
                            const randY = Math.random() * (canvasSize.height - h);

                            loadedBirds.push({
                                ...data,
                                canvas: birdCanvas,
                                x: randX,
                                y: randY,
                                baseY: randY, // 保存原始Y
                                vx: 1 + Math.random() * 2,
                                flapPhase: Math.random() * Math.PI * 2,
                                bobPhase: Math.random() * Math.PI * 2,
                                width: w,
                                height: h,
                            });
                            resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = data.image_data;
                    });
                }

                birdsRef.current = loadedBirds;
                setIsBirdReady(true);
            } catch (err) {
                console.error(err);
                setNoBirdsFound(true);
            } finally {
                setLoading(false);
            }
        };

        fetchAndSetBirds();
    }, [canvasSize, router]);

    // 动画循环
    useEffect(() => {
        if (!isBirdReady) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const animate = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 背景
            if (bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
            else {
                ctx.fillStyle = '#e0f2fe';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 遍历所有鸟
            birdsRef.current.forEach((bird) => {
                const flapSpeed = 0.4;
                const bobSpeed = 0.05;
                const bobHeight = 10;
                const flapAmount = 0.25;

                bird.flapPhase += flapSpeed;
                const flap = Math.sin(bird.flapPhase) * flapAmount;

                bird.bobPhase += bobSpeed;
                bird.y = bird.baseY + Math.sin(bird.bobPhase) * bobHeight; // 仅在 baseY 上摆动

                bird.x += bird.vx;
                if (bird.x > canvas.width - bird.width - 20 || bird.x < 20) bird.vx *= -1;

                const deformedCanvas = createFlapCanvas(bird.canvas, flap);

                ctx.save();
                ctx.translate(bird.x, bird.y);
                if (bird.vx > 0) {
                    ctx.scale(-1, 1);
                    ctx.translate(-bird.width, 0);
                }
                ctx.drawImage(deformedCanvas, 0, 0);
                ctx.restore();
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationFrameId);
    }, [isBirdReady, bgImage, canvasSize]);

    // 点击选中鸟
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const margin = 12;

        for (const bird of birdsRef.current) {
            if (
                x >= bird.x - margin &&
                x <= bird.x + bird.width + margin &&
                y >= bird.y - margin &&
                y <= bird.y + bird.height + margin
            ) {
                setSelectedBird(bird);
                break;
            }
        }
    };

    return (
        <>
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{ width: '100vw', height: '100vh' }}
                onClick={handleCanvasClick}
            />
            <button
                onClick={() => router.push('/')}
                style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    zIndex: 1000,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
                    cursor: 'pointer',
                }}
            >
                重新画鸟
            </button>

            {selectedBird && (
                <BirdInfoModal
                    birdsRef={birdsRef}
                    key={selectedBird.fish_id}
                    bird={selectedBird}
                    onClose={() => setSelectedBird(null)}
                />
            )}

            {loading && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.92)',
                        boxShadow: '0 12px 32px rgba(2,132,199,0.25)',
                        border: '1px solid #d1e9ff',
                        color: '#0b7285',
                    }}
                >
                    加载鸟儿中...
                </div>
            )}

            {noBirdsFound && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '16px 20px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.92)',
                        boxShadow: '0 12px 32px rgba(2,132,199,0.25)',
                        border: '1px solid #d1e9ff',
                        color: '#0b7285',
                    }}
                >
                    暂无小鸟，返回首页去绘制吧～
                </div>
            )}
        </>
    );
};

export default BirdPage;
