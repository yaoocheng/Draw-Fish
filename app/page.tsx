'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import Example from '@/components/Example';

// 裁剪 PNG DataURL，去除透明边界
const cropCanvasToContent = (dataUrl: string, padding = 10): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(dataUrl);
            ctx.drawImage(img, 0, 0);
            const { width, height } = canvas;
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            let minX = width,
                minY = height,
                maxX = 0,
                maxY = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (data[idx + 3] !== 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            if (maxX <= minX || maxY <= minY) return resolve(dataUrl);

            const cropW = maxX - minX + 1;
            const cropH = maxY - minY + 1;
            const destCanvas = document.createElement('canvas');
            destCanvas.width = cropW + padding * 2;
            destCanvas.height = cropH + padding * 2;
            const destCtx = destCanvas.getContext('2d');
            if (!destCtx) return resolve(dataUrl);

            destCtx.drawImage(canvas, minX, minY, cropW, cropH, padding, padding, cropW, cropH);
            resolve(destCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

const BirdDrawingPage = () => {
    const [view, setView] = useState<'drawing' | 'artistName'>('drawing');
    const [currentDrawingDataUrl, setCurrentDrawingDataUrl] = useState<string | null>(null);
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushRadius, setBrushRadius] = useState(10); // 笔刷（画笔）大小
    const [eraserWidth, setEraserWidth] = useState(20); // ✅ 橡皮擦大小（新增）
    const [isErasing, setIsErasing] = useState(false); // ✅ 橡皮擦模式
    const canvasRef = useRef<ReactSketchCanvasRef | null>(null);
    const router = useRouter();

    const [artistName, setArtistName] = useState(() => {
        if (typeof window === 'undefined') return '';
        return window.localStorage.getItem('artistName') || '';
    });
    const [userId, setUserId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const stored = window.localStorage.getItem('userId');
        return stored ? parseInt(stored, 10) : null;
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const saveBird = async (name?: string) => {
        if (loading || saving) return;

        // ✅ 检查是否画过东西
        // const paths = await canvasRef.current?.exportPaths();
        // console.log(paths);
        // if (!paths || paths.length === 0) {
        //     // alert('请先画一只鸟再提交哦 🐦');
        //     return;
        // }

        setSaving(true);

        const exportCurrent = async (): Promise<string | null> => {
            if (!canvasRef.current) return null;
            const pngDataUrl = await canvasRef.current.exportImage('png');
            const cropped = await cropCanvasToContent(pngDataUrl);
            return cropped || pngDataUrl;
        };

        const artist = (name ?? '').trim() || artistName.trim();

        if (!artist) {
            const dataUrl = await exportCurrent();
            if (dataUrl) setCurrentDrawingDataUrl(dataUrl);
            setView('artistName');
            setSaving(false);
            return;
        }

        let dataUrl = currentDrawingDataUrl;

        if (!dataUrl) dataUrl = await exportCurrent();
        if (!dataUrl) return setSaving(false);

        setLoading(true);
        try {
            const res = await fetch('/api/fish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist_name: artist, image_data: dataUrl, userId }),
            });

            if (res.ok) {
                const result = await res.json();
                localStorage.setItem('artistName', artist);
                if (result.userId) {
                    localStorage.setItem('userId', result.userId.toString());
                    setUserId(result.userId);
                }
                setArtistName(artist);
                setView('drawing');
                router.push('/birds');
            } else {
                console.error('保存鸟失败');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setCurrentDrawingDataUrl(null);
            setSaving(false);
        }
    };

    const handleClear = () => canvasRef.current?.clearCanvas();
    const handleUndo = () => canvasRef.current?.undo();

    // 切换橡皮擦模式：同时设置 prop（eraseMode）和 ref 方法（兼容）
    const toggleEraser = async () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            setIsErasing(prev => !prev);
            return;
        }
        const newMode = !isErasing;
        setIsErasing(newMode);
        try {
            // 方法调用（旧版 / 兼容）
            await canvas.eraseMode(newMode);
        } catch (e) {
            // ignore if method not present
        }
    };

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                // background: 'linear-gradient(135deg, #b3e5fc 0%, #e1f5fe 100%)',
            }}
        >
            {/* <h1
        style={{
          fontSize: '48px',
          fontWeight: '800',
          color: '#0b7285',
          textShadow: '2px 2px 8px rgba(0,0,0,0.2)',
          marginBottom: '24px',
        }}
      >
        大家一起来玩鸟 🐦
      </h1> */}

            {view === 'drawing' && (
                <DrawingCanvas
                    canvasRef={canvasRef}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushRadius={brushRadius}
                    setBrushRadius={setBrushRadius}
                    eraserWidth={eraserWidth}
                    setEraserWidth={setEraserWidth}
                    saving={saving}
                    onSave={() => saveBird()}
                    onClear={handleClear}
                    onUndo={handleUndo}
                    onToggleEraser={toggleEraser}
                    isErasing={isErasing}
                />
            )}

            {view === 'artistName' && (
                <ArtistNameModal onSave={saveBird} initialArtistName={artistName} loading={loading} />
            )}
        </div>
    );
};

