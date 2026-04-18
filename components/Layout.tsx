
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

export const Layout: React.FC<LayoutProps> = ({ children, title, onBack, onIconClick, onTitleClick, actions }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-blue-100 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shadow-sm">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4 flex-1">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack ? (
              <button onClick={onBack} className="p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0">
                <ChevronLeft size={20} className="text-blue-600" />
              </button>
            ) : (
              <div 
                onClick={onIconClick}
                className={`w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-md shrink-0 ${onIconClick ? 'cursor-pointer hover:bg-blue-700 active:scale-95 transition-all' : ''}`}
              >
                M
              </div>
            )}
            <div 
              onClick={onTitleClick}
              className={`text-base sm:text-lg font-black text-blue-900 tracking-tight flex-1 min-w-0 ${onTitleClick ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
            >
              {title || <span className="uppercase">MEGA PHƯƠNG ADMIN</span>}
            </div>
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
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
