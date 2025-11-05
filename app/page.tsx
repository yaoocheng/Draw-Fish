"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';

// Helper functions
// const getRandom = <T,>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const MAX_FISH_RESIZE_WIDTH = 150;

// Custom hook for fish animation
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

// const useFishAnimation = (fishes: Fish[], tankRef: React.RefObject<HTMLCanvasElement | null>) => {
//     const localFishesRef = useRef<AnimatedFish[]>([]);
//     const animationFrameId = useRef<number | null>(null);

//     const drawWigglingFish = (fish: AnimatedFish, x: number, y: number, direction: number, time: number, phase: number) => {
//         const tank = tankRef.current;
//         if (!tank) return;
//         const ctx = tank.getContext('2d');
//         if (!ctx) return;

//         const src = fish.fishCanvas;
//         if (!src || src.width === 0 || src.height === 0) {
//             console.warn('🐟 fishCanvas invalid', fish);
//             return;
//         }

//         const w = fish.width;
//         const h = fish.height;
//         const tailEnd = Math.floor(w * fish.peduncle);

//         for (let i = 0; i < w; i++) {
//             let isTail, t, wiggle, drawCol;
//             if (direction === 1) {
//                 isTail = i < tailEnd;
//                 t = isTail ? (tailEnd - i - 1) / (tailEnd - 1) : 0;
//                 wiggle = isTail ? Math.sin(time * 6 + phase + t * 3) * t * 16 : 0;
//                 drawCol = i;
//             } else {
//                 isTail = i >= w - tailEnd;
//                 t = isTail ? (i - (w - tailEnd)) / (tailEnd - 1) : 0;
//                 wiggle = isTail ? Math.sin(time * 6 + phase + t * 3) * t * 16 : 0;
//                 drawCol = w - i - 1;
//             }
//             ctx.save();
//             ctx.translate(x + i, y + wiggle);
//             ctx.drawImage(src, drawCol, 0, 1, h, 0, 0, 1, h);
//             ctx.restore();
//         }
//     };

//     const loadedFishIds = useRef<Set<number>>(new Set());


//     useEffect(() => {
//         const tank = tankRef.current;
//         if (!tank) return;
//         const ctx = tank.getContext('2d');
//         if (!ctx) return;

//         let animationStarted = false;

//         // 把新增的鱼追加进 localFishesRef
//         fishes.forEach(fish => {
//             // 如果这条鱼已经在 localFishesRef 中，就跳过
//             // if (localFishesRef.current.some(f => f.id === fish.id)) return;
//             if (loadedFishIds.current.has(fish.id)) return; // ✅ 已加载过的鱼跳过
//             loadedFishIds.current.add(fish.id); // ✅ 立即标记，防止重复 onload


//             const img = new Image();
//             img.onload = () => {
//                 const fishCanvas = document.createElement('canvas');
//                 fishCanvas.width = img.width;
//                 fishCanvas.height = img.height;
//                 const fishCtx = fishCanvas.getContext('2d');
//                 if (fishCtx) fishCtx.drawImage(img, 0, 0);
//                 // 让初始朝向与速度一致，避免刷新后“倒着游”
//                 const initVx = (Math.random() - 0.5) * 2;
//                 const initVy = (Math.random() - 0.5) * 2;
//                 const initDirection = initVx >= 0 ? 1 : -1;

//                 localFishesRef.current.push({
//                     ...fish,
//                     fishCanvas,
//                     x: Math.random() * (tank.width - (fish.width || MAX_FISH_RESIZE_WIDTH)),
//                     y: Math.random() * (tank.height - (fish.height || 50)),
//                     vx: initVx,
//                     vy: initVy,
//                     direction: initDirection,
//                     phase: Math.random() * 2 * Math.PI,
//                     amplitude: 5 + Math.random() * 5,
//                     speed: 5.5 + Math.random() * 5.5, // 🐟 提高速度
//                     peduncle: 0.4 + Math.random() * 0.2,
//                     width: fish.width || MAX_FISH_RESIZE_WIDTH,
//                     height: fish.height || 50,
//                 });

