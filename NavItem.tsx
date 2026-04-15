import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 md:flex-row md:w-full md:gap-3 md:px-4 md:py-3",
        active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-black hover:bg-black/5"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium md:text-sm">{label}</span>
    </button>
  );
}
