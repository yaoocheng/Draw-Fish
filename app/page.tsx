"use client";
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';

interface Fish {
    fish_id: number;
    artist_name: string;
    image_data: string;
    created_at: string;
}


// 裁剪 PNG DataURL，去除透明边界，保留内容并加 padding
const cropCanvasToContent = (dataUrl: string, padding = 10): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }
            ctx.drawImage(img, 0, 0);
            const { width, height } = canvas;
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            let minX = width, minY = height, maxX = 0, maxY = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const alpha = data[idx + 3];
                    if (alpha !== 0) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX <= minX || maxY <= minY) {
                resolve(dataUrl);
                return;
            }
            const cropW = maxX - minX + 1;
            const cropH = maxY - minY + 1;
            const destCanvas = document.createElement('canvas');
            destCanvas.width = cropW + padding * 2;
            destCanvas.height = cropH + padding * 2;
            const destCtx = destCanvas.getContext('2d');
            if (!destCtx) {
                resolve(dataUrl);
                return;
            }
            destCtx.drawImage(canvas, minX, minY, cropW, cropH, padding, padding, cropW, cropH);
            resolve(destCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

const cropSvg = (svgString: string, padding = 10): Promise<string> => {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        div.innerHTML = svgString;
        const svg = div.querySelector('svg');
        if (!svg) {
            resolve(svgString);
            return;
        }

        const paths = svg.querySelectorAll('path');
        if (paths.length === 0) {
            resolve(svgString);
            return;
        }

        svg.style.visibility = 'hidden';
        document.body.appendChild(svg);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        paths.forEach(path => {
            const bbox = path.getBBox();
            if (bbox.x < minX) minX = bbox.x;
            if (bbox.y < minY) minY = bbox.y;
            if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
            if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
        });

        document.body.removeChild(svg);

        const width = maxX - minX;
        const height = maxY - minY;

        if (width <= 0 || height <= 0) {
            resolve(svgString);
            return;
        }

        const viewBox = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('width', (width + padding * 2).toString());
        svg.setAttribute('height', (height + padding * 2).toString());

        resolve(svg.outerHTML);
    });
};


const FishTankComponent = () => {
    // const [fishes, setFishes] = useState<Fish[]>(() => {
    //     if (typeof window === 'undefined') return [];
    //     try {
    //         const savedFishes = JSON.parse(window.localStorage.getItem('fishes') || '[]') as Fish[];
    //         return savedFishes;
    //     } catch (e) {
    //         return [];
    //     }
    // });

    const [view, setView] = useState<'drawing' | 'artistName'>(() => 'drawing');

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
        const storedUserId = window.localStorage.getItem('userId');
        return storedUserId ? parseInt(storedUserId, 10) : null;
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false); // 控制“保存小鱼”按钮的加载态（导出/提交全过程）

    // 不再根据本地 artistName 自动跳转到 /view，避免从“返回画鱼”立刻跳回鱼缸。

    const saveFish = async (name?: string) => {
        if (loading || saving) return;
        setSaving(true);

        const exportCurrent = async (): Promise<string | null> => {
            try {
                if (!canvasRef.current) return null;
                const pngDataUrl = await canvasRef.current.exportImage('png');
                const cropped = await cropCanvasToContent(pngDataUrl);
                return cropped || pngDataUrl;
            } catch (e) {
                console.error('Export drawing failed:', e);
                return null;
            }
        };

        const artist = (name ?? '').trim() || artistName.trim();

        // 若还没有艺术家名：先导出并缓存图片，再弹出命名弹窗
        if (!artist) {
            const dataUrl = await exportCurrent();
            if (dataUrl) setCurrentDrawingDataUrl(dataUrl);
            setView('artistName');
            setSaving(false);
            return;
        }

        // 已有艺术家名：确保拿到最新的导出图片（不要依赖旧 state）
        let dataUrl = currentDrawingDataUrl;
        if (!dataUrl) {
            dataUrl = await exportCurrent();
        }
        if (!dataUrl) {
            console.error("No drawing to save. Please draw something first.");
            setSaving(false);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/fish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    artist_name: artist,
                    image_data: dataUrl,
                    userId,
                }),
            });

            if (res.ok) {
                const result = await res.json();

                // 存储用户信息
                localStorage.setItem('artistName', artist);
                if (result.userId) {
                    localStorage.setItem('userId', result.userId.toString());
                    setUserId(result.userId);
                }
                setArtistName(artist);

                // 同步最新鱼列表
                // try {
                //     const listRes = await fetch('/api/fishes');
                //     if (listRes.ok) {
                //         const serverFishes = await listRes.json();
                //         // setFishes(serverFishes);
                //         // localStorage.setItem('fishes', JSON.stringify(serverFishes));
                //     }
                // } catch (e) {
                //     console.error('Failed to refresh fishes list:', e);
                // }

                router.push('/view');
            } else {
                console.error('Failed to save fish');
            }
        } catch (error) {
            console.error('Error saving fish:', error);
        } finally {
            setLoading(false);
            setCurrentDrawingDataUrl(null);
            setSaving(false);
        }
    };

    const handleClear = () => {
        if (canvasRef.current) {
            canvasRef.current.clearCanvas();
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #b3e5fc 0%, #e1f5fe 100%)' }}>
            {view === 'drawing' && (
                <DrawingCanvas
                    canvasRef={canvasRef}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushRadius={brushRadius}
                    setBrushRadius={setBrushRadius}
                    saving={saving}
                    onSave={() => saveFish()} // Call without a name to trigger the modal
                    onClear={handleClear}
                />
            )}
            {view === 'artistName' && <ArtistNameModal onSave={saveFish} initialArtistName={artistName} loading={loading} />}
        </div>
    );
};

// Sub-components
const DrawingCanvas = ({ canvasRef, brushColor, setBrushColor, brushRadius, setBrushRadius, onSave, onClear, saving }: { canvasRef: React.RefObject<ReactSketchCanvasRef | null>, brushColor: string, setBrushColor: (color: string) => void, brushRadius: number, setBrushRadius: (radius: number) => void, onSave: () => void, onClear: () => void, saving: boolean }) => {
    const router = useRouter();

    return (
        <div style={{ border: '1px solid #d1e9ff', borderRadius: '16px', padding: '16px', background: 'rgba(255,255,255,0.88)', boxShadow: '0 12px 32px rgba(2,132,199,0.25)', backdropFilter: 'saturate(180%) blur(6px)', maxWidth: '1040px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <h2 style={{ margin: '0', color: '#0b7285' }}>画出你的小鱼（方向请朝右）</h2>

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
                <button onClick={onSave} disabled={saving} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: 'none', background: saving ? '#94d3a2' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(22,163,74,0.35)', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '处理中...' : '扔进鱼缸'}</button>
                <button onClick={onClear} style={{ marginLeft: '10px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fb7185, #ef4444)', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(239,68,68,0.35)', cursor: 'pointer' }}>清空画布</button>

                {
                    window.localStorage.getItem('artistName') && (
                        <button onClick={() => router.push('/view')} style={{ marginLeft: '10px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#7777e5', color: '#fff', fontWeight: 600, boxShadow: '0 6px 16px rgba(239,68,68,0.35)', cursor: 'pointer' }}>去鱼缸</button>
                    )
                }
            </div>
        </div >
    );
}

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

export default FishTankComponent;