//                 if (!animationStarted) {
//                     animationStarted = true;
//                     startAnimation();
//                 }
//             };
//             img.src = fish.imageData;
//         });

//         const startAnimation = () => {
//             const animate = () => {
//                 if (!ctx || !tank) return;
//                 ctx.clearRect(0, 0, tank.width, tank.height);
//                 const time = Date.now() / 500;

//                 localFishesRef.current.forEach(fish => {
//                     fish.x += fish.vx * fish.speed * 0.3; // 🐠 提速
//                     fish.y += fish.vy * 0.3;

//                     // 边界检测
//                     if (fish.x <= 0) {
//                         fish.x = 0;
//                         fish.direction = 1;
//                         fish.vx = Math.abs(fish.vx);
//                     } else if (fish.x >= tank.width - fish.width) {
//                         fish.x = tank.width - fish.width;
//                         fish.direction = -1;
//                         fish.vx = -Math.abs(fish.vx);
//                     }

//                     if (fish.y <= 0 || fish.y >= tank.height - fish.height) {
//                         fish.vy *= -1;
//                     }

//                     // 确保朝向始终与水平速度一致，彻底避免“倒着游”
//                     fish.direction = fish.vx >= 0 ? 1 : -1;

//                     const swimY = fish.y + Math.sin(time + fish.phase) * fish.amplitude;
//                     drawWigglingFish(fish, fish.x, swimY, fish.direction, time, fish.phase);
//                 });

//                 animationFrameId.current = requestAnimationFrame(animate);
//             };
//             animate();
//         };

//         // 启动动画一次即可
//         if (!animationFrameId.current) {
//             startAnimation();
//         }

//         return () => {
//             if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
//         };
//     }, [fishes]);

// };


// Main Component
const FishTankComponent = () => {
    const [fishes, setFishes] = useState<Fish[]>(() => {
        if (typeof window === 'undefined') return [];
        const savedFishes = JSON.parse(window.localStorage.getItem('fishes') || '[]') as Fish[];
        return savedFishes;
    });
    const [view, setView] = useState(() => {
        if (typeof window === 'undefined') return 'drawing';
        const savedFishes = JSON.parse(window.localStorage.getItem('fishes') || '[]') as Fish[];
        return savedFishes.length > 0 ? 'tank' : 'drawing';
    }); // drawing, artistName, tank
    const [currentDrawing, setCurrentDrawing] = useState<string | null>(null);
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushRadius, setBrushRadius] = useState(10);
    const canvasRef = useRef<ReactSketchCanvasRef | null>(null);
    const router = useRouter();



    const saveFish = (artistName: string) => {
        if (!currentDrawing) return;
        const img = new Image();
        img.onload = () => {
            const newFish: Fish = {
                id: Date.now(),
                artistName,
                imageData: currentDrawing,
                width: img.width,
                height: img.height,
                createdAt: new Date().toISOString(),
            };
            const updatedFishes = [...fishes, newFish];
            setFishes(updatedFishes);
            localStorage.setItem('fishes', JSON.stringify(updatedFishes));
            setView('tank');
        };
        img.src = currentDrawing;
    };

    const handleSaveDrawing = async () => {
        if (!canvasRef.current) return;
        const imageData = await canvasRef.current.exportImage('png');

        // Crop the canvas to the content
        const croppedImage = await cropCanvasToContent(imageData);
        setCurrentDrawing(croppedImage);
        setView('artistName');
    };

    const cropCanvasToContent = (imageDataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(imageDataUrl);
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                const padding = 5;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const index = (y * canvas.width + x) * 4;
                        const alpha = data[index + 3]; // alpha 通道
                        if (alpha > 10) { // 不是完全透明的点
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                if (maxX <= minX || maxY <= minY) {
                    resolve(imageDataUrl);
                    return;
                }

                const width = maxX - minX + 2 * padding;
                const height = maxY - minY + 2 * padding;

                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = width;
                croppedCanvas.height = height;
                const croppedCtx = croppedCanvas.getContext('2d')!;
                croppedCtx.drawImage(
                    canvas,
                    minX - padding,
                    minY - padding,
                    width,
                    height,
                    0,
                    0,
                    width,
                    height
                );

                // 缩放至合理大小
                if (width > MAX_FISH_RESIZE_WIDTH) {
                    const scale = MAX_FISH_RESIZE_WIDTH / width;
                    const resizedCanvas = document.createElement('canvas');
                    resizedCanvas.width = MAX_FISH_RESIZE_WIDTH;
                    resizedCanvas.height = height * scale;
                    const resizedCtx = resizedCanvas.getContext('2d')!;
                    resizedCtx.drawImage(croppedCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
                    resolve(resizedCanvas.toDataURL('image/png'));
                } else {
                    resolve(croppedCanvas.toDataURL('image/png'));
                }
            };
            img.src = imageDataUrl;
        });
    };


    const handleClear = () => {
        if (canvasRef.current) {
            canvasRef.current.clearCanvas();
        }
    };

    useEffect(() => {
        if (view === 'tank') {
            router.push('/view');
        }
    }, [view, router]);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #b3e5fc 0%, #e1f5fe 100%)' }}>
            {view === 'drawing' && (
                <DrawingCanvas
                    canvasRef={canvasRef}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushRadius={brushRadius}
                    setBrushRadius={setBrushRadius}
                    onSave={handleSaveDrawing}
                    onClear={handleClear}
                />
            )}
            {view === 'artistName' && <ArtistNameModal onSave={saveFish} />}
            {/* 当视图为“tank”时自动跳转到 /view 页面，这里不再内嵌渲染 */}
        </div>
    );
};

