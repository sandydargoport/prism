'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Confetti {
  id: number;
  x: number;
  delay: number;
  color: string;
}

export function ShoppingCelebration({ show, onComplete }: { show: boolean; onComplete?: () => void }) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showText, setShowText] = useState(true);
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated without triggering effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (show && !isAnimating) {
      setIsAnimating(true);
      setShowText(true);

      // Generate confetti particles
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
      const particles: Confetti[] = [];
      for (let i = 0; i < 30; i++) {
        particles.push({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)]!,
        });
      }
      setConfetti(particles);

      // Hide text after 2 seconds
      const textTimer = setTimeout(() => {
        setShowText(false);
      }, 2000);

      // End animation after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setConfetti([]);
        onCompleteRef.current?.();
      }, 3000);

      return () => {
        clearTimeout(textTimer);
        clearTimeout(timer);
      };
    }
  }, [show, isAnimating]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Shopping cart with kid */}
      <div className="absolute animate-cart-ride">
        <div className="relative">
          {/* Cart body */}
          <svg viewBox="0 0 120 80" className="w-32 h-20">
            {/* Cart basket */}
            <rect x="20" y="20" width="60" height="35" rx="5" fill="#4A90D9" stroke="#2E5A8C" strokeWidth="2" />
            <rect x="25" y="25" width="50" height="25" rx="3" fill="#6BA5E7" />

            {/* Cart handle */}
            <path d="M80 30 L95 15 L100 15" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Wheels with spin animation */}
            <g className="animate-spin origin-center" style={{ transformOrigin: '35px 60px' }}>
              <circle cx="35" cy="60" r="10" fill="#333" />
              <circle cx="35" cy="60" r="6" fill="#666" />
              <line x1="35" y1="50" x2="35" y2="70" stroke="#999" strokeWidth="2" />
            </g>
            <g className="animate-spin origin-center" style={{ transformOrigin: '70px 60px' }}>
              <circle cx="70" cy="60" r="10" fill="#333" />
              <circle cx="70" cy="60" r="6" fill="#666" />
              <line x1="70" y1="50" x2="70" y2="70" stroke="#999" strokeWidth="2" />
            </g>

            {/* Kid in cart */}
            <circle cx="50" cy="15" r="12" fill="#FFD9B3" /> {/* Head */}
            <circle cx="46" cy="12" r="2" fill="#333" /> {/* Left eye */}
            <circle cx="54" cy="12" r="2" fill="#333" /> {/* Right eye */}
            <path d="M46 18 Q50 22 54 18" stroke="#333" strokeWidth="2" fill="none" /> {/* Smile */}
            <ellipse cx="50" cy="4" rx="10" ry="5" fill="#8B4513" /> {/* Hair */}

            {/* Arms up in excitement */}
            <line x1="40" y1="25" x2="30" y2="10" stroke="#FFD9B3" strokeWidth="4" strokeLinecap="round" />
            <line x1="60" y1="25" x2="70" y2="10" stroke="#FFD9B3" strokeWidth="4" strokeLinecap="round" />
          </svg>

          {/* Confetti exhaust from back */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-exhaust"
                style={{
                  backgroundColor: ['#FF6B6B', '#FFEAA7', '#4ECDC4', '#DDA0DD', '#96CEB4'][i],
                  animationDelay: `${i * 0.1}s`,
                  top: `${(i - 2) * 8}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Confetti particles */}
      {confetti.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 animate-confetti-fall"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}

      {/* Celebration text - fades out after 2 seconds */}
      {showText && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce-in">
          <div className="text-4xl font-bold text-primary drop-shadow-lg bg-background/80 px-6 py-3 rounded-xl">
            🎉 All Done! 🎉
          </div>
        </div>
      )}
    </div>
  );
}
