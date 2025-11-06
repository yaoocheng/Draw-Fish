'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FISH_RESIZE_WIDTH = 150;

// 兼容历史像素 JSON 的类型定义与类型守卫
type PixelJson = { data: number[]; width: number; height: number };
function isPixelJson(val: unknown): val is PixelJson {
    if (!val || typeof val !== 'object') return false;
    const obj = val as Record<string, unknown>;
    return (
        typeof obj.width === 'number' &&
        typeof obj.height === 'number' &&
        Array.isArray(obj.data) &&
        obj.data.every((n) => typeof n === 'number')
    );
}

// The base fish data structure from the database
interface DbFish {
    fish_id: number;
    artist_name: string;
    image_data: string;
    created_at: string;
}

// The extended fish object used for animation
interface AnimatedFish extends DbFish {
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

    const raw = (fish.image_data || '').trim();
    const isSvg = raw.startsWith('<svg');
    const isDataUrl = raw.startsWith('data:image/');
    const fallbackPng = fish.fishCanvas?.toDataURL('image/png');

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
                    alt="鱼"
                    style={{ maxWidth: '200px', borderRadius: '8px', margin: '0 auto 16px', display: 'block' }}
                />
            )}
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>作者: {fish.artist_name}</p>
            <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>
                创作于: {new Date(fish.created_at).toLocaleDateString('zh-CN')}
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
    fishes: DbFish[],
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
                drawCol = w - i - 1;
            } else {
                isTail = i >= w - tailEnd;
                t = isTail ? (i - (w - tailEnd)) / (tailEnd - 1) : 0;
                wiggle = isTail ? Math.sin(time * 6 + phase + t * 3) * t * 16 : 0;
                drawCol = i;
            }
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

        const newFishes = fishes.filter(fish => !localFishesRef.current.some(localFish => localFish.fish_id === fish.fish_id));

        newFishes.forEach((fish) => {
            if (loadedFishIds.current.has(fish.fish_id)) return;
            loadedFishIds.current.add(fish.fish_id);

            const img = new Image();
            img.onload = () => {
                const fishCanvas = document.createElement('canvas');
                const scale = MAX_FISH_RESIZE_WIDTH / img.width;
                const newWidth = MAX_FISH_RESIZE_WIDTH;
                const newHeight = img.height * scale;

                fishCanvas.width = newWidth;
                fishCanvas.height = newHeight;
                const fishCtx = fishCanvas.getContext('2d');
                if (fishCtx) fishCtx.drawImage(img, 0, 0, newWidth, newHeight);

                // 给 vx 设置最小绝对速度，避免鱼原地抖动
                let initVx = (Math.random() - 0.5) * 2; // -1~1
                if (Math.abs(initVx) < 0.3) {
                    initVx = initVx >= 0 ? 0.3 : -0.3;
                }
                const initVy = (Math.random() - 0.5) * 0.5;
                const initDirection = initVx >= 0 ? 1 : -1;

                localFishesRef.current.push({
                    ...fish,
                    fishCanvas,
                    x: Math.random() * (tank.width - newWidth),
                    y: Math.random() * (tank.height - newHeight),
                    vx: initVx,
                    vy: initVy,
                    direction: initDirection,
                    phase: Math.random() * 2 * Math.PI,
                    amplitude: 5 + Math.random() * 5,
                    speed: 1.5 + Math.random() * 1,
                    peduncle: 0.4 + Math.random() * 0.2,
                    width: newWidth,
                    height: newHeight,
                });

                // 确保动画已启动（在图片加载后立即启动，避免依赖变更导致动画被取消且未重启）
                if (!animationFrameId.current) {
                    animationStarted = true;
                    startAnimation();
                }
            };
            // 兼容多种历史存储格式：SVG 字符串、PNG/JPEG DataURL、JSON 的像素数组
            const raw = (fish.image_data || '').trim();
            if (raw.startsWith('<svg')) {
                img.src = 'data:image/svg+xml;base64,' + btoa(raw);
            } else if (raw.startsWith('data:image/')) {
                img.src = raw; // 已是 DataURL
            } else {
                let parsed: unknown = null;
                try {
                    parsed = JSON.parse(raw);
                } catch { }
                if (isPixelJson(parsed)) {
                    // 将 JSON 像素数组恢复为 PNG DataURL
                    const tmp = document.createElement('canvas');
                    tmp.width = parsed.width;
                    tmp.height = parsed.height;
                    const tctx = tmp.getContext('2d');
                    if (tctx) {
                        const imgData = new ImageData(
                            Uint8ClampedArray.from(parsed.data),
                            parsed.width,
                            parsed.height
                        );
                        tctx.putImageData(imgData, 0, 0);
                        img.src = tmp.toDataURL('image/png');
                    } else {
                        // 回退：当作 base64 PNG 处理
                        img.src = 'data:image/png;base64,' + raw;
                    }
                } else {
                    // 回退：当作 base64 PNG 处理
                    img.src = 'data:image/png;base64,' + raw;
                }
            }
        });

        const startAnimation = () => {
            const animate = () => {
                if (!ctx || !tank) return;
                ctx.clearRect(0, 0, tank.width, tank.height);
                const time = Date.now() / 500;

                localFishesRef.current.forEach((fish) => {
                    fish.x += fish.vx * fish.speed;
                    fish.y += fish.vy;

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

        if (localFishesRef.current.length > 0 && !animationFrameId.current) {
            startAnimation();
        }


        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null; // 重置以便后续可重新启动动画
            }
        };
    }, [fishes, localFishesRef, tankRef]);
};

const FishTankView = () => {
    const [fishes, setFishes] = useState<DbFish[]>([]);
    const [loading, setLoading] = useState(true);
    const tankRef = useRef<HTMLCanvasElement | null>(null);
    const localFishesRef = useRef<AnimatedFish[]>([]);
    const [selectedFish, setSelectedFish] = useState<AnimatedFish | null>(null);
    const router = useRouter();
    const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));

    useEffect(() => {
        const fetchFishes = async () => {
            try {
                const response = await fetch('/api/fishes');
                if (!response.ok) {
                    throw new Error('Failed to fetch fishes');
                }
                const data = await response.json();
                setFishes(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchFishes();
    }, []);

    // 监听窗口尺寸变化，保持画布全屏
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onResize = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useFishAnimation(fishes, tankRef, localFishesRef);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = tankRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // 使用与绘制一致的垂直摆动偏移，提高点击命中率
        const now = Date.now() / 500;
        const margin = 12; // 适度扩大命中区域，提升可点击性

        const clickedFish = [...localFishesRef.current].reverse().find((fish) => {
            const currentY = fish.y + Math.sin(now + fish.phase) * fish.amplitude;
            return (
                x >= fish.x - margin &&
                x <= fish.x + fish.width + margin &&
                y >= currentY - margin &&
                y <= currentY + fish.height + margin
            );
        });

        if (clickedFish) {
            setSelectedFish(clickedFish);
        }
    };


    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            <canvas
                ref={tankRef}
                width={viewport.width}
                height={viewport.height}
                style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #a5d8ff 0%, #d0ebff 100%)' }}
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
                重画
            </button>
            {selectedFish && <FishInfoModal fish={selectedFish} onClose={() => setSelectedFish(null)} />}
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
                    加载鱼儿中...
                </div>
            )}
            {!loading && fishes.length === 0 && (
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

export default FishTankView;