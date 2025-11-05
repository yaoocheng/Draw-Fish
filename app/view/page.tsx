"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FISH_RESIZE_WIDTH = 150;

interface Fish {
    id: number;
    artistName: string;
    imageData: string;
    width?: number;
    height?: number;
    createdAt: string;
}

interface AnimatedFish extends Fish {
    fishCanvas: HTMLCanvasElement;
    x: number;
    y: number;
    vx: number;
    vy: number;
    direction: number;
    phase: number;
    amplitude: number;
    speed: number;
    peduncle: number;
    width: number;
    height: number;
}

const FishInfoModal = ({ fish, onClose }: { fish: AnimatedFish; onClose: () => void }) => {
    if (!fish) return null;

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
            }}
        >
            <img src={fish.imageData} alt="一条小鱼" style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '16px' }} />
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>作者: {fish.artistName}</p>
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>
                创作于: {new Date(fish.createdAt).toLocaleDateString('zh-CN')}
            </p>
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

const useFishAnimation = (
    fishes: Fish[],
    tankRef: React.RefObject<HTMLCanvasElement | null>,
    localFishesRef: React.MutableRefObject<AnimatedFish[]>
) => {
    const animationFrameId = useRef<number | null>(null);

    const drawWigglingFish = (
        fish: AnimatedFish,
        x: number,
        y: number,
        direction: number,
        time: number,
        phase: number
    ) => {
        const tank = tankRef.current;
        if (!tank) return;
        const ctx = tank.getContext('2d');
        if (!ctx) return;

        const src = fish.fishCanvas;
        if (!src || src.width === 0 || src.height === 0) {
            console.warn('🐟 fishCanvas invalid', fish);
            return;
        }

        const w = fish.width;
        const h = fish.height;
        const tailEnd = Math.floor(w * fish.peduncle);

        for (let i = 0; i < w; i++) {
            let isTail, t, wiggle, drawCol;
            if (direction === 1) {
                isTail = i < tailEnd;
                t = isTail ? (tailEnd - i - 1) / (tailEnd - 1) : 0;
                wiggle = isTail ? Math.sin(time * 6 + phase + t * 3) * t * 16 : 0;
                drawCol = i;
            } else {
                isTail = i >= w - tailEnd;
                t = isTail ? (i - (w - tailEnd)) / (tailEnd - 1) : 0;
                wiggle = isTail ? Math.sin(time * 6 + phase + t * 3) * t * 16 : 0;
                drawCol = w - i - 1;
            }
            const ctx = tank.getContext('2d');
            if (!ctx) return;
            ctx.save();
            ctx.translate(x + i, y + wiggle);
            ctx.drawImage(src, drawCol, 0, 1, h, 0, 0, 1, h);
            ctx.restore();
        }
    };
    const loadedFishIds = useRef<Set<number>>(new Set());

    useEffect(() => {
        const tank = tankRef.current;
        if (!tank) return;
        const ctx = tank.getContext('2d');
        if (!ctx) return;

        let animationStarted = false;

        const newFishes = fishes.filter(fish => !localFishesRef.current.some(localFish => localFish.id === fish.id));

        newFishes.forEach((fish) => {
            if (loadedFishIds.current.has(fish.id)) return; // ✅ 已加载过的鱼跳过
            loadedFishIds.current.add(fish.id); // ✅ 立即标记，防止重复 onload
            
            const img = new Image();
            img.onload = () => {
                const fishCanvas = document.createElement('canvas');
                fishCanvas.width = img.width;
                fishCanvas.height = img.height;
                const fishCtx = fishCanvas.getContext('2d');
                if (fishCtx) fishCtx.drawImage(img, 0, 0);
                const initVx = (Math.random() - 0.5) * 2;
                const initVy = (Math.random() - 0.5) * 2;
                const initDirection = initVx >= 0 ? 1 : -1;

                localFishesRef.current.push({
                    ...fish,
                    fishCanvas,
                    x: Math.random() * (tank.width - (fish.width || MAX_FISH_RESIZE_WIDTH)),
                    y: Math.random() * (tank.height - (fish.height || 50)),
                    vx: initVx,
                    vy: initVy,
                    direction: initDirection,
                    phase: Math.random() * 2 * Math.PI,
                    amplitude: 5 + Math.random() * 5,
                    speed: 5.5 + Math.random() * 5.5,
                    peduncle: 0.4 + Math.random() * 0.2,
                    width: fish.width || MAX_FISH_RESIZE_WIDTH,
                    height: fish.height || 50,
                });

                if (!animationStarted) {
                    animationStarted = true;
                    startAnimation();
                }
            };
            img.src = fish.imageData;
        });

        const startAnimation = () => {
            const animate = () => {
                if (!ctx || !tank) return;
                ctx.clearRect(0, 0, tank.width, tank.height);
                const time = Date.now() / 500;

                localFishesRef.current.forEach((fish) => {
                    fish.x += fish.vx * fish.speed * 0.3;
                    fish.y += fish.vy * 0.3;

                    if (fish.x <= 0) {
                        fish.x = 0;
                        fish.direction = 1;
                        fish.vx = Math.abs(fish.vx);
                    } else if (fish.x >= tank.width - fish.width) {
                        fish.x = tank.width - fish.width;
                        fish.direction = -1;
                        fish.vx = -Math.abs(fish.vx);
                    }

                    if (fish.y <= 0 || fish.y >= tank.height - fish.height) {
                        fish.vy *= -1;
                    }

                    fish.direction = fish.vx >= 0 ? 1 : -1;

                    const swimY = fish.y + Math.sin(time + fish.phase) * fish.amplitude;
                    drawWigglingFish(
                        fish,
                        fish.x,
                        swimY,
                        fish.direction,
                        time,
                        fish.phase
                    );
                });

                animationFrameId.current = requestAnimationFrame(animate);
            };
            animate();
        };

        if (!animationFrameId.current) {
            startAnimation();
        }

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [fishes]);
};

const ViewPage = () => {
    const [fishes, setFishes] = useState<Fish[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const allFishes = JSON.parse(window.localStorage.getItem('fishes') || '[]') as Fish[];
            return allFishes.slice(-50);
        } catch (e) {
            return [];
        }
    });
    const tankRef = useRef<HTMLCanvasElement | null>(null);
    const router = useRouter();
    const localFishesRef = useRef<AnimatedFish[]>([]);
    const [selectedFish, setSelectedFish] = useState<AnimatedFish | null>(null);

    useFishAnimation(fishes, tankRef, localFishesRef);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = tankRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const clickedFish = [...localFishesRef.current].reverse().find((fish) => {
            return x >= fish.x && x <= fish.x + fish.width && y >= fish.y && y <= fish.y + fish.height;
        });

        if (clickedFish) {
            setSelectedFish(clickedFish);
        }
    };

    const handleReset = () => {
        window.localStorage.removeItem('fishes');
        setFishes([]);
        localFishesRef.current = [];
        router.push('/');
    };

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <canvas
                ref={tankRef}
                width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                height={typeof window !== 'undefined' ? window.innerHeight : 800}
                style={{ background: 'linear-gradient(135deg, #a5d8ff 0%, #d0ebff 100%)' }}
                onClick={handleCanvasClick}
            />
            <button
                onClick={handleReset}
                style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
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
                重新绘制小鱼
            </button>
            {selectedFish && <FishInfoModal fish={selectedFish} onClose={() => setSelectedFish(null)} />}
            {fishes.length === 0 && (
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
                    暂无小鱼，返回首页去绘制吧～
                </div>
            )}
        </div>
    );
};

export default ViewPage;