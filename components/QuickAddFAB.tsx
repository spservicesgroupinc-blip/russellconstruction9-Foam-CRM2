import React, { useState, useRef, useEffect } from 'react';

interface QuickAddFABProps {
  onNewEstimate: () => void;
  onNewCustomer: () => void;
}

const QuickAddFAB: React.FC<QuickAddFABProps> = ({ onNewEstimate, onNewCustomer }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleActionClick = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <div ref={menuRef} className="fixed bottom-24 right-[5.5rem] z-[9999]">
      {isMenuOpen && (
        <div className="flex flex-col items-end gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="bg-slate-900/70 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">New Customer</span>
            <button
              onClick={() => handleActionClick(onNewCustomer)}
              className="w-12 h-12 bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-full shadow-md flex items-center justify-center transition-transform transform hover:scale-110"
              aria-label="Add New Customer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-slate-900/70 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">New Estimate</span>
            <button
              onClick={() => handleActionClick(onNewEstimate)}
              className="w-12 h-12 bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-full shadow-md flex items-center justify-center transition-transform transform hover:scale-110"
              aria-label="Create New Estimate"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110"
        aria-label={isMenuOpen ? "Close Quick Add Menu" : "Open Quick Add Menu"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default QuickAddFAB;
