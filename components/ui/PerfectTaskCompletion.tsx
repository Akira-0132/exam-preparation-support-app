'use client';

import { useEffect, useState } from 'react';

interface PerfectTaskCompletionProps {
  isVisible: boolean;
  onComplete: () => void;
  taskTitle?: string;
  subject?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export default function PerfectTaskCompletion({ 
  isVisible, 
  onComplete, 
  taskTitle = "タスク",
  subject = "科目"
}: PerfectTaskCompletionProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    console.log('[PerfectTaskCompletion] useEffect triggered:', { isVisible, taskTitle, subject });
    if (isVisible) {
      // 金色のパーティクルを生成
      const newParticles: Particle[] = [];
      const colors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347', '#FFDAB9'];
      
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60;
        const velocity = 3 + Math.random() * 4;
        newParticles.push({
          id: i,
          x: 0,
          y: 0,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 80,
          maxLife: 80,
          size: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      
      setParticles(newParticles);
      
      // メッセージを表示
      setTimeout(() => {
        setShowMessage(true);
      }, 300);
      
      // アニメーション終了
      setTimeout(() => {
        setShowMessage(false);
        setTimeout(() => {
          setParticles([]);
          onComplete();
        }, 600);
      }, 6000);
    }
  }, [isVisible, subject, taskTitle]); // onCompleteを依存配列から削除

  useEffect(() => {
    if (particles.length === 0) return;

    const animate = () => {
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.08, // 軽い重力
            life: particle.life - 1
          }))
          .filter(particle => particle.life > 0)
      );
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [particles.length]);
  
  console.log('[PerfectTaskCompletion] Render:', { isVisible, showMessage, particlesCount: particles.length });
  
  if (!isVisible) {
    console.log('[PerfectTaskCompletion] Not visible, returning null');
    return null;
  }

  console.log('[PerfectTaskCompletion] Rendering component');
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 金色のパーティクル */}
      <div className="absolute inset-0">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `calc(50% + ${particle.x}px)`,
              top: `calc(50% + ${particle.y}px)`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              opacity: particle.life / particle.maxLife,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${particle.size * 3}px ${particle.color}`
            }}
          />
        ))}
      </div>

      {/* ねぎらいメッセージ */}
      {showMessage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="bg-white rounded-3xl shadow-2xl p-10 text-center transform transition-all duration-700 ease-out max-w-md mx-4"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
              color: 'white',
              boxShadow: '0 25px 50px -12px rgba(255, 215, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2)'
            }}
          >
            <div className="text-8xl mb-6 animate-bounce">
              ✨
            </div>
            <h2 className="text-3xl font-bold mb-4">
              お疲れ様でした！
            </h2>
            <p className="text-xl mb-2 font-semibold">
              「{taskTitle}」完璧チェック完了
            </p>
            <p className="text-lg mb-6 opacity-90">
              {subject}の準備が整いました！
            </p>
            
            <div className="bg-white bg-opacity-20 rounded-2xl p-6 mb-6">
              <p className="text-lg font-semibold mb-2">
                🎯 テスト直前の最終確認
              </p>
              <p className="text-sm opacity-90 leading-relaxed">
                テスト当日は、すべての問題を<br/>
                もう一度確認してから<br/>
                試験に臨みましょう！
              </p>
            </div>
            
            <div className="text-sm opacity-75">
              頑張ってください！応援しています 💪
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
