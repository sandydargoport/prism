'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useShouldSkipMotion } from '@/lib/hooks/useShouldSkipMotion';

/**
 * Check if today falls within a date window (inclusive).
 * month is 0-indexed, day is 1-indexed.
 */
function isInWindow(startMonth: number, startDay: number, endMonth: number, endDay: number): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, startMonth, startDay);
  const end = new Date(year, endMonth, endDay, 23, 59, 59);
  return now >= start && now <= end;
}

/**
 * Get Easter Sunday for a given year (Anonymous Gregorian algorithm).
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Check if today is within ±3 days of Easter.
 */
function isEasterWeek(): boolean {
  const now = new Date();
  const easter = getEasterDate(now.getFullYear());
  const start = new Date(easter);
  start.setDate(start.getDate() - 3);
  const end = new Date(easter);
  end.setDate(end.getDate() + 3);
  end.setHours(23, 59, 59);
  return now >= start && now <= end;
}

/**
 * US Thanksgiving: 4th Thursday of November.
 */
function getThanksgivingDate(year: number): Date {
  const nov1 = new Date(year, 10, 1); // Nov 1
  const dayOfWeek = nov1.getDay(); // 0=Sun
  const firstThursday = dayOfWeek <= 4 ? (4 - dayOfWeek + 1) : (11 - dayOfWeek + 4 + 1);
  return new Date(year, 10, firstThursday + 21); // 4th Thursday = first + 21
}

function isThanksgivingWeek(): boolean {
  const now = new Date();
  const tg = getThanksgivingDate(now.getFullYear());
  const start = new Date(tg);
  start.setDate(start.getDate() - 3);
  const end = new Date(tg);
  end.setDate(end.getDate() + 3);
  end.setHours(23, 59, 59);
  return now >= start && now <= end;
}

/**
 * Determine the active holiday (if any) based on the current date.
 * Returns a key or null. Checked in priority order.
 */
function getActiveHoliday(): string | null {
  // Valentine's Day: Feb 11-17
  if (isInWindow(1, 11, 1, 17)) return 'valentines';
  // St. Patrick's Day: Mar 14-20
  if (isInWindow(2, 14, 2, 20)) return 'stpatricks';
  // Easter: ±3 days (moves each year)
  if (isEasterWeek()) return 'easter';
  // Mother's Day week: May 8-14 (second Sunday is between 8-14)
  if (isInWindow(4, 8, 4, 14)) return 'spring';
  // Memorial Day / late May: May 24-31
  if (isInWindow(4, 24, 4, 31)) return 'memorial';
  // Independence Day: Jun 30 - Jul 7
  if (isInWindow(5, 30, 6, 7)) return 'july4th';
  // Halloween: Oct 25 - Nov 1
  if (isInWindow(9, 25, 10, 1)) return 'halloween';
  // Thanksgiving: ±3 days
  if (isThanksgivingWeek()) return 'thanksgiving';
  // Christmas/Holiday: Dec 18-31
  if (isInWindow(11, 18, 11, 31)) return 'christmas';
  // New Year's: Jan 1-3
  if (isInWindow(0, 1, 0, 3)) return 'newyear';
  return null;
}

// ---------- Scene builders ----------

function valentinesScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Floating hearts */}
      <g className="animate-bounce" style={{ animationDuration: '2s', animationDelay: '0s' }}>
        <path d="M80 120 C80 100 60 80 40 100 C20 120 40 150 80 170 C120 150 140 120 120 100 C100 80 80 100 80 120Z" fill="#F43F5E" opacity="0.8" />
      </g>
      <g className="animate-bounce" style={{ animationDuration: '2.3s', animationDelay: '0.3s' }}>
        <path d="M320 100 C320 80 300 60 280 80 C260 100 280 130 320 150 C360 130 380 100 360 80 C340 60 320 80 320 100Z" fill="#EC4899" opacity="0.7" />
      </g>
      <g className="animate-bounce" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }}>
        <path d="M200 80 C200 55 175 35 150 60 C125 85 150 120 200 150 C250 120 275 85 250 60 C225 35 200 55 200 80Z" fill="#E11D48" />
      </g>
      {/* Small hearts */}
      <path d="M140 200 C140 192 133 186 126 192 C119 198 126 208 140 216 C154 208 161 198 154 192 C147 186 140 192 140 200Z" fill="#FB7185" className="animate-ping" style={{ animationDuration: '2s' }} />
      <path d="M270 190 C270 182 263 176 256 182 C249 188 256 198 270 206 C284 198 291 188 284 182 C277 176 270 182 270 190Z" fill="#FDA4AF" className="animate-ping" style={{ animationDuration: '2.5s' }} />
      {/* Sparkles */}
      <circle cx="100" cy="180" r="2" fill="#FFD700" className="animate-ping" style={{ animationDuration: '1.8s' }} />
      <circle cx="300" cy="170" r="2.5" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2.2s' }} />
    </svg>
  );
}

function stpatricksScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Rainbow background arc */}
      <path d="M0 280 Q100 50 200 100 Q300 50 400 280" fill="none" stroke="#EF4444" strokeWidth="8" opacity="0.3" />
      <path d="M10 280 Q110 60 200 110 Q290 60 390 280" fill="none" stroke="#F97316" strokeWidth="8" opacity="0.3" />
      <path d="M20 280 Q120 70 200 120 Q280 70 380 280" fill="none" stroke="#EAB308" strokeWidth="8" opacity="0.3" />
      <path d="M30 280 Q130 80 200 130 Q270 80 370 280" fill="none" stroke="#22C55E" strokeWidth="8" opacity="0.3" />
      {/* Pot of gold */}
      <ellipse cx="200" cy="240" rx="55" ry="15" fill="#1a1a1a" />
      <path d="M150 240 Q145 190 155 170 L245 170 Q255 190 250 240 Z" fill="#292929" />
      <path d="M155 170 L245 170" stroke="#444" strokeWidth="4" />
      <circle cx="180" cy="165" r="12" fill="#FFD700" className="animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.5s' }} />
      <circle cx="200" cy="158" r="14" fill="#FFC107" className="animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.5s' }} />
      <circle cx="220" cy="163" r="12" fill="#FFD700" className="animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.5s' }} />
      <circle cx="190" cy="175" r="10" fill="#FFAB00" />
      <circle cx="210" cy="175" r="10" fill="#FFD700" />
      <text x="200" y="163" textAnchor="middle" fill="#8B6914" style={{ fontSize: '10px', fontWeight: 'bold' }}>$</text>
      {/* Leprechaun */}
      <g className="animate-wiggle" style={{ transformOrigin: '320px 200px' }}>
        <rect x="300" y="200" width="40" height="50" rx="8" fill="#22C55E" />
        <circle cx="320" cy="185" r="20" fill="#FBBF24" />
        <rect x="302" y="155" width="36" height="22" rx="3" fill="#16A34A" />
        <rect x="295" y="173" width="50" height="6" rx="2" fill="#16A34A" />
        <rect x="312" y="160" width="16" height="4" rx="1" fill="#FFD700" />
        <circle cx="313" cy="183" r="2.5" fill="#1a1a1a" />
        <circle cx="327" cy="183" r="2.5" fill="#1a1a1a" />
        <path d="M308 192 Q320 208 332 192" fill="#CD853F" />
        <path d="M312 193 Q320 199 328 193" fill="none" stroke="#1a1a1a" strokeWidth="1.5" />
        <path d="M300 215 L260 210" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" />
        <circle cx="258" cy="210" r="6" fill="#FBBF24" />
      </g>
      <circle cx="170" cy="140" r="3" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="230" cy="130" r="2" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2.5s' }} />
    </svg>
  );
}

function easterScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <rect x="0" y="250" width="400" height="50" fill="#4ADE80" rx="8" opacity="0.3" />
      <ellipse cx="80" cy="245" rx="18" ry="24" fill="#EC4899" className="animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '2s' }} />
      <path d="M68 235 Q80 230 92 235" fill="none" stroke="#F472B6" strokeWidth="2" />
      <path d="M68 245 Q80 240 92 245" fill="none" stroke="#F472B6" strokeWidth="2" />
      <ellipse cx="150" cy="248" rx="16" ry="22" fill="#60A5FA" className="animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
      <circle cx="145" cy="240" r="3" fill="#93C5FD" /><circle cx="155" cy="248" r="3" fill="#93C5FD" /><circle cx="148" cy="256" r="3" fill="#93C5FD" />
      <ellipse cx="320" cy="246" rx="17" ry="23" fill="#FBBF24" className="animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2s' }} />
      <line x1="308" y1="240" x2="332" y2="240" stroke="#FCD34D" strokeWidth="2" />
      <line x1="308" y1="252" x2="332" y2="252" stroke="#FCD34D" strokeWidth="2" />
      <g className="animate-wiggle" style={{ transformOrigin: '220px 200px' }}>
        <ellipse cx="220" cy="220" rx="35" ry="40" fill="white" />
        <ellipse cx="220" cy="228" rx="22" ry="25" fill="#F5F5F5" />
        <circle cx="220" cy="165" r="28" fill="white" />
        <ellipse cx="200" cy="115" rx="12" ry="40" fill="white" /><ellipse cx="200" cy="115" rx="7" ry="32" fill="#FBCFE8" />
        <ellipse cx="240" cy="120" rx="12" ry="38" fill="white" /><ellipse cx="240" cy="120" rx="7" ry="30" fill="#FBCFE8" />
        <circle cx="210" cy="160" r="4" fill="#1a1a1a" /><circle cx="230" cy="160" r="4" fill="#1a1a1a" />
        <circle cx="211" cy="158" r="1.5" fill="white" /><circle cx="231" cy="158" r="1.5" fill="white" />
        <ellipse cx="220" cy="170" rx="4" ry="3" fill="#FBCFE8" />
        <path d="M215 174 Q220 179 225 174" fill="none" stroke="#ccc" strokeWidth="1" />
        <line x1="195" y1="168" x2="210" y2="170" stroke="#ddd" strokeWidth="1" />
        <line x1="195" y1="173" x2="210" y2="173" stroke="#ddd" strokeWidth="1" />
        <line x1="245" y1="168" x2="230" y2="170" stroke="#ddd" strokeWidth="1" />
        <line x1="245" y1="173" x2="230" y2="173" stroke="#ddd" strokeWidth="1" />
        <ellipse cx="200" cy="262" rx="15" ry="8" fill="white" />
        <ellipse cx="240" cy="262" rx="15" ry="8" fill="white" />
        <path d="M250 210 Q270 190 280 210 L275 240 Q265 250 255 240 Z" fill="#D2691E" />
        <path d="M255 195 Q267 180 280 195" fill="none" stroke="#8B4513" strokeWidth="3" />
        <ellipse cx="267" cy="225" rx="8" ry="11" fill="#A78BFA" />
      </g>
      <text x="100" y="200" style={{ fontSize: '20px' }} className="animate-ping">&#10024;</text>
      <text x="300" y="180" style={{ fontSize: '16px' }} className="animate-ping">&#10024;</text>
    </svg>
  );
}

function springScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Sun */}
      <circle cx="320" cy="60" r="30" fill="#FBBF24" opacity="0.6" className="animate-pulse" />
      {/* Flowers */}
      <g className="animate-wiggle" style={{ transformOrigin: '120px 200px' }}>
        <line x1="120" y1="200" x2="120" y2="270" stroke="#22C55E" strokeWidth="4" />
        <circle cx="120" cy="190" r="18" fill="#F472B6" /><circle cx="120" cy="190" r="8" fill="#FBBF24" />
        <circle cx="103" cy="190" r="10" fill="#EC4899" /><circle cx="137" cy="190" r="10" fill="#EC4899" />
        <circle cx="120" cy="175" r="10" fill="#EC4899" /><circle cx="120" cy="205" r="10" fill="#EC4899" />
      </g>
      <g className="animate-wiggle" style={{ transformOrigin: '200px 180px', animationDelay: '0.3s' }}>
        <line x1="200" y1="180" x2="200" y2="270" stroke="#22C55E" strokeWidth="4" />
        <circle cx="200" cy="170" r="20" fill="#A78BFA" /><circle cx="200" cy="170" r="9" fill="#FCD34D" />
        <circle cx="181" cy="170" r="11" fill="#8B5CF6" /><circle cx="219" cy="170" r="11" fill="#8B5CF6" />
        <circle cx="200" cy="153" r="11" fill="#8B5CF6" /><circle cx="200" cy="187" r="11" fill="#8B5CF6" />
      </g>
      <g className="animate-wiggle" style={{ transformOrigin: '280px 210px', animationDelay: '0.6s' }}>
        <line x1="280" y1="210" x2="280" y2="270" stroke="#22C55E" strokeWidth="4" />
        <circle cx="280" cy="200" r="16" fill="#60A5FA" /><circle cx="280" cy="200" r="7" fill="#FBBF24" />
        <circle cx="265" cy="200" r="9" fill="#3B82F6" /><circle cx="295" cy="200" r="9" fill="#3B82F6" />
        <circle cx="280" cy="187" r="9" fill="#3B82F6" /><circle cx="280" cy="213" r="9" fill="#3B82F6" />
      </g>
      {/* Butterflies */}
      <g className="animate-float" style={{ animationDuration: '3s' }}>
        <ellipse cx="160" cy="100" rx="12" ry="8" fill="#F59E0B" opacity="0.8" transform="rotate(-20 160 100)" />
        <ellipse cx="175" cy="100" rx="12" ry="8" fill="#F59E0B" opacity="0.8" transform="rotate(20 175 100)" />
        <line x1="167" y1="95" x2="167" y2="108" stroke="#92400E" strokeWidth="1.5" />
      </g>
      <rect x="0" y="265" width="400" height="35" fill="#4ADE80" rx="6" opacity="0.3" />
    </svg>
  );
}

function memorialScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Flags */}
      <g className="animate-wiggle" style={{ transformOrigin: '130px 150px' }}>
        <line x1="130" y1="80" x2="130" y2="260" stroke="#78716C" strokeWidth="4" />
        <rect x="134" y="80" width="60" height="40" fill="#EF4444" />
        <rect x="134" y="80" width="60" height="13" fill="#EF4444" /><rect x="134" y="93" width="60" height="3" fill="white" />
        <rect x="134" y="96" width="60" height="10" fill="#EF4444" /><rect x="134" y="106" width="60" height="3" fill="white" />
        <rect x="134" y="109" width="60" height="11" fill="#EF4444" />
        <rect x="134" y="80" width="22" height="22" fill="#3B82F6" />
        <text x="145" y="96" fill="white" style={{ fontSize: '10px' }}>&#9733;</text>
      </g>
      <g className="animate-wiggle" style={{ transformOrigin: '270px 150px', animationDelay: '0.5s' }}>
        <line x1="270" y1="80" x2="270" y2="260" stroke="#78716C" strokeWidth="4" />
        <rect x="274" y="80" width="60" height="40" fill="#EF4444" />
        <rect x="274" y="80" width="60" height="13" fill="#EF4444" /><rect x="274" y="93" width="60" height="3" fill="white" />
        <rect x="274" y="96" width="60" height="10" fill="#EF4444" /><rect x="274" y="106" width="60" height="3" fill="white" />
        <rect x="274" y="109" width="60" height="11" fill="#EF4444" />
        <rect x="274" y="80" width="22" height="22" fill="#3B82F6" />
        <text x="285" y="96" fill="white" style={{ fontSize: '10px' }}>&#9733;</text>
      </g>
      {/* Stars */}
      <text x="195" y="100" textAnchor="middle" fill="#3B82F6" style={{ fontSize: '40px' }} className="animate-pulse">&#9733;</text>
      <text x="100" y="160" fill="#EF4444" style={{ fontSize: '20px' }} className="animate-pulse">&#9733;</text>
      <text x="300" y="170" fill="#EF4444" style={{ fontSize: '18px' }} className="animate-pulse">&#9733;</text>
    </svg>
  );
}

