'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const DrawingHeaderWithExample = () => {
  const [showExample, setShowExample] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭弹框
  useEffect(() => {
    if (!showExample) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowExample(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExample]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0' }}>
      <h1 style={{ margin: 0, color: '#0b7285', fontSize: '24px', fontWeight: 600 }}>
        画出你的小鸟 <span style={{ color: '#ff6565' }}>（方向请朝左）</span>
      </h1>

      <button
        onClick={() => setShowExample(true)}
        className=" text-[#0b7285] font-semibold hover:underline cursor-pointer"
      >
        示例
      </button>

      {showExample && (
        <div
          ref={modalRef}
          style={{
            position: 'absolute',
            top: '240px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px',
            border: '1px solid #d1e9ff',
            borderRadius: '12px',
            backgroundColor: '#fff',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <Image
            src="/example.png"
            alt="示例图片"
            width={400}
            height={400}
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </div>
      )}
    </div>
  );
};

export default DrawingHeaderWithExample;
