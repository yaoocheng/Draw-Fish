'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InferSelectModel } from 'drizzle-orm';
import { fishes } from '@/lib/schema';

type BirdData = InferSelectModel<typeof fishes>;

const BirdCard = ({ bird, onVote }: { bird: BirdData; onVote: (id: number, action: 'like' | 'dislike') => void }) => {
    const [likeHover, setLikeHover] = useState(false);
    const [dislikeHover, setDislikeHover] = useState(false);

    return (
        <div style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '16px',
            background: '#ffffff',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%'
        }}>
            <img src={bird.image_data} alt={bird.artist_name} style={{ width: '100%', height: '150px', objectFit: 'contain', borderRadius: '4px' }} />
            <h3 style={{ margin: '12px 0', fontWeight: '600', color: '#333', fontSize: '1.1rem' }}>{bird.artist_name}</h3>
            <p style={{ margin: '0 0 10px', color: '#666', fontSize: '0.9rem' }}>
                {
                    new Date(bird.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                }
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '12px' }}>
                <button
                    onClick={() => onVote(bird.fish_id, 'like')}
                    onMouseEnter={() => setLikeHover(true)}
                    onMouseLeave={() => setLikeHover(false)}
                    style={{
                        fontWeight: '600',
                        background: likeHover ? '#d4edda' : '#fff',
                        border: likeHover ? '1px solid #28a745' : '1px solid #f0f0f0',
                        borderRadius: '5px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    👍 {bird.likes}
                </button>
                <button
                    onClick={() => onVote(bird.fish_id, 'dislike')}
                    onMouseEnter={() => setDislikeHover(true)}
                    onMouseLeave={() => setDislikeHover(false)}
                    style={{
                        fontWeight: '600',
                        background: dislikeHover ? '#f8d7da' : '#fff',
                        border: dislikeHover ? '1px solid #dc3545' : '1px solid #f0f0f0',
                        borderRadius: '5px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    👎 {bird.dislikes}
                </button>
            </div>
        </div>
    );
};

const RankPage = () => {
    const [birds, setBirds] = useState<BirdData[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const handleVote = async (id: number, action: 'like' | 'dislike') => {
        try {
            const res = await fetch('/api/fishes/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fish_id: id, action }),
            });
            if (res.ok) {
                const updatedBird = await res.json();
                setBirds(birds.map(b => b.fish_id === id ? { ...b, likes: updatedBird.likes, dislikes: updatedBird.dislikes } : b));
            }
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    useEffect(() => {
        const fetchBirds = async () => {
            try {
                const res = await fetch('/api/fishes');
                if (!res.ok) throw new Error('Failed to fetch birds');
                const data: BirdData[] = await res.json();
                const sortedData = data.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 25);
                setBirds(sortedData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBirds();
    }, []);

    return (
        <div style={{ padding: '20px', background: '#f0f9ff', minHeight: '100vh' }}>
            <button
                onClick={() => router.push('/')}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    background: '#0c4a6e',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}
            >
                返回作画
            </button>
            <h1 style={{
                textAlign: 'center',
                color: '#0c4a6e',
                marginBottom: '40px',
                fontSize: '2.5rem',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
            }}>
                🏆 小鸟排行榜 🏆
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {birds.map(bird => (
                    <BirdCard key={bird.fish_id} bird={bird} onVote={handleVote} />
                ))}
            </div>
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
        </div>
    );
};

export default RankPage;