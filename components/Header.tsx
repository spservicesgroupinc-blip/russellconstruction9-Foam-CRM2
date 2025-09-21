
import React from 'react';

interface HeaderProps {
  user: { name: string };
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 p-3 flex justify-between items-center h-16">
      <div className="font-semibold text-slate-800 dark:text-slate-100">
        Welcome, <span className="text-blue-600 dark:text-blue-400">{user.name}</span>
      </div>
      <button
        onClick={onLogout}
        className="rounded-lg bg-slate-100 dark:bg-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
      >
        Logout
      </button>
    </header>
  );
};

export default Header;