function july4thScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <text x="50" y="60" style={{ fontSize: '24px' }} fill="#3B82F6" className="animate-pulse">&#9733;</text>
      <text x="350" y="80" style={{ fontSize: '20px' }} fill="#EF4444" className="animate-pulse">&#9733;</text>
      <text x="180" y="40" style={{ fontSize: '18px' }} fill="#3B82F6" className="animate-pulse">&#9733;</text>
      <text x="300" y="50" style={{ fontSize: '22px' }} fill="#EF4444" className="animate-pulse">&#9733;</text>
      <g className="animate-wiggle" style={{ transformOrigin: '200px 160px' }}>
        <ellipse cx="200" cy="180" rx="30" ry="40" fill="#4A3728" />
        <circle cx="200" cy="130" r="22" fill="white" />
        <path d="M215 130 L235 138 L215 140 Z" fill="#F59E0B" />
        <circle cx="210" cy="128" r="4" fill="#1a1a1a" /><circle cx="210" cy="127" r="1.5" fill="white" />
        <path d="M170 170 Q120 120 60 140 Q100 155 130 160 Q150 165 170 175 Z" fill="#5D4037" />
        <path d="M230 170 Q280 120 340 140 Q300 155 270 160 Q250 165 230 175 Z" fill="#5D4037" />
        <path d="M60 140 Q80 145 100 148" fill="none" stroke="#3E2723" strokeWidth="2" />
        <path d="M340 140 Q320 145 300 148" fill="none" stroke="#3E2723" strokeWidth="2" />
        <path d="M185 215 Q200 250 215 215" fill="white" />
        <path d="M190 218 L185 235 M190 218 L195 235" stroke="#F59E0B" strokeWidth="2" />
        <path d="M210 218 L205 235 M210 218 L215 235" stroke="#F59E0B" strokeWidth="2" />
      </g>
      <rect x="100" y="255" width="200" height="30" rx="4" fill="#EF4444" />
      <rect x="100" y="255" width="200" height="10" fill="#3B82F6" />
      <rect x="100" y="270" width="200" height="5" fill="white" />
      <circle cx="80" cy="100" r="4" fill="#EF4444" className="animate-ping" style={{ animationDuration: '1.5s' }} />
      <circle cx="320" cy="90" r="3" fill="#3B82F6" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="60" cy="70" r="2" fill="#FFD700" className="animate-ping" style={{ animationDuration: '1.8s' }} />
      <circle cx="340" cy="60" r="2.5" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2.2s' }} />
    </svg>
  );
}

function halloweenScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Moon */}
      <circle cx="320" cy="60" r="35" fill="#FCD34D" opacity="0.4" />
      <circle cx="330" cy="55" r="30" fill="#1a1a1a" opacity="0.3" />
      {/* Pumpkin */}
      <g className="animate-wiggle" style={{ transformOrigin: '200px 200px' }}>
        <ellipse cx="200" cy="210" rx="65" ry="55" fill="#F97316" />
        <ellipse cx="175" cy="210" rx="30" ry="50" fill="#EA580C" opacity="0.5" />
        <ellipse cx="225" cy="210" rx="30" ry="50" fill="#EA580C" opacity="0.5" />
        {/* Stem */}
        <rect x="192" y="155" width="16" height="18" rx="4" fill="#16A34A" />
        {/* Face */}
        <path d="M170 195 L180 210 L160 210 Z" fill="#1a1a1a" />
        <path d="M230 195 L240 210 L220 210 Z" fill="#1a1a1a" />
        <path d="M175 230 Q200 250 225 230 Q210 240 200 238 Q190 240 175 230 Z" fill="#1a1a1a" />
        {/* Glow from eyes */}
        <circle cx="173" cy="203" r="8" fill="#FBBF24" opacity="0.2" />
        <circle cx="233" cy="203" r="8" fill="#FBBF24" opacity="0.2" />
      </g>
      {/* Bats */}
      <g className="animate-float" style={{ animationDuration: '2.5s' }}>
        <path d="M80 80 Q70 70 60 80 Q70 75 80 80 Q90 75 100 80 Q90 70 80 80Z" fill="#1a1a1a" />
      </g>
      <g className="animate-float" style={{ animationDuration: '3s', animationDelay: '0.5s' }}>
        <path d="M300 100 Q290 90 280 100 Q290 95 300 100 Q310 95 320 100 Q310 90 300 100Z" fill="#1a1a1a" />
      </g>
      {/* Stars */}
      <circle cx="100" cy="40" r="2" fill="#FCD34D" className="animate-pulse" />
      <circle cx="250" cy="35" r="1.5" fill="#FCD34D" className="animate-pulse" />
      <circle cx="150" cy="55" r="1" fill="#FCD34D" className="animate-pulse" />
    </svg>
  );
}

function thanksgivingScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Cornucopia / Horn of plenty */}
      <g className="animate-wiggle" style={{ transformOrigin: '200px 200px' }}>
        <path d="M120 240 Q100 200 130 170 Q160 140 220 150 L280 180 Q240 200 200 220 Q160 240 120 240Z" fill="#D2691E" />
        <path d="M130 235 Q115 200 140 175 Q165 150 215 158" fill="none" stroke="#8B4513" strokeWidth="3" opacity="0.5" />
        {/* Fruits spilling out */}
        <circle cx="240" cy="160" r="18" fill="#EF4444" className="animate-bounce" style={{ animationDelay: '0s', animationDuration: '2s' }} />
        <circle cx="270" cy="155" r="15" fill="#F97316" className="animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }} />
        <circle cx="255" cy="140" r="12" fill="#A855F7" className="animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '2s' }} />
        <ellipse cx="290" cy="168" rx="14" ry="10" fill="#EAB308" className="animate-bounce" style={{ animationDelay: '0.6s', animationDuration: '2s' }} />
        <circle cx="230" cy="145" r="10" fill="#22C55E" />
        {/* Apple stem */}
        <line x1="240" y1="145" x2="243" y2="138" stroke="#16A34A" strokeWidth="2" />
      </g>
      {/* Autumn leaves */}
      <g className="animate-float" style={{ animationDuration: '3s' }}>
        <path d="M70 80 Q80 65 90 80 Q80 70 70 80Z" fill="#EF4444" opacity="0.6" />
      </g>
      <g className="animate-float" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
        <path d="M320 90 Q330 75 340 90 Q330 80 320 90Z" fill="#F97316" opacity="0.6" />
      </g>
      <g className="animate-float" style={{ animationDuration: '3.5s', animationDelay: '1s' }}>
        <path d="M200 60 Q210 45 220 60 Q210 50 200 60Z" fill="#EAB308" opacity="0.6" />
      </g>
    </svg>
  );
}

function christmasScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <text x="40" y="50" style={{ fontSize: '16px' }} className="animate-bounce" fill="#93C5FD">&#10052;</text>
      <text x="340" y="70" style={{ fontSize: '20px' }} className="animate-bounce" fill="#93C5FD">&#10052;</text>
      <text x="180" y="30" style={{ fontSize: '14px' }} className="animate-bounce" fill="#BFDBFE">&#10052;</text>
      <text x="280" y="45" style={{ fontSize: '18px' }} className="animate-bounce" fill="#93C5FD">&#10052;</text>
      <g className="animate-wiggle" style={{ transformOrigin: '200px 180px' }}>
        <path d="M130 280 Q120 180 160 140 Q200 110 240 140 Q280 180 270 280 Z" fill="#DC2626" />
        <path d="M140 280 Q135 200 165 155 Q180 135 200 130" fill="none" stroke="#B91C1C" strokeWidth="3" opacity="0.5" />
        <path d="M185 135 Q200 120 215 135" fill="none" stroke="#F59E0B" strokeWidth="4" />
        <circle cx="200" cy="125" r="6" fill="#F59E0B" />
        <rect x="170" y="105" width="25" height="25" rx="3" fill="#22C55E" className="animate-bounce" style={{ animationDelay: '0s', animationDuration: '2s' }} />
        <line x1="182" y1="105" x2="182" y2="130" stroke="#FFD700" strokeWidth="2" /><line x1="170" y1="117" x2="195" y2="117" stroke="#FFD700" strokeWidth="2" />
        <rect x="200" y="100" width="22" height="22" rx="3" fill="#3B82F6" className="animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '2s' }} />
        <line x1="211" y1="100" x2="211" y2="122" stroke="#FCD34D" strokeWidth="2" /><line x1="200" y1="111" x2="222" y2="111" stroke="#FCD34D" strokeWidth="2" />
        <rect x="155" y="115" width="18" height="18" rx="2" fill="#A78BFA" className="animate-bounce" style={{ animationDelay: '0.6s', animationDuration: '2s' }} />
        <line x1="164" y1="115" x2="164" y2="133" stroke="#FDE68A" strokeWidth="1.5" /><line x1="155" y1="124" x2="173" y2="124" stroke="#FDE68A" strokeWidth="1.5" />
      </g>
      <circle cx="150" cy="90" r="3" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="250" cy="85" r="2.5" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2.5s' }} />
    </svg>
  );
}

function newYearScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      {/* Fireworks */}
      <circle cx="100" cy="80" r="4" fill="#EF4444" className="animate-ping" style={{ animationDuration: '1.5s' }} />
      <circle cx="85" cy="65" r="3" fill="#F97316" className="animate-ping" style={{ animationDuration: '1.8s' }} />
      <circle cx="115" cy="70" r="3" fill="#FBBF24" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="95" cy="95" r="2.5" fill="#EC4899" className="animate-ping" style={{ animationDuration: '1.6s' }} />
      <circle cx="300" cy="60" r="4" fill="#3B82F6" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="315" cy="50" r="3" fill="#8B5CF6" className="animate-ping" style={{ animationDuration: '1.7s' }} />
      <circle cx="285" cy="55" r="3" fill="#22C55E" className="animate-ping" style={{ animationDuration: '2.2s' }} />
      <circle cx="200" cy="40" r="3.5" fill="#FFD700" className="animate-ping" style={{ animationDuration: '1.4s' }} />
      <circle cx="190" cy="55" r="2.5" fill="#F472B6" className="animate-ping" style={{ animationDuration: '1.9s' }} />
      <circle cx="215" cy="50" r="2" fill="#34D399" className="animate-ping" style={{ animationDuration: '2.1s' }} />
      {/* Confetti */}
      <rect x="60" y="120" width="12" height="6" rx="2" fill="#EF4444" className="animate-bounce" transform="rotate(30 66 123)" />
      <rect x="150" y="110" width="10" height="5" rx="2" fill="#3B82F6" className="animate-bounce" style={{ animationDelay: '0.2s' }} transform="rotate(-20 155 112)" />
      <rect x="250" y="130" width="11" height="5" rx="2" fill="#22C55E" className="animate-bounce" style={{ animationDelay: '0.4s' }} transform="rotate(45 255 132)" />
      <rect x="340" y="115" width="9" height="5" rx="2" fill="#FBBF24" className="animate-bounce" style={{ animationDelay: '0.1s' }} transform="rotate(-35 344 117)" />
      {/* Year text */}
      <text x="200" y="210" textAnchor="middle" fill="#FFD700" style={{ fontSize: '60px', fontWeight: 'bold', fontFamily: 'system-ui' }} className="animate-pulse">
        {new Date().getFullYear()}
      </text>
      {/* Party hat */}
      <g className="animate-wiggle" style={{ transformOrigin: '200px 160px' }}>
        <path d="M170 170 L200 110 L230 170Z" fill="#8B5CF6" />
        <circle cx="200" cy="108" r="6" fill="#FBBF24" />
        <line x1="178" y1="140" x2="222" y2="140" stroke="#F472B6" strokeWidth="2" />
        <line x1="175" y1="150" x2="225" y2="150" stroke="#34D399" strokeWidth="2" />
        <line x1="172" y1="160" x2="228" y2="160" stroke="#FBBF24" strokeWidth="2" />
      </g>
    </svg>
  );
}

