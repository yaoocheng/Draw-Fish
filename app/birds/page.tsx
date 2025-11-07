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

type WormState = 'falling' | 'landed';

interface Worm {
    x: number;
    y: number;
    vy: number;
    state: WormState;
    createdAt: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    color: string;
}

const MAX_BIRD_WIDTH = 150;

const createFlapCanvas = (sourceCanvas: HTMLCanvasElement, flap: number) => {
    const { width, height } = sourceCanvas;
    const destCanvas = document.createElement('canvas');
    destCanvas.width = width;
    destCanvas.height = height * 1.5;
    const destCtx = destCanvas.getContext('2d')!;

    const slices = 200;
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
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    padding: '24px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 12px 48px rgba(37, 99, 235, 0.3)',
                    border: '1px solid #a5d8ff',
                    textAlign: 'center',
                    maxWidth: '360px'
                }}
            >
                {isSvg ? (
                    <div
                        dangerouslySetInnerHTML={{ __html: raw }}
                        style={{ maxWidth: '150px', borderRadius: '8px', margin: '0 auto 16px' }}
                    />
                ) : (
                    <img
                        src={isDataUrl ? raw : fallbackPng}
                        alt="鸟"
                        style={{ maxWidth: '150px', borderRadius: '8px', margin: '0 auto 16px', display: 'block' }}
                    />
                )}
                <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>作者: {bird.artist_name}</p>
                <p style={{ margin: '8px 0', color: '#0b7285', fontWeight: 500 }}>
                    创作于: {
                        new Date(bird.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                    }
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
                    <button className='border border-solid border-[#f0f0f0] hover:bg-[#d4edda] hover:border-[#28a745] rounded-md bg-white px-2 py-1' onClick={() => handleVote('like')} style={{ cursor: 'pointer', fontSize: '18px' }}>👍 {likes}</button>
                    <button className='border border-solid border-[#f0f0f0] hover:bg-[#f8d7da] hover:border-[#dc3545] rounded-md bg-white px-2 py-1' onClick={() => handleVote('dislike')} style={{ cursor: 'pointer', fontSize: '18px' }}>👎 {dislikes}</button>
                </div>
            </div>
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
    const [worm, setWorm] = useState<Worm | null>(null);
    const wormRef = useRef<Worm | null>(null);
    const particlesRef = useRef<Particle[]>([]);

    const createExplosion = (x: number, y: number) => {
        const particleCount = 15;
        const newParticles: Particle[] = [];
        const colors = ['#89de50', '#0d7218', '#facc15'];

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            newParticles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }
        particlesRef.current = newParticles;
    };


    // 当虫子状态改变时，同步到 ref
    useEffect(() => {
        // 使用深拷贝以避免 state 和 ref 之间的意外突变
        wormRef.current = worm ? JSON.parse(JSON.stringify(worm)) : null;
    }, [worm]);


    // 当虫子消失时，更新所有鸟的 baseY，以便它们从新位置开始漂浮
    useEffect(() => {
        if (!worm) {
            birdsRef.current.forEach(bird => {
                bird.baseY = bird.y;
            });
        }
    }, [worm]);

    // 当虫子落地后自动清除（例如 6 秒后）
    // useEffect(() => {
    //     if (!worm) return;
    //     if (worm.state === 'landed') {
    //         const t = setTimeout(() => setWorm(null), 6000);
    //         return () => clearTimeout(t);
    //     }
    // }, [worm]);

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
                const userId = (() => {
                    try {
                        return localStorage.getItem('user_id') || null;
                    } catch {
                        return null;
                    }
                })();
                const url = userId ? `/api/fishes?user_id=${encodeURIComponent(userId)}` : '/api/fishes';
                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch birds');
                const birds: BirdData[] = await res.json();
                if (!birds.length) {
                    setNoBirdsFound(true);
                    return;
                }

                const loadedBirds: AnimatedBird[] = [];

                for (const data of birds) {
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

            const currentWorm = wormRef.current;
            // 🐛 绘制虫子（黄色、弯曲、缓慢下降）
            if (currentWorm) {
                // 🪱 让虫子持续缓慢下降
                if (currentWorm.state === 'falling') {
                    currentWorm.vy += 0.03; // 减小重力加速度 -> 缓慢
                    currentWorm.y += currentWorm.vy * 0.3; // 下降速度更柔和

                    // 如果虫子掉出屏幕外，就消失
                    if (currentWorm.y > canvas.height) {
                        setWorm(null);
                    }
                }

                // 🪱 绘制虫子身体（弯曲+渐变+条纹）
                const bodyLength = 35;
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.beginPath();

                // 用贝塞尔曲线画出虫子的弯曲身体
                ctx.moveTo(currentWorm.x, currentWorm.y);
                ctx.quadraticCurveTo(
                    currentWorm.x + 10,
                    currentWorm.y + bodyLength / 2,
                    currentWorm.x,
                    currentWorm.y + bodyLength
                );

                // 渐变填充
                const grad = ctx.createLinearGradient(
                    currentWorm.x - 10,
                    currentWorm.y,
                    currentWorm.x + 10,
                    currentWorm.y + bodyLength
                );
                grad.addColorStop(0, '#a3e635'); // 明绿
                grad.addColorStop(1, '#4d7c0f'); // 暗绿
                ctx.strokeStyle = grad;
                ctx.stroke();
                ctx.closePath();

                // 🟢 添加身体条纹（横纹）
                const segmentCount = 5; // 条纹数
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';

                for (let i = 1; i < segmentCount; i++) {
                    const t = i / segmentCount;
                    const sx = currentWorm.x + Math.sin(t * Math.PI) * 4; // 小摆动
                    const sy = currentWorm.y + t * bodyLength;
                    ctx.beginPath();
                    ctx.moveTo(sx - 4, sy);
                    ctx.lineTo(sx + 4, sy);
                    ctx.stroke();
                }

                // 🟠 小虫头
                ctx.beginPath();
                ctx.arc(currentWorm.x, currentWorm.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#166534'; // 深绿头
                ctx.fill();
                ctx.closePath();

                // 🩶 小眼睛点缀（可选）
                ctx.beginPath();
                ctx.arc(currentWorm.x - 2, currentWorm.y - 2, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.closePath();
            }


            // ✨ 粒子效果（修正版：无闪烁、平滑消散）
            const particles = particlesRef.current;

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;

                if (p.alpha > 0) {
                    ctx.globalAlpha = Math.max(p.alpha, 0);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                }
            }

            // ✅ 恢复透明度并统一清理
            ctx.globalAlpha = 1;
            particlesRef.current = particles.filter(p => p.alpha > 0);



            // 🐦 鸟动画与追虫逻辑
            birdsRef.current.forEach((bird) => {
                const flapSpeed = 0.4;
                const bobSpeed = 0.05;
                const bobHeight = 10;
                const flapAmount = 0.25;

                bird.flapPhase += flapSpeed;
                const flap = Math.sin(bird.flapPhase) * flapAmount;
                bird.bobPhase += bobSpeed;

                const WORM_EAT_RADIUS = 40;
                const WORM_ATTRACT_RADIUS = 250; // 吸引半径

                let isChasing = false;
                if (currentWorm) {
                    const dx = currentWorm.x - (bird.x + bird.width / 2);
                    const dy = currentWorm.y - (bird.y + bird.height / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // 只有在吸引半径内的鸟才会冲向虫子
                    if (dist < WORM_ATTRACT_RADIUS) {
                        isChasing = true;

                        // 保证鸟始终面向虫子
                        if (dist > 1) {
                            const angle = Math.atan2(dy, dx);
                            const speed = 3;
                            bird.x += Math.cos(angle) * speed;
                            bird.y += Math.sin(angle) * speed;
                            bird.vx = Math.sign(Math.cos(angle)) * Math.abs(bird.vx || 1);
                        }

                        // 碰到虫子
                        if (dist < WORM_EAT_RADIUS) {
                            console.log('虫子消失');

                            createExplosion(currentWorm.x, currentWorm.y);
                            setWorm(null);
                        }
                    }
                }

                // 如果没有追虫子，就普通巡航
                if (!isChasing) {
                    bird.x += bird.vx;
                    bird.y = bird.baseY + Math.sin(bird.bobPhase) * bobHeight;
                }

                const leftBoundary = 20;
                const rightBoundary = canvas.width - bird.width - 20;

                if (bird.x < leftBoundary) {
                    bird.x = leftBoundary;
                    bird.vx *= -1;
                } else if (bird.x > rightBoundary) {
                    bird.x = rightBoundary;
                    bird.vx *= -1;
                }

                const deformedCanvas = createFlapCanvas(bird.canvas, flap);

                ctx.save();
                ctx.translate(bird.x, bird.y);
                // 根据当前 vx 决定朝向，确保鸟“面向”移动方向
                const facingLeft = (bird.vx < 0);
                if (!facingLeft) {
                    // if vx positive, we want bird draw normally (facing right).
                    // Your previous code inverted based on vx > 0; preserve that logic:
                }
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
                onContextMenu={(e) => {
                    e.preventDefault();
                    // 仅当没有虫子时才创建新虫子
                    if (!worm) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        // 生成虫子：在用户右键点击的位置生成并开始掉落
                        setWorm({
                            x: clickX,
                            y: clickY,
                            vy: 0,
                            state: 'falling',
                            createdAt: Date.now(),
                        });
                    }
                }}
            />

            {/* 🍞 提示框 - 投喂引导 */}
            <div
                className="
    absolute top-4 left-4
    flex items-center gap-2
    text-white font-semibold 
    px-4 py-[10px] text-xl
    transition-all duration-300
  "
            >
                <span>右击天空投喂</span>
            </div>


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
                    background: 'linear-gradient(135deg, #3bf692, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
                    cursor: 'pointer',
                }}
            >
                重新作画
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
