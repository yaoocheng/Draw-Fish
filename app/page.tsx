'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import Example from '@/components/Example'; 

interface Bird {
    bird_id: number;
    artist_name: string;
    image_data: string;
    created_at: string;
}

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

            let minX = width, minY = height, maxX = 0, maxY = 0;
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
    const [brushRadius, setBrushRadius] = useState(10);
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
                setView('drawing'); // 返回绘画视图
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

    // 撤销功能
    const handleUndo = () => {
        if (canvasRef.current) {
            canvasRef.current.undo();
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #b3e5fc 0%, #e1f5fe 100%)' }}>
            <h1 style={{ fontSize: '48px', fontWeight: '800', color: '#0b7285', textShadow: '2px 2px 8px rgba(0,0,0,0.2)', marginBottom: '24px' }}>
                大家一起来玩鸟 🐦
            </h1>

            {view === 'drawing' && (
                <DrawingCanvas
                    canvasRef={canvasRef}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushRadius={brushRadius}
                    setBrushRadius={setBrushRadius}
                    saving={saving}
                    onSave={() => saveBird()}
                    onClear={handleClear}
                    onUndo={handleUndo} // 传递撤销方法
                />
            )}
            {view === 'artistName' && <ArtistNameModal onSave={saveBird} initialArtistName={artistName} loading={loading} />}
        </div>
    );
};

// Canvas 子组件
const DrawingCanvas = ({ 
    canvasRef, 
    brushColor, 
    setBrushColor, 
    brushRadius, 
    setBrushRadius, 
    onSave, 
    onClear, 
    saving, 
    onUndo 
}: { 
    canvasRef: React.RefObject<ReactSketchCanvasRef | null>, 
    brushColor: string, 
    setBrushColor: (color: string) => void, 
    brushRadius: number, 
    setBrushRadius: (radius: number) => void, 
    onSave: () => void, 
    onClear: () => void, 
    saving: boolean, 
    onUndo: () => void 
}) => {
    const router = useRouter();
    return (
        <div style={{ border: '1px solid #d1e9ff', borderRadius: '16px', padding: '16px', background: 'rgba(255,255,255,0.88)', boxShadow: '0 12px 32px rgba(2,132,199,0.25)', backdropFilter: 'saturate(180%) blur(6px)', maxWidth: '1040px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Example />
            </div>

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
                <button onClick={onUndo} style={{ marginLeft: '10px', color:'#0b7285', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                    撤销
                </button>
                
                <button onClick={onSave} disabled={saving} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: 'none', background: saving ? '#94d3a2' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(22,163,74,0.35)', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? '处理中...' : '开始散养'}
                </button>
                <button onClick={onClear} style={{ marginLeft: '10px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fb7185, #ef4444)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(239,68,68,0.35)', cursor: 'pointer' }}>
                    清空画布
                </button>
                
                {typeof window !== 'undefined' && window.localStorage.getItem('artistName') && (
                    <button onClick={() => router.push('/birds')} style={{ marginLeft: '10px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#7777e5', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(119,119,229,0.35)', cursor: 'pointer' }}>
                        去看鸟
                    </button>
                )}
            </div>
        </div>
    );
}

// 艺术家名字弹窗
const ArtistNameModal = ({ onSave, initialArtistName, loading }: { onSave: (name: string) => void, initialArtistName: string, loading: boolean }) => {
    const [name, setName] = useState(initialArtistName);
    return (
        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.95)', borderRadius: '16px', boxShadow: '0 12px 32px rgba(2,132,199,0.25)', border: '1px solid #d1e9ff', backdropFilter: 'saturate(180%) blur(6px)', minWidth: '360px' }}>
            <h2 style={{ marginTop: 0, color: '#0b7285' }}>填写你的艺术家名字</h2>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="艺术家名字" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #93c5fd', marginTop: '8px', boxSizing: 'border-box' }} />
            <button onClick={() => onSave(name || '匿名')} disabled={loading} style={{ width: '100%', marginTop: '12px', padding: '10px 14px', borderRadius: '8px', border: 'none', background: loading ? '#ccc' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(37,99,235,0.35)', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '提交中...' : '提交'}
            </button>
        </div>
    );
};

export default BirdDrawingPage;
