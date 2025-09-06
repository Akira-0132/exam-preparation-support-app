'use client';

import { useEffect, useState, useMemo } from 'react';

interface CompletionCelebrationProps {
  isVisible: boolean;
  onComplete: () => void;
  taskTitle?: string;
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

export default function CompletionCelebration({ 
  isVisible, 
  onComplete, 
  taskTitle = "タスク" 
}: CompletionCelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [selectedEncouragement, setSelectedEncouragement] = useState<string>('');

  const encouragements = useMemo(() => [
    "🎉 お疲れ様！",
    "✨ 素晴らしい！",
    "🌟 よく頑張りました！",
    "🎊 完璧です！",
    "💫 すごいですね！",
    "🎈 おめでとう！",
    "⭐ 最高です！",
    "🌈 頑張りましたね！"
  ], []);

  useEffect(() => {
    console.log('[CompletionCelebration] isVisible changed:', isVisible);
    if (isVisible) {
      console.log('[CompletionCelebration] Starting celebration effect');
      
      // 励ましメッセージを1つ固定選択
      const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
      setSelectedEncouragement(randomEncouragement);
      
      // パーティクルを生成
      const newParticles: Particle[] = [];
      const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
      
      for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 * i) / 50;
        const velocity = 2 + Math.random() * 3;
        newParticles.push({
          id: i,
          x: 0,
          y: 0,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 60,
          maxLife: 60,
          size: 3 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      
      console.log('[CompletionCelebration] Generated particles:', newParticles.length);
      setParticles(newParticles);
      
      // メッセージを表示
      setTimeout(() => {
        console.log('[CompletionCelebration] Showing message');
        setShowMessage(true);
      }, 200);
      
      // アニメーション終了
      setTimeout(() => {
        console.log('[CompletionCelebration] Hiding message');
        setShowMessage(false);
        setTimeout(() => {
          console.log('[CompletionCelebration] Clearing particles and calling onComplete');
          setParticles([]);
          setSelectedEncouragement('');
          onComplete();
        }, 500);
      }, 4000);
    }
  }, [isVisible, encouragements]); // onCompleteを依存配列から削除

  useEffect(() => {
    if (particles.length === 0) return;

    const animate = () => {
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.1, // 重力
            life: particle.life - 1
          }))
          .filter(particle => particle.life > 0)
      );
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  console.log('[CompletionCelebration] Render - isVisible:', isVisible, 'particles:', particles.length, 'showMessage:', showMessage);
  
  if (!isVisible) return null;


  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* パーティクル */}
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
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
            }}
          />
        ))}
      </div>

      {/* 励ましメッセージ */}
      {showMessage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 text-center transform transition-all duration-500 ease-out"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
            <div className="text-6xl mb-4 animate-bounce">
              {selectedEncouragement.split(' ')[0]}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {selectedEncouragement.split(' ').slice(1).join(' ')}
            </h2>
            <p className="text-lg opacity-90">
              「{taskTitle}」を完了しました！
            </p>
            <div className="mt-4 text-sm opacity-75">
              お疲れ様でした 🎊
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
