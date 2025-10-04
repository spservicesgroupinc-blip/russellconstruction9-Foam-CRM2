import React from 'react';

const Logo: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center my-4 py-4">
        <svg width="280" height="70" viewBox="0 0 280 70" className="drop-shadow-md">
            <defs>
                <linearGradient id="foamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
                <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0369A1" />
                </linearGradient>
            </defs>

            <g transform="translate(10, 12)">
                <circle cx="20" cy="20" r="22" fill="url(#iconGradient)" opacity="0.1" />
                <path d="M 20 8 L 20 15 M 20 25 L 20 32 M 12 20 L 8 20 M 32 20 L 28 20 M 14 14 L 10 10 M 26 26 L 30 30 M 26 14 L 30 10 M 14 26 L 10 30"
                      stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="20" cy="20" r="6" fill="none" stroke="#0EA5E9" strokeWidth="2.5" />
                <circle cx="20" cy="20" r="2" fill="#0EA5E9" />
            </g>

            <text x="62" y="40" fontFamily="system-ui, -apple-system, sans-serif" fontSize="32" fontWeight="700" fill="#1E293B" letterSpacing="-0.5">
                InsulaPro
            </text>

            <text x="63" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontSize="11" fontWeight="500" fill="#64748B" letterSpacing="1.5">
                BUSINESS SOLUTIONS
            </text>
        </svg>
    </div>
  );
};

export default Logo;