const DrawingCanvas = ({
    canvasRef,
    brushColor,
    setBrushColor,
    brushRadius,
    setBrushRadius,
    eraserWidth,
    setEraserWidth,
    onSave,
    onClear,
    saving,
    onUndo,
    onToggleEraser,
    isErasing,
}: {
    canvasRef: React.RefObject<ReactSketchCanvasRef | null>;
    brushColor: string;
    setBrushColor: (color: string) => void;
    brushRadius: number;
    setBrushRadius: (radius: number) => void;
    eraserWidth: number;
    setEraserWidth: (w: number) => void;
    onSave: () => void;
    onClear: () => void;
    saving: boolean;
    onUndo: () => void;
    onToggleEraser: () => void;
    isErasing: boolean;
}) => {
    const router = useRouter();
    const [hasContent, setHasContent] = useState(false);
    return (
        <div
            style={{
                border: '1px solid #d1e9ff',
                padding: '16px',
                // background: 'rgba(255,255,255,0.88)',
                boxShadow: '0 12px 32px rgba(2,132,199,0.25)',
                backdropFilter: 'saturate(180%) blur(6px)',
                width: '100%',
                height: '100%',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '12px',
                }}
            >
                <Example />
                <div
                    onClick={() => router.push('/rank')}
                    className="text-teal-700 font-semibold cursor-pointer hover:text-teal-800 hover:underline transition"
                >
                    查看排名
                </div>
            </div>

            {/* 关键：传入 strokeWidth、eraserWidth 和 eraseMode */}
            <ReactSketchCanvas
                ref={canvasRef}
                width="100%"
                height="86%"
                strokeWidth={brushRadius}
                eraserWidth={eraserWidth}
                // eraseMode={isErasing}
                strokeColor={brushColor}
                canvasColor="transparent"
                onChange={(paths: unknown) => {
                    const has = Array.isArray(paths) && paths.length > 0;
                    setHasContent(has);
                }}
            />

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* 画笔模式控件 */}
                {!isErasing && (
                    <>
                        <label style={{ color: '#0b7285', fontWeight: 600 }}>颜色：</label>
                        <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            style={{
                                width: '40px',
                                height: '32px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                            }}
                        />
                        <label style={{ marginLeft: '10px', color: '#0b7285', fontWeight: 600 }}>笔刷大小：</label>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushRadius}
                            onChange={(e) => setBrushRadius(Number(e.target.value))}
                            style={{ width: '200px' }}
                        />
                        <div style={{ fontSize: 12, color: '#0b7285' }}>当前大小: {brushRadius}</div>
                    </>
                )}

                {/* 橡皮擦模式控件（独立大小） */}
                {isErasing && (
                    <>
                        <label style={{ color: '#0b7285', fontWeight: 600 }}>橡皮擦大小：</label>
                        <input
                            type="range"
                            min="5"
                            max="120"
                            value={eraserWidth}
                            onChange={(e) => setEraserWidth(Number(e.target.value))}
                            style={{ width: '200px' }}
                        />
                        <div style={{ fontSize: 12, color: '#0b7285' }}>当前大小: {eraserWidth}</div>
                    </>
                )}

                <button
                    onClick={onToggleEraser}
                    className={`
    ml-2 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer
    ${isErasing
                            ? 'bg-teal-700 text-white border border-teal-700 shadow-md hover:bg-teal-800'
                            : 'text-teal-700 border border-transparent hover:bg-teal-50'}
  `}
                >
                    橡皮擦
                </button>


                <button
                    onClick={onUndo}
                    className="ml-2 cursor-pointer text-teal-700 font-semibold hover:text-teal-800 transition"
                >
                    撤回
                </button>


                <button
                    onClick={() => {
                        onClear();
                        setHasContent(false);
                    }}
                    className="ml-2 cursor-pointer text-teal-700 font-semibold hover:text-teal-800  transition"
                >
                    清空画布
                </button>


                <button
                    onClick={onSave}
                    disabled={saving || !hasContent}
                    className={`
    ml-auto rounded-lg px-4 py-2 font-semibold text-white transition
    ${(saving || !hasContent)
                            ? 'bg-green-300 cursor-not-allowed'
                            : 'bg-gradient-to-tr cursor-pointer from-green-500 to-green-600 shadow-xl shadow-green-500/40 hover:shadow-xl hover:shadow-green-600/50'}
  `}
                >
                    {saving ? '处理中...' : '开始散养'}
                </button>


                <button
                    onClick={() => router.push('/birds')}
                    className="ml-2 rounded-lg px-4 py-2 cursor-pointer font-semibold text-white bg-[#7777e5] shadow-xl shadow-[#7777e5]/40 hover:shadow-xl hover:shadow-[#7777e5]/60 transition"
                >
                    去看小鸟
                </button>

            </div>
        </div>
    );
};

// 艺术家名字弹窗（不变）
const ArtistNameModal = ({
    onSave,
    initialArtistName,
    loading,
}: {
    onSave: (name: string) => void;
    initialArtistName: string;
    loading: boolean;
}) => {
    const [name, setName] = useState(initialArtistName);
    return (
        <div
            style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '16px',
                boxShadow: '0 12px 32px rgba(2,132,199,0.25)',
                border: '1px solid #d1e9ff',
                backdropFilter: 'saturate(180%) blur(6px)',
                minWidth: '360px',
            }}
        >
            <h2 style={{ marginTop: 0, color: '#0b7285' }}>填写你的艺术家名字</h2>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="艺术家名字"
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    marginTop: '8px',
                    boxSizing: 'border-box',
                }}
            />
            <button
                onClick={() => onSave(name || '匿名')}
                disabled={loading}
                className={`
    w-full mt-3 rounded-lg px-4 py-2.5 font-semibold text-white transition cursor-pointer
    ${loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-tr from-blue-500 to-blue-600 shadow-xl shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-600/50'}
  `}
            >
                {loading ? '提交中...' : '提交'}
            </button>

        </div>
    );
};

export default BirdDrawingPage;
