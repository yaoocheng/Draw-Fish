'use client';
import React, { useState } from 'react';
import Image from 'next/image';

const DrawingHeaderWithExample = () => {
  const [showExample, setShowExample] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <h2 style={{ margin: 0, color: '#0b7285' }}>画出你的鸟（方向请朝左）</h2>

      <button
        onClick={() => setShowExample(true)}
        style={{
          padding: '4px 10px',
          borderRadius: '8px',
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        简单示例
      </button>

      {showExample && (
        <div
          style={{
            position: 'absolute',
            top: '60px', // 调整弹框位置
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px',
            border: '1px solid #d1e9ff',
            borderRadius: '12px',
            backgroundColor: '#fff',
            zIndex: 100,
          }}
        >
          <Image
            src="/example.png"
            alt="示例图片"
            width={200}
            height={200}
            style={{ display: 'block', maxWidth: '100%' }}
          />
          <button
            onClick={() => setShowExample(false)}
            style={{
              marginTop: '8px',
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
};

export default DrawingHeaderWithExample;
