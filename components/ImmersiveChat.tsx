import React, { useState, useEffect } from 'react';
import { X, ChevronRight, MousePointer2 } from 'lucide-react';

interface ImmersiveChatProps {
  onClose: () => void;
}

export const ImmersiveChat: React.FC<ImmersiveChatProps> = ({ onClose }) => {
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    // Ép body không cuộn để tập trung vào iframe
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleDismissGuide = () => {
    setShowGuide(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-500">
      {/* Background Deep Black */}
      <div className="absolute inset-0 bg-black pointer-events-none"></div>

      {/* Header Controls - Minimal Text at Top */}
      <div className="absolute top-2 md:top-4 left-0 right-0 px-4 flex flex-col items-center z-[100] safe-area-inset-top pointer-events-none">
        <div className="flex justify-between items-start w-full max-w-[1400px] pointer-events-auto">
          <div className="flex-1 hidden md:block"></div>
          <div className="flex items-start gap-2 mx-auto md:mx-0 max-w-[75%] md:max-w-none">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping shrink-0 mt-1"></div>
            <span className="text-[clamp(8px,2.5vw,11px)] font-bold text-white/90 uppercase tracking-[0.2em] text-center drop-shadow-md leading-tight">
              Hãy chọn Vietnameses và Chat Now để bắt đầu trao đổi sau 30s nhé!
            </span>
          </div>
          <div className="flex-1 flex justify-end">
            <button 
              onClick={onClose}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-2xl group"
            >
              <X size={20} className="md:size-6 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Frame Container - FORCE ABSOLUTE CENTER & FULL HEIGHT */}
      <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
        <iframe 
          src="https://embed.liveavatar.com/v1/313351cf-4eba-471f-8d3d-fa22363c73b7"
          className="border-none shadow-[0_0_100px_rgba(0,0,0,0.5)]"
          style={{ 
            height: '100dvh',
            width: '177.78dvh', // 16:9 ratio based on height
            minWidth: '177.78dvh',
            maxWidth: 'none',
            flexShrink: 0
          }}
          allow="microphone; camera; autoplay; display-capture"
        ></iframe>

        {/* Guide Overlay - Hướng dẫn khi mới mở */}
        {showGuide && (
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-[10px] flex items-center justify-center z-[150] transition-all cursor-pointer"
            onClick={handleDismissGuide}
          >
            <div className="bg-white p-10 rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col items-center gap-8 animate-in zoom-in-95 duration-500 max-w-[85%] text-center border-t-8 border-blue-600">
              <div className="flex items-center gap-5 text-black">
                <span className="text-3xl font-[900] tracking-tighter">CHỌN</span>
                <div className="relative">
                  <MousePointer2 size={48} className="text-blue-600 animate-gentle-float" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                </div>
                <span className="text-3xl font-[900] tracking-tighter">& BẤM</span>
              </div>
              <div className="space-y-3">
                <p className="text-[15px] font-black text-gray-900 leading-relaxed uppercase tracking-tight">Bước 1: Chọn ngôn ngữ "Vietnamese"</p>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-blue-600 bg-blue-50 px-4 py-2 rounded-full">Sau đó nhấn "Chat Now"</p>
              </div>
              <button className="w-full py-5 bg-blue-600 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95">BẮT ĐẦU TRÒ CHUYỆN</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes glow-neon {
          0%, 100% { border-color: rgba(59,130,246,0.4); box-shadow: 0 0 15px rgba(59,130,246,0.3); transform: scale(1); }
          50% { border-color: rgba(59,130,246,1); box-shadow: 0 0 40px rgba(59,130,246,0.7); transform: scale(1.03); }
        }
        .animate-gentle-float { animation: gentle-float 3s ease-in-out infinite; }
        .animate-glow-neon { animation: glow-neon 2s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
      `}</style>
    </div>
  );
};