function defaultScene() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full">
      <rect x="60" y="40" width="12" height="6" rx="2" fill="#EF4444" className="animate-bounce" style={{ animationDelay: '0s' }} transform="rotate(30 66 43)" />
      <rect x="120" y="60" width="10" height="5" rx="2" fill="#3B82F6" className="animate-bounce" style={{ animationDelay: '0.2s' }} transform="rotate(-20 125 62)" />
      <rect x="280" y="50" width="11" height="5" rx="2" fill="#22C55E" className="animate-bounce" style={{ animationDelay: '0.4s' }} transform="rotate(45 285 52)" />
      <rect x="340" y="70" width="9" height="5" rx="2" fill="#FBBF24" className="animate-bounce" style={{ animationDelay: '0.1s' }} transform="rotate(-35 344 72)" />
      <rect x="180" y="30" width="10" height="5" rx="2" fill="#A78BFA" className="animate-bounce" style={{ animationDelay: '0.3s' }} transform="rotate(15 185 32)" />
      <circle cx="90" cy="80" r="4" fill="#F472B6" className="animate-bounce" style={{ animationDelay: '0.5s' }} />
      <circle cx="310" cy="40" r="3" fill="#34D399" className="animate-bounce" style={{ animationDelay: '0.15s' }} />
      <g className="animate-wiggle" style={{ transformOrigin: '200px 170px' }}>
        <path d="M155 110 L160 190 Q180 210 200 210 Q220 210 240 190 L245 110 Z" fill="#FFD700" />
        <path d="M160 110 L165 185 Q182 202 200 202 Q218 202 235 185 L240 110 Z" fill="#FFC107" />
        <path d="M155 120 Q120 120 120 150 Q120 175 155 175" fill="none" stroke="#FFD700" strokeWidth="8" />
        <path d="M245 120 Q280 120 280 150 Q280 175 245 175" fill="none" stroke="#FFD700" strokeWidth="8" />
        <rect x="180" y="210" width="40" height="12" rx="2" fill="#B8860B" />
        <rect x="170" y="222" width="60" height="10" rx="3" fill="#8B6914" />
        <rect x="165" y="232" width="70" height="12" rx="4" fill="#B8860B" />
        <text x="200" y="170" textAnchor="middle" fill="#8B6914" style={{ fontSize: '36px' }}>&#9733;</text>
      </g>
      <circle cx="140" cy="100" r="3" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2s' }} />
      <circle cx="260" cy="95" r="2.5" fill="#FFD700" className="animate-ping" style={{ animationDuration: '2.5s' }} />
    </svg>
  );
}

// ---------- Message + scene mapping ----------

const HOLIDAY_CONFIG: Record<string, { message: (g: string) => string; scene: () => JSX.Element }> = {
  valentines:    { message: g => `Love wins! ${g} earned!`,               scene: valentinesScene },
  stpatricks:    { message: g => `Caught the leprechaun! ${g} earned!`,   scene: stpatricksScene },
  easter:        { message: g => `The Easter Bunny delivered! ${g} earned!`, scene: easterScene },
  spring:        { message: g => `Blooming success! ${g} earned!`,        scene: springScene },
  memorial:      { message: g => `Stars & stripes! ${g} earned!`,         scene: memorialScene },
  july4th:       { message: g => `Freedom earned! ${g} achieved!`,        scene: july4thScene },
  halloween:     { message: g => `Spooky good work! ${g} earned!`,        scene: halloweenScene },
  thanksgiving:  { message: g => `So much to be thankful for! ${g} earned!`, scene: thanksgivingScene },
  christmas:     { message: g => `Ho ho ho! ${g} earned!`,                scene: christmasScene },
  newyear:       { message: g => `Happy New Year! ${g} earned!`,          scene: newYearScene },
};

function getSeasonalContent(goalName: string) {
  const holiday = getActiveHoliday();
  if (holiday && HOLIDAY_CONFIG[holiday]) {
    const cfg = HOLIDAY_CONFIG[holiday];
    return { message: cfg.message(goalName), scene: cfg.scene() };
  }
  return { message: `Goal achieved! ${goalName} earned!`, scene: defaultScene() };
}

// ---------- Component ----------

export function GoalCelebration({
  show,
  goalName,
  onComplete,
}: {
  show: boolean;
  goalName: string;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const skipMotion = useShouldSkipMotion();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (show && !visible) {
      // In perf-mode or with reduced-motion, fire onComplete immediately
      // and skip the 6s SVG-heavy seasonal scene entirely.
      if (skipMotion) {
        onCompleteRef.current?.();
        return;
      }
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleDismiss, 6000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, visible, handleDismiss, skipMotion]);

  useEffect(() => {
    if (!show && visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
    }
  }, [show, visible]);

  if (!visible) return null;

  const { message, scene } = getSeasonalContent(goalName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs cursor-pointer animate-in fade-in duration-300"
      onClick={handleDismiss}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-75 duration-500">
        <div className="w-72 h-52 sm:w-96 sm:h-72">
          {scene}
        </div>
        <div className="bg-card/95 backdrop-blur-xs rounded-xl px-6 py-3 shadow-lg border border-border">
          <p className="text-lg font-bold text-center">{message}</p>
        </div>
        <p className="text-xs text-white/60">Tap to dismiss</p>
      </div>
    </div>
  );
}
