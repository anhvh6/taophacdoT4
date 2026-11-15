
import React from 'react';
import { User, Package, Plus, Info, Home, ChevronLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  onBack?: () => void;
  onIconClick?: () => void;
  onTitleClick?: () => void;
  actions?: React.ReactNode;
}

const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/193-BwKDTSLZdgwfQSo-0N3ueREo0HeJ2Ta9gLbI3oc8/edit?usp=sharing";

export const Layout: React.FC<LayoutProps> = ({ children, title, onBack, onIconClick, onTitleClick, actions }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-4 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          {onBack ? (
            <button onClick={onBack} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors shrink-0" title="Quay lại">
              <ChevronLeft size={18} className="text-blue-600" />
            </button>
          ) : (
            <a 
              href={GOOGLE_SHEETS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onIconClick}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-xs shrink-0 transition-all cursor-pointer select-none"
              title="Mở Google Sheets"
            >
              M
            </a>
          )}
          {title && (
            <div 
              onClick={onTitleClick}
              className={`text-sm sm:text-base font-black text-blue-900 tracking-tight shrink-0 ${onTitleClick ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
            >
              {title}
            </div>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide shrink-0">
            {actions}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