// Sub-components
const DrawingCanvas = ({ canvasRef, brushColor, setBrushColor, brushRadius, setBrushRadius, onSave, onClear }: { canvasRef: React.RefObject<ReactSketchCanvasRef | null>, brushColor: string, setBrushColor: (color: string) => void, brushRadius: number, setBrushRadius: (radius: number) => void, onSave: () => void, onClear: () => void }) => (
    <div style={{ border: '1px solid #d1e9ff', borderRadius: '16px', padding: '16px', background: 'rgba(255,255,255,0.88)', boxShadow: '0 12px 32px rgba(2,132,199,0.25)', backdropFilter: 'saturate(180%) blur(6px)', maxWidth: '1040px' }}>
        <h2 style={{ margin: '0 0 12px', color: '#0b7285' }}>画出你的小鱼（方向请朝右）</h2>
        <ReactSketchCanvas
            ref={canvasRef}
            width="1000px"
            height="500px"
            strokeWidth={brushRadius}
            strokeColor={brushColor}
            canvasColor="transparent"
        />
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ color: '#0b7285', fontWeight: 600 }}>颜色：</label>
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} style={{ width: '40px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
            <label style={{ marginLeft: '10px', color: '#0b7285', fontWeight: 600 }}>笔刷大小：</label>
            <input type="range" min="1" max="50" value={brushRadius} onChange={(e) => setBrushRadius(Number(e.target.value))} style={{ width: '200px' }} />
            <button onClick={onSave} style={{ marginLeft: '16px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(22,163,74,0.35)', cursor: 'pointer' }}>保存小鱼</button>
            <button onClick={onClear} style={{ marginLeft: '10px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fb7185, #ef4444)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(239,68,68,0.35)', cursor: 'pointer' }}>清空画布</button>
        </div>
    </div>
);

const ArtistNameModal = ({ onSave }: { onSave: (name: string) => void }) => {
    const [name, setName] = useState('');
    return (
        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.95)', borderRadius: '16px', boxShadow: '0 12px 32px rgba(2,132,199,0.25)', border: '1px solid #d1e9ff', backdropFilter: 'saturate(180%) blur(6px)', minWidth: '360px' }}>
            <h2 style={{ marginTop: 0, color: '#0b7285' }}>填写你的艺术家名字</h2>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="艺术家名字" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #93c5fd', marginTop: '8px' }} />
            <button onClick={() => onSave(name || '匿名')} style={{ marginLeft: '10px', marginTop: '12px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(37,99,235,0.35)', cursor: 'pointer' }}>提交</button>
        </div>
    );
};

// FishTank 组件已迁移到 /view/page.tsx

export default FishTankComponent;