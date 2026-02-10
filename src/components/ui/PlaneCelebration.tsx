'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export function PlaneCelebration({
  show,
  userName,
  onComplete
}: {
  show: boolean;
  userName: string;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated to avoid stale closure issues
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleAnimationEnd = useCallback(() => {
    setVisible(false);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (show && !visible) {
      setVisible(true);

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // End animation after 5 seconds (matches CSS animation duration)
      timerRef.current = setTimeout(handleAnimationEnd, 5000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, visible, handleAnimationEnd]);

  // Reset when show goes back to false (parent state cleared)
  useEffect(() => {
    if (!show && visible) {
      // Clear timer and reset state immediately
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
    }
  }, [show, visible]);

  if (!visible) return null;

  const message = `Way to go, ${userName}!`;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Animated plane with trailing banner */}
      <div className="absolute animate-plane-fly">
        <div className="relative flex items-center flex-row-reverse">
          {/* Prop Plane (now first due to flex-row-reverse, appears on right/front) */}
          <svg viewBox="0 0 120 60" className="w-24 h-12">
            {/* Fuselage */}
            <ellipse cx="60" cy="30" rx="35" ry="12" fill="#E53935" />
            <ellipse cx="60" cy="30" rx="32" ry="10" fill="#EF5350" />

            {/* Cockpit */}
            <ellipse cx="85" cy="28" rx="10" ry="8" fill="#42A5F5" opacity="0.8" />
            <ellipse cx="85" cy="28" rx="8" ry="6" fill="#90CAF9" opacity="0.6" />

            {/* Wings */}
            <path d="M45 30 L35 10 L75 10 L65 30" fill="#C62828" />
            <path d="M45 30 L35 50 L75 50 L65 30" fill="#C62828" />

            {/* Tail */}
            <path d="M25 30 L15 15 L30 30" fill="#C62828" />
            <path d="M25 30 L20 25 L30 25 L30 30" fill="#B71C1C" />

            {/* Propeller hub */}
            <circle cx="95" cy="30" r="4" fill="#424242" />

            {/* Spinning propeller */}
            <g className="origin-center animate-spin-fast" style={{ transformOrigin: '95px 30px' }}>
              <ellipse cx="95" cy="30" rx="2" ry="15" fill="#757575" />
              <ellipse cx="95" cy="30" rx="15" ry="2" fill="#757575" />
            </g>

            {/* Wheels */}
            <circle cx="50" cy="45" r="4" fill="#424242" />
            <circle cx="70" cy="45" r="4" fill="#424242" />
            <line x1="50" y1="41" x2="50" y2="38" stroke="#424242" strokeWidth="2" />
            <line x1="70" y1="41" x2="70" y2="38" stroke="#424242" strokeWidth="2" />
          </svg>

          {/* Rope connecting plane to banner */}
          <svg viewBox="0 0 40 20" className="w-10 h-5 -mx-1">
            <path
              d="M0 10 Q10 5 20 10 Q30 15 40 10"
              fill="none"
              stroke="#8B4513"
              strokeWidth="2"
            />
          </svg>

          {/* Trailing Banner (now last due to flex-row-reverse, appears on left/behind) */}
          <div className="relative -mr-1">
            <svg viewBox="0 0 300 60" className="h-14 w-auto">
              {/* Banner body with wave effect */}
              <path
                d="M0 15 Q20 10 40 15 L280 15 Q290 15 295 20 L295 40 Q290 45 280 45 L40 45 Q20 50 0 45 Z"
                fill="#FFD54F"
                stroke="#FFA000"
                strokeWidth="2"
              />
              {/* Banner tail triangles (on left side now since banner trails) */}
              <polygon points="0,15 -15,30 0,45" fill="#FFD54F" stroke="#FFA000" strokeWidth="2" />

              {/* Banner text */}
              <text
                x="150"
                y="35"
                textAnchor="middle"
                className="text-lg font-bold fill-amber-900"
                style={{ fontSize: '16px', fontFamily: 'system-ui' }}
              >
                {message}
              </text>
            </svg>

            {/* Banner shadow/depth */}
            <div className="absolute inset-0 -z-10 translate-y-1 opacity-20">
              <svg viewBox="0 0 300 60" className="h-14 w-auto">
                <path
                  d="M0 15 Q20 10 40 15 L280 15 Q290 15 295 20 L295 40 Q290 45 280 45 L40 45 Q20 50 0 45 Z"
                  fill="#000"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
