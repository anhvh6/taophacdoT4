import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Copy, CopyPlus, Pencil, User, Home, Calendar, AlertTriangle, Layout as LayoutIcon, MessageSquare, ChevronLeft, ChevronUp, ChevronDown, RefreshCw, CheckCircle, ArrowDownToLine, Share2, LogOut } from 'lucide-react';
import { Toast } from '../components/UI';
import { customerService, generateCustomerLink } from '../src/services/customerService';
import { planService } from '../src/services/planService';
import { customPlanService } from '../src/services/customPlanService';
import { supabase } from '../src/lib/supabaseClient';
import { Customer, ExerciseTask, CustomerStatus, ExerciseType } from '../types';
import { toVnZeroHour, formatDDMMYYYY, getDiffDays, addDays, parseVNDate, toISODateKey } from '../utils/date';
import { safeSetLocalStorage } from '../src/utils/storage';
import { ImmersiveChat } from '../components/ImmersiveChat';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import Hls from 'hls.js';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ==========================================
// 🚀 CUSTOM YOUTUBE PLAYER COMPONENT
// ==========================================
const CustomYouTubePlayer = ({ url, onClose }: { url: string, onClose: () => void }) => {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<any>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Extract video ID safely
  const videoId = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|v=))([\w-]{11})/)?.[1] || url.match(/embed\/([^?]+)/)?.[1];

  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          autoplay: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (e: any) => {
            setIsReady(true);
            setDuration(e.target.getDuration());
            e.target.playVideo();
          },
          onStateChange: (e: any) => {
            if (e.data === 1) setPlaying(true); // PLAYING
            if (e.data === 2 || e.data === 0) setPlaying(false); // PAUSED or ENDED
          }
        }
      });
    };

    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
      clearInterval(progressInterval.current);
    };
  }, [videoId]);

  // Sync progress
  useEffect(() => {
    if (!isReady || !playing) {
       clearInterval(progressInterval.current);
       return;
    }
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && duration > 0) {
        setPlayed(playerRef.current.getCurrentTime() / duration);
      }
    }, 1000);
    return () => clearInterval(progressInterval.current);
  }, [isReady, playing, duration]);

  const togglePlay = () => {
     if (!playerRef.current) return;
     if (playing) {
        playerRef.current.pauseVideo();
     } else {
        playerRef.current.playVideo();
     }
  };

  const handleSeek = (pos: number) => {
     if (!playerRef.current || duration === 0) return;
     playerRef.current.seekTo(pos * duration, true);
     setPlayed(pos);
  };

  const handleSpeedChange = (speed: number) => {
     setPlaybackRate(speed);
     if (playerRef.current && playerRef.current.setPlaybackRate) {
        playerRef.current.setPlaybackRate(speed);
     }
  };

  return (
    <div className="relative w-full h-full max-w-[1400px] mx-auto bg-black flex flex-col group md:rounded-[1rem] overflow-hidden">
      <div className="flex-1 w-full h-full flex items-center justify-center cursor-pointer relative" onClick={togglePlay}>
        
        {/* Loading Spinner */}
        {!isReady && (
           <div className="absolute inset-0 flex items-center justify-center z-[50]">
              <div className="w-12 h-12 border-4 border-[#0068ff] border-t-transparent rounded-full animate-spin"></div>
           </div>
        )}

        {/* Transparent Overlay to block ALL YouTube interactions */}
        <div className="absolute inset-0 z-[100]"></div>

        {/* Cover top area to hide YouTube title, avatar, and share button with a smooth gradient */}
        <div className="absolute top-0 left-0 right-0 h-[90px] bg-gradient-to-b from-black via-black/90 to-transparent z-[120] pointer-events-none opacity-90"></div>

        {/* Render Native Iframe Wrapper with zoom to hide edge watermarks */}
        <div className={`w-full h-full pointer-events-none transition-opacity duration-500 transform scale-[1.05] ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          <div ref={containerRef} className="w-full h-full border-none outline-none" />
        </div>
      </div>
      
      {/* Custom Control Bar */}
      <div 
         className="absolute bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-black/90 to-transparent flex items-end pb-4 px-6 gap-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-[1000]"
         onClick={(e) => e.stopPropagation()}
      >
         <button onClick={togglePlay} className="text-white hover:scale-110 transition active:scale-95 bg-white/20 p-2 rounded-full backdrop-blur-md">
            {playing ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
         </button>
         
         <div className="text-white text-sm font-medium whitespace-nowrap tabular-nums">
            {formatTime(played * duration)} / {formatTime(duration)}
         </div>
         
         <div className="flex-1 flex items-center h-full group/slider relative cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            handleSeek(pos);
         }}>
            <div className="w-full h-1.5 bg-white/30 rounded-full relative overflow-hidden">
               <div className="absolute top-0 left-0 h-full bg-[#0068ff]" style={{ width: `${played * 100}%` }}></div>
            </div>
         </div>
         
         <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 backdrop-blur-md">
            <span className="text-white/70 text-xs mr-1 font-medium">Tốc độ:</span>
            <select 
               value={playbackRate} 
               onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
               className="bg-transparent text-white border-none outline-none text-sm font-bold cursor-pointer appearance-none text-center"
               style={{ WebkitAppearance: 'none' }}
            >
               <option value="0.5" className="text-black">0.5x</option>
               <option value="0.75" className="text-black">0.75x</option>
               <option value="1" className="text-black">1x</option>
               <option value="1.25" className="text-black">1.25x</option>
               <option value="1.5" className="text-black">1.5x</option>
               <option value="2" className="text-black">2x</option>
            </select>
         </div>

         <button onClick={onClose} className="text-white hover:bg-red-500 hover:text-white transition active:scale-95 bg-white/10 p-2 rounded-lg backdrop-blur-md ml-2 flex items-center gap-1">
            <X size={20} /> <span className="text-sm font-bold hidden sm:inline">Đóng</span>
         </button>
      </div>
      
      {/* Giant center play button when paused */}
      {!playing && isReady && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="w-20 h-20 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white/90 shadow-2xl">
               <Play size={40} fill="currentColor" className="ml-2"/>
            </div>
         </div>
      )}
    </div>
  );
};


const HlsVideoPlayerCore = ({ 
  url, 
  serverIndex, 
  initialTime, 
  retryCount,
  fallbackEmbedUrl,
  onError,
  onForceReload
}: { 
  url: string, 
  serverIndex: number, 
  initialTime: number, 
  retryCount: number,
  fallbackEmbedUrl: string,
  onError: (time: number) => void,
  onForceReload: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadingMsg, setLoadingMsg] = useState(retryCount > 0 ? `Đang lách tường lửa nhà mạng (Lần ${retryCount}/3)...` : "Đang kết nối máy chủ...");
  const [useIframe, setUseIframe] = useState(false);
  const [iframeTimeout, setIframeTimeout] = useState(false);

  let token = '';
  let expires = '';
  let videoId = '';
  try {
    const urlObj = new URL(url, window.location.origin || 'https://phacdo.com');
    token = urlObj.searchParams.get('token') || '';
    expires = urlObj.searchParams.get('expires') || '';
    videoId = urlObj.pathname.split('/')[1];
  } catch (e) {}

  const fallbackUrls = [
    `https://video.phacdo.com/${videoId}/playlist.m3u8?token=${token}&expires=${expires}`,
    `https://vz-371142c2-906.b-cdn.net/${videoId}/playlist.m3u8?token=${token}&expires=${expires}`,
  ];

  useEffect(() => {
    let isMounted = true;
    let hls: Hls | null = null;
    let errorHandled = false;

    const currentUrl = fallbackUrls[serverIndex];
    const bypassCacheUrl = `${currentUrl}&retry=${Date.now()}_${Math.random()}`;

    const triggerError = () => {
      if (!isMounted || errorHandled) return;
      errorHandled = true;
      const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
      
      if (retryCount >= 3) {
         setUseIframe(true);
      } else {
         onError(currentTime);
      }
    };

    if (Hls.isSupported() && videoRef.current) {
      hls = new Hls({ maxMaxBufferLength: 30 });
      hls.loadSource(bypassCacheUrl);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isMounted) return;
        setLoadingMsg("");
        if (initialTime > 0 && videoRef.current) {
           videoRef.current.currentTime = initialTime;
        }
        videoRef.current?.play().catch(() => console.log("Auto-play prevented"));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
           console.warn("HLS Network Error, forcing full remount...", data);
           triggerError();
        }
      });
    } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = bypassCacheUrl;
      videoRef.current.onerror = triggerError;
      
      const onLoadedMetadata = () => {
        if (!isMounted) return;
        setLoadingMsg("");
        if (initialTime > 0 && videoRef.current) {
           videoRef.current.currentTime = initialTime;
        }
        videoRef.current?.play().catch(() => console.log("Auto-play prevented"));
      };
      
      videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
      return () => {
         isMounted = false;
         if (videoRef.current) videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    }
    
    return () => {
      isMounted = false;
      if (hls) hls.destroy();
    };
  }, [serverIndex, retryCount]);

  useEffect(() => {
     let timer: NodeJS.Timeout;
     if (useIframe) {
        timer = setTimeout(() => {
           setIframeTimeout(true);
        }, 8000); // Sau 8 giây nếu iframe vẫn đen, hiện nút tải lại
     }
     return () => clearTimeout(timer);
  }, [useIframe]);

  if (useIframe && fallbackEmbedUrl) {
    const fallbackIframe = fallbackEmbedUrl.replace('video.phacdo.com', 'iframe.mediadelivery.net');
    return (
       <div className="w-full h-full relative flex flex-col items-center justify-center bg-black md:rounded-[2rem] shadow-2xl overflow-hidden group">
         <iframe 
            src={fallbackIframe}
            className="w-full h-full border-none outline-none bg-black"
            loading="lazy" 
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;"
            allowFullScreen
         ></iframe>
         
         {iframeTimeout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <button 
                  onClick={onForceReload}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full flex items-center gap-2 shadow-lg transform transition active:scale-95"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  Tải lại kết nối
               </button>
            </div>
         )}
       </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center max-w-[1400px] mx-auto bg-black md:rounded-[2rem] shadow-2xl overflow-hidden">
      {loadingMsg && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm pointer-events-none">
           <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white/80 font-medium">{loadingMsg}</p>
              <p className="text-white/50 text-sm mt-2 text-center px-4">Hệ thống đang tự động tối ưu để vượt qua kiểm duyệt của nhà mạng...</p>
           </div>
        </div>
      )}
      <video ref={videoRef} controls className="w-full h-full outline-none" playsInline />
    </div>
  );
};

const HlsVideoPlayer = ({ url }: { url: string }) => {
  const [mountKey, setMountKey] = useState(0);
  const [serverIndex, setServerIndex] = useState(0);
  const [savedTime, setSavedTime] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const handleFatalError = (currentTime: number) => {
     setSavedTime(currentTime);
     setServerIndex(prev => (prev + 1) % 2); // 2 is fallbackUrls.length
     setRetryCount(prev => prev + 1);
     
     // Chờ 2.5s để tránh bị firewall hoặc CDN block vì spam request (DDoS protection)
     setTimeout(() => {
        setMountKey(k => k + 1);
     }, 2500); 
  };

  const handleForceReload = () => {
     setSavedTime(0);
     setRetryCount(0);
     setServerIndex(0);
     setMountKey(k => k + 1);
  };

  let fallbackEmbedUrl = '';
  try {
     fallbackEmbedUrl = new URL(url).searchParams.get('fallback_embed') || '';
  } catch(e) {}

  return (
     <HlsVideoPlayerCore 
        key={mountKey} 
        url={url} 
        serverIndex={serverIndex} 
        initialTime={savedTime} 
        retryCount={retryCount}
        fallbackEmbedUrl={fallbackEmbedUrl}
        onError={handleFatalError} 
        onForceReload={handleForceReload}
     />
  );
}

const isFlagEnabled = (value: any, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['false', '0', 'off', 'no', 'n', 'f', 'disabled'].includes(normalized)) return false;
    if (['true', '1', 'on', 'yes', 'y', 't', 'enabled'].includes(normalized)) return true;
  }
  return fallback;
};

const getOrCreateDeviceId = async (customerId: string) => {
  const localKey = `phacdo_device_id_${customerId}`;
  let storedId = localStorage.getItem(localKey);
  if (storedId && storedId.trim() !== '') {
    return storedId;
  }

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    if (result.visitorId) {
      localStorage.setItem(localKey, result.visitorId);
      return result.visitorId;
    }
  } catch (e) {
    console.warn("FingerprintJS failed, using generated fallback UUID:", e);
  }

  const randomId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem(localKey, randomId);
  return randomId;
};

export const ClientView: React.FC<{ customerId: string; token?: string; onNavigate?: (page: string, params?: any) => void; isAdmin?: boolean; adminRole?: string | null; checkPermission?: (perm: string) => boolean }> = ({ customerId, token, onNavigate, isAdmin, adminRole, checkPermission }) => {
  const [customer, setCustomer] = useState<Customer | any>(null);
  const [tasks, setTasks] = useState<ExerciseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ExerciseTask | null>(null);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; message: string; type?: string; color?: string; confirmText?: string; onConfirm?: () => void } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoggedEmail, setLastLoggedEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  
  // Zalo Bypass & Video Auth State
  const [isZalo, setIsZalo] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [authModal, setAuthModal] = useState<{isOpen: boolean, link: string | null, day?: number}>({isOpen: false, link: null});
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // Device & Security State
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceAuthorized, setDeviceAuthorized] = useState(false);
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(true);
  const [deviceModal, setDeviceModal] = useState<{ isOpen: boolean, message?: string } | null>(null);
  const [isRequestingApproval, setIsRequestingApproval] = useState(false);
  const [isRequestingEmail, setIsRequestingEmail] = useState(false);

  // Self Approval State
  const [selfApprovalCode, setSelfApprovalCode] = useState('');
  const [selfApprovalLoading, setSelfApprovalLoading] = useState(false);
  const [selfApprovalError, setSelfApprovalError] = useState('');
  const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);

  const refreshInFlight = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const fetchData = async (useCache = true, forceRefresh = false) => {
    // Nếu không có token và không có onNavigate (không phải admin), từ chối ngay
    const isPreviewDomain = window.location.hostname.includes('taophacdot4') || window.location.hostname.includes('taophacdo.vercel.app') || window.location.hostname.includes('localhost');
    if (!token && !onNavigate && !isAdmin && !isPreviewDomain) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    // Thử lấy từ cache trước để hiển thị ngay lập tức (Stale-While-Revalidate)
    if (useCache) {
      const cached = localStorage.getItem(`phacdo_cache_${customerId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.customer) {
            setCustomer(parsed.customer);
            if (parsed.tasks) setTasks(parsed.tasks);
            // Hiển thị dữ liệu cũ TRƯỚC khi tải dữ liệu mới (UX nhanh tức thì)
            setLoading(false);
          }
        } catch (e) {
          console.error("Lỗi parse cache:", e);
        }
      }
    }

    try {
      setError(null);
      console.log("ClientView: Fetching customer with ID:", customerId, "Token:", token);
      // 1. Load customer data and custom plan in parallel
      const [customerData, customTasks] = await Promise.all([
          token ? customerService.getCustomerByToken(customerId, token) : (onNavigate ? customerService.getCustomerById(customerId) : null),
          customPlanService.getCustomPlan(customerId || '', token)
      ]);

      if (!customerData) {
        console.warn("ClientView: No customer found for ID:", customerId, "Token:", token);
        if (token && !onNavigate) {
          setAccessDenied(true);
          // Tự động chuyển hướng đến trang chủ nếu không tìm thấy phác đồ hợp lệ
          setTimeout(() => {
            window.location.replace('https://30ngaythaydoi.vercel.app/');
          }, 1500);
        }
        setLoading(false);
        return;
      }
      
      setCustomer(customerData);
      let planTasks: any[] = [];
      const actualId = customerData.customer_id || customerId;
            console.log("Custom tasks result count:", customTasks?.length || 0);
      
      if (customTasks && customTasks.length > 0) {
        planTasks = customTasks;
        // Even if customized, if they somehow contain tasks from other groups (due to old bugs), filter them
        if (customerData.ma_vd) {
          planTasks = planTasks.filter(t => !t.nhom || t.nhom === customerData.ma_vd);
        }
      } else {
        // Fallback to master plan using video_date
        const videoDate = customerData.video_date || customerData.Video_date;
        console.log("No custom tasks, falling back to master plan for date:", videoDate);
        if (videoDate) {
          planTasks = await planService.getMasterPlan(videoDate);
          if (customerData.ma_vd) {
            planTasks = planTasks.filter(t => t.nhom === customerData.ma_vd);
          }
          console.log("Master plan tasks result count:", planTasks?.length || 0);
        }
      }

      // CRITICAL: Tự động cập nhật nội dung mới nhất từ Lich phac do khi load trang
      // Chỉ tự động cập nhật nếu khách hàng CHƯA tùy chỉnh. Nếu đã tùy chỉnh, tôn trọng dữ liệu đã lưu.
      const videoDate = customerData.video_date || customerData.Video_date;
      let syncOccurred = false;
      if (videoDate && planTasks.length > 0 && !customerData.is_customized) {
        const todayDate = toVnZeroHour();
        const start = toVnZeroHour(customerData.start_date);
        const currentAllowedDay = customerData.allowed_day || getDiffDays(start, todayDate) + 1;
        
        // Đồng bộ toàn bộ phác đồ từ master
        if (currentAllowedDay > 0) {
          try {
            const masterTasks = await planService.getMasterPlan(videoDate);
            if (masterTasks && masterTasks.length > 0) {
              planTasks = masterTasks;
              if (customerData.ma_vd) {
                planTasks = planTasks.filter(t => t.nhom === customerData.ma_vd);
              }
              syncOccurred = true;
            }
          } catch (e) {
            console.warn("Failed to auto-sync master tasks on load", e);
          }
        }
      }

      const deduplicate = (list: any[]) => {
        const seen = new Set();
        return list.filter(t => {
          const key = `${t.day}-${(t.title || "").trim()}-${(t.link || "").trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const cleanTasks = deduplicate(planTasks || [])
        .filter((task: any) => !task.is_deleted && task.day <= 30)
        .sort((a: any, b: any) => {
          if (a.day !== b.day) return a.day - b.day;
          return (a.title || "").localeCompare(b.title || "", 'vi', { numeric: true });
        });
      
      setTasks(cleanTasks);

      // Lưu vào cache cho lần sau
      safeSetLocalStorage(`phacdo_cache_${customerId}`, JSON.stringify({
        customer: customerData,
        tasks: cleanTasks,
        timestamp: Date.now()
      }));
      
      if (customerData.expire_warning === true) {
        setTimeout(() => {
          setInfoModal({ 
            isOpen: true, 
            title: "Nhắc nhở gia hạn", 
            message: `Phác đồ cá nhân của bạn sắp kết thúc thời hạn vào ngày ${formatDDMMYYYY(customerData.end_date)}. Hãy gia hạn sớm để không gián đoạn việc tập luyện nhé!`, 
            type: "WARNING",
            color: "#F97316"
          });
        }, 1000);
      }
    } catch (err: any) {
      console.error("Lỗi tải dữ liệu học viên:", err);
      if (err.message === 'ACCESS_DENIED') {
        setAccessDenied(true);
      } else {
        setError(err.message || "Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối mạng.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    // Force fresh fetch if in Admin mode (onNavigate exists) to avoid stale cache
    const shouldSkipCache = !!onNavigate;
    fetchData(!shouldSkipCache); 
  }, [customerId, token]);

  // Device & OAuth Initialization
  useEffect(() => {
    const initDevice = async () => {
      setDeviceAuthLoading(true);
      try {
        const fpId = await getOrCreateDeviceId(customerId);
        setDeviceId(fpId);

        // If in admin mode or preview domain, always authorized
        const isPreviewDomain = window.location.hostname.includes('taophacdot4') || window.location.hostname.includes('taophacdo.vercel.app') || window.location.hostname.includes('localhost');
        if (onNavigate || isAdmin || isPreviewDomain) {
          setDeviceAuthorized(true);
          setDeviceAuthLoading(false);
          return;
        }

        // Authorize device via backend
        if (token && customerId) {
          // Gửi thêm thông tin OS, Screen để nhận diện sâu hơn (Heuristic)
          const deviceName = `${navigator.platform} - ${window.screen.width}x${window.screen.height}`;
          const authResult = await customerService.authorizeDevice(customerId, token, fpId, deviceName);
          if (authResult?.success) {
            setDeviceAuthorized(true);
          } else {
            console.warn("Device not authorized:", authResult?.message);
            setDeviceAuthorized(false);
          }
        }
      } catch (e) {
        console.error("Device init error:", e);
        // Nếu lỗi fingerprint thì cho phép admin xem, nhưng khóa học viên nếu cần cực kỳ bảo mật
        if (onNavigate) setDeviceAuthorized(true);
      } finally {
        setDeviceAuthLoading(false);
      }
    };

    initDevice();

    const ua = navigator.userAgent || navigator.vendor;
    const isZaloBrowser = /Zalo/i.test(ua) || /FB_IAB/i.test(ua) || /Messenger/i.test(ua);
    
    if (isZaloBrowser) {
      if (/android/i.test(ua)) {
         // Auto bypass Zalo Android
         const targetUrl = window.location.href.replace(/^https?:\/\//, '');
         window.location.href = `intent://${targetUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
         setIsZalo(true);
      }
    }
    
    // Khôi phục phiên bản xác thực email
    if (localStorage.getItem(`verified_email_${customerId}`)) {
       setIsVerified(true);
    }
  }, [customerId, token, onNavigate]);

  const hasAutoPrompted = useRef(false);

  // Anti-tamper: Ngăn chuột phải và F12 (chỉ đối với học viên)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!onNavigate) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (onNavigate) return; // Cho phép Admin

      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNavigate]);

  // Tự động bật Modal đăng nhập Google nếu chưa xác thực hoặc chưa có email
  useEffect(() => {
    // Không làm gì nếu đang tải chưa xong hoặc không có khách hàng
    if (loading || !customer) return;
    
    const hasEmail = customer.email && String(customer.email).trim() !== "";
    const isPreviewDomain = window.location.hostname.includes('taophacdot4') || window.location.hostname.includes('taophacdo.vercel.app') || window.location.hostname.includes('localhost');
    const isSkipAuth = onNavigate || isAdmin || isPreviewDomain;
    const needsGoogleAuth = isFlagEnabled(customer.require_google_auth, true) && !isSkipAuth;
    const needsDeviceLimit = isFlagEnabled(customer.require_device_limit, true) && !isSkipAuth;
    
    // Điều kiện để hiện modal: 
    // Chỉ hiện khi bắt buộc có xác thực Google (needsGoogleAuth = true)
    // VÀ (Chưa có email đăng ký HOẶC Chưa được xác thực)
    if (needsGoogleAuth && (!hasEmail || !isVerified) && !hasAutoPrompted.current) {
      hasAutoPrompted.current = true; // Đảm bảo chỉ tự động chớp lên 1 lần
      setTimeout(() => {
        console.log("ClientView: Tự động kích hoạt kiểm tra bảo mật...");
        setAuthModal({ isOpen: true, link: null });
      }, 300);
    }

    if (!needsGoogleAuth && authModal.isOpen) {
      setAuthModal({ isOpen: false, link: null });
    }
  }, [customer, isVerified, loading, authModal.isOpen]);

  // Helper to mark attendance in local state for instant UI feedback
  const markAttendanceLocally = (dayNum?: number) => {
    if (!customer) return;
    const dateStr = toISODateKey(new Date());
    const currentDates = customer.raw_backup?.video_open_dates || [];
    const currentCompletedDays = customer.raw_backup?.completed_days || [];
    
    let updatedDates = currentDates;
    if (!currentDates.includes(dateStr)) {
      updatedDates = [...currentDates, dateStr];
    }
    
    let updatedCompletedDays = currentCompletedDays;
    if (dayNum !== undefined && !currentCompletedDays.includes(dayNum)) {
      updatedCompletedDays = [...currentCompletedDays, dayNum];
    }
    
    const updatedCustomer = {
      ...customer,
      raw_backup: {
        ...(customer.raw_backup || {}),
        video_open_dates: updatedDates,
        completed_days: updatedCompletedDays
      }
    };
    setCustomer(updatedCustomer);
    
    // Update cache to persist the checkmark locally until next refresh
    safeSetLocalStorage(`phacdo_cache_${customerId}`, JSON.stringify({
      customer: updatedCustomer,
      tasks: tasks,
      timestamp: Date.now()
    }));
  };

  // Play Video Logic
  const handlePlayVideo = async (link?: string, skipAuthCheck: boolean = false, dayNum?: number) => {
    if (!link) return;
    
    const trimmedLink = link.trim();
    const isBunnyVidId = typeof trimmedLink === "string" && trimmedLink !== "" && !/^https?:\/\//i.test(trimmedLink);
    const isExternalUrl = typeof trimmedLink === "string" && /^https?:\/\//i.test(trimmedLink) && !trimmedLink.includes('mediadelivery.net');
    
    const getYouTubeEmbedUrl = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3&fs=0&playsinline=1`;
      }
      return null;
    };
    const ytEmbedUrl = getYouTubeEmbedUrl(trimmedLink);
    const isIframeable = isBunnyVidId || trimmedLink.includes('mediadelivery.net') || ytEmbedUrl !== null;

    let newTab: Window | null = null;

    if (isAdmin && (checkPermission ? !checkPermission('view_video') : adminRole === 'qlhv')) {
      setInfoModal({
        isOpen: true,
        title: "BỊ TỪ CHỐI",
        message: "Bạn không có quyền xem video của học viên.",
        type: "WARNING",
        color: "red"
      });
      return;
    }

    // Mở newTab giả định nếu là external URL và KHÔNG phải video có thể nhúng trực tiếp
    if (isExternalUrl && !isIframeable && !onNavigate && !skipAuthCheck) {
      try {
        newTab = window.open('about:blank', '_blank');
        if (newTab) {
          newTab.document.title = "Đang chuyển hướng...";
          newTab.document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FBFF; color: #1E3A8A; margin: 0; text-align: center; padding: 20px;">
              <div style="font-size: 24px; font-weight: bold; margin-bottom: 12px; letter-spacing: -0.025em; text-transform: uppercase;">ĐANG CHUYỂN HƯỚNG</div>
              <div style="font-size: 14px; opacity: 0.8; margin-bottom: 24px; font-weight: 500;">Vui lòng đợi trong giây lát khi chúng tôi xác thực quyền truy cập của bạn...</div>
              <div style="width: 40px; height: 40px; border: 4px solid #E2E8F0; border-top-color: #2563EB; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <style>
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              </style>
            </div>
          `;
        }
      } catch (e) {
        console.error("Failed to open blank tab synchronously:", e);
      }
    }

    // Admin thực thụ (có session) thì cho xem thoải mái
    const isPreviewDomain = window.location.hostname.includes('taophacdot4') || window.location.hostname.includes('taophacdo.vercel.app') || window.location.hostname.includes('localhost');
    if (onNavigate || isAdmin || isPreviewDomain) {
      if (isBunnyVidId) {
         // Nếu là Admin thì lấy token luôn cho nhanh chứ ko mở tab mới
         const dbToken = (customer?.token || token || "").trim();
         const dbCustomerId = customer?.customer_id || customerId;
         try {
             const { data } = await supabase.functions.invoke('get-bunny-video-token', {
                 body: { video_id: trimmedLink, customer_id: dbCustomerId, token: dbToken }
             });
             // Bypass iframe block bằng cách dùng thẳng link m3u8 có kèm token
             if (data?.signed_embed_url) {
                 let finalUrl = `https://video.phacdo.com/${trimmedLink}/playlist.m3u8`;
                 try {
                     const hlsUrlObj = new URL(`https://video.phacdo.com/${trimmedLink}/playlist.m3u8`);
                     const urlObj = new URL(data.signed_embed_url);
                     const t = urlObj.searchParams.get('token');
                     const e = urlObj.searchParams.get('expires');
                     if (t) hlsUrlObj.searchParams.set('token', t);
                     if (e) hlsUrlObj.searchParams.set('expires', e);
                     hlsUrlObj.searchParams.set('fallback_embed', data.signed_embed_url);
                     finalUrl = hlsUrlObj.toString();
                 } catch (err) {}
                 setPlayingVideo(finalUrl);
             }
         } catch(e) {}
         return;
      }
      if (trimmedLink.includes('mediadelivery.net')) {
         setPlayingVideo(trimmedLink);
         return;
      }
      if (ytEmbedUrl) {
         setPlayingVideo(ytEmbedUrl);
         setTimeout(() => {
            const container = document.getElementById('bunny-fullscreen-modal');
            if (container) {
               try {
                  if (container.requestFullscreen) container.requestFullscreen();
                  else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
               } catch (e) {}
            }
         }, 300);
         return;
      }
      window.open(trimmedLink, '_blank');
      return;
    }

    // 0. Kiểm tra yêu cầu đổi email đang chờ phê duyệt
    const isStudent = !onNavigate && !isAdmin && !isPreviewDomain;
    if (isStudent && customer?.pending_email && customer.pending_email.trim() !== '') {
       setToast("Tài khoản của bạn đang có yêu cầu đổi email chờ phê duyệt.");
       setInfoModal({
          isOpen: true,
          title: "CHỜ DUYỆT EMAIL",
          message: "Yêu cầu đổi email đăng ký của bạn đang chờ Admin phê duyệt. Vui lòng quay lại sau!",
          type: "WARNING",
          color: "red"
       });
       if (newTab) newTab.close();
       return;
    }

    // 1. Kiểm tra thiết bị (Device Limit)
    const needsDeviceLimit = isFlagEnabled(customer?.require_device_limit, true) && !isPreviewDomain;

    if (!skipAuthCheck && needsDeviceLimit) {
      if (deviceAuthLoading) {
        setToast("Đang xác thực thiết bị của bạn, vui lòng đợi trong giây lát...");
        if (newTab) newTab.close();
        return;
      }
      if (!deviceAuthorized) {
        setDeviceModal({ isOpen: true });
        if (newTab) newTab.close();
        return;
      }
    }

     if (!skipAuthCheck && isFlagEnabled(customer?.require_google_auth, true) && !isPreviewDomain) {
        // Fetch latest customer data from server to ensure email is still valid
        let latestCustomer = customer;
        try {
           const freshData = await customerService.getCustomerById(customerId!);
           if (freshData) {
              latestCustomer = freshData;
              setCustomer(freshData); // Sync local state
           }
        } catch (e) {
           console.warn("Failed to refresh customer data for security check:", e);
        }

        const storedEmail = localStorage.getItem(`verified_email_${customerId}`);
        const dbEmail = (latestCustomer?.email || "").toLowerCase().trim();
        
        if (!storedEmail || (dbEmail && storedEmail.toLowerCase().trim() !== dbEmail)) {
           // Nếu chưa verify HOẶC email đã lưu không còn khớp với DB (Admin vừa đổi email)
           localStorage.removeItem(`verified_email_${customerId}`);
           setIsVerified(false);
           setToast("Email đăng ký đã thay đổi hoặc phiên làm việc hết hạn. Vui lòng đăng nhập lại!");
           setAuthModal({isOpen: true, link, day: dayNum});
           if (newTab) newTab.close();
           return;
        }
     }

    // 2. Kiểm tra xác thực Google (Email matching)
    console.log("handlePlayVideo: Security Check:", {
      require_google_auth: customer?.require_google_auth,
      isVerified: isVerified,
      customerEmail: customer?.email
    });

    const needsGoogleAuth = isFlagEnabled(customer?.require_google_auth, true) && !isPreviewDomain;

    if (!skipAuthCheck && needsGoogleAuth && !isVerified) {
       console.log("handlePlayVideo: Authentication required, opening AuthModal");
       setAuthModal({isOpen: true, link: link, day: dayNum});
       if (newTab) newTab.close();
       return;
    }

    // 3. Kiểm tra hết hạn khóa học
    if (customer?.end_date) {
      const today = toVnZeroHour();
      const end = parseVNDate(customer.end_date);
      if (end && today > end) {
        setInfoModal({ 
          isOpen: true, 
          title: "ĐÃ HẾT HẠN", 
          message: "Thời hạn xem Phác đồ của bạn đã kết thúc. Vui lòng liên hệ hỗ trợ hoặc đăng ký gia hạn để tiếp tục xem các video hướng dẫn nhé!", 
          type: "WARNING", 
          color: "red" 
        });
        if (newTab) newTab.close();
        return;
      }
    }

    if (isBunnyVidId) {
        try {
            const dbToken = (customer?.token || token || "").trim();
            const dbCustomerId = customer?.customer_id || customerId;
            const { data, error } = await supabase.functions.invoke('get-bunny-video-token', {
                body: { 
                   video_id: trimmedLink,
                   customer_id: dbCustomerId,
                   token: dbToken
                }
            });

            if (error) {
              throw new Error(error.message);
            }

            if (data?.error) {
                setInfoModal({
                    isOpen: true,
                    title: "THÔNG BÁO",
                    message: data.error,
                    type: "WARNING",
                    color: "red"
                });
                return;
            }

            if (data?.signed_embed_url) {
                // Sử dụng custom player với link video trực tiếp
                let finalHlsUrl = `https://video.phacdo.com/${trimmedLink}/playlist.m3u8`;
                try {
                    const hlsUrlObj = new URL(finalHlsUrl);
                    const urlObj = new URL(data.signed_embed_url);
                    const tokenParam = urlObj.searchParams.get('token');
                    const expiresParam = urlObj.searchParams.get('expires');
                    if (tokenParam) hlsUrlObj.searchParams.set('token', tokenParam);
                    if (expiresParam) hlsUrlObj.searchParams.set('expires', expiresParam);
                    hlsUrlObj.searchParams.set('fallback_embed', data.signed_embed_url);
                    finalHlsUrl = hlsUrlObj.toString();
                } catch (e) {
                    console.warn("Failed to parse signed_embed_url", e);
                }
                
                setPlayingVideo(finalHlsUrl);
                if (isStudent) {
                    customerService.logVideoOpen(customerId!, customer?.token || token || '', dayNum);
                    markAttendanceLocally(dayNum);
                }
            } else if (!data?.error) {
                throw new Error("Không nhận được token từ server");
            }
        } catch (err: any) {
            console.error("Bunny API Error:", err);
            setInfoModal({
                isOpen: true,
                title: "Lỗi phát video",
                message: err.message || "Không thể kết nối đến máy chủ bảo mật. Vui lòng thử lại sau.",
                type: "WARNING",
                color: "red"
            });
        }
    } else if (trimmedLink.includes('mediadelivery.net')) {
      setToast("Cảnh báo: Video này sử dụng đường dẫn cũ và không được bảo vệ bằng Token.");
      setPlayingVideo(trimmedLink);
      if (isStudent) {
          customerService.logVideoOpen(customerId!, customer?.token || token || '', dayNum);
          markAttendanceLocally(dayNum);
      }
    } else if (ytEmbedUrl) {
      setPlayingVideo(ytEmbedUrl);
      setTimeout(() => {
         const container = document.getElementById('bunny-fullscreen-modal');
         if (container) {
            try {
               if (container.requestFullscreen) container.requestFullscreen();
               else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
            } catch (e) {}
         }
      }, 300);
      if (isStudent) {
          customerService.logVideoOpen(customerId!, customer?.token || token || '', dayNum);
          markAttendanceLocally(dayNum);
      }
    } else {
      setToast("Cảnh báo: Video này là liên kết ngoài, không được bảo vệ chống tải.");
      let finalLink = link;
      if (finalLink && typeof finalLink === 'string') {
        finalLink = finalLink.replace('vz-371142c2-906.b-cdn.net', 'video.phacdo.com');
      }

      if (newTab) {
        try {
          newTab.location.href = finalLink;
          if (isStudent) {
              customerService.logVideoOpen(customerId!, customer?.token || token || '', dayNum);
              markAttendanceLocally(dayNum);
          }
        } catch (e) {
          window.location.href = finalLink;
        }
      } else {
        window.location.href = finalLink;
      }
    }
  };


  // Cập nhật tiêu đề trang theo tên học viên
  useEffect(() => {
    const updateTitle = () => {
      if (customer?.customer_name) {
        const title = `Phác đồ trẻ hóa ${customer.customer_name}`;
        document.title = title;
        
        // Cập nhật Open Graph title nếu có
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          ogTitle.setAttribute('content', title);
        }
      } else {
        document.title = "Phác đồ trẻ hóa Mega Phương";
      }
    };

    updateTitle();
    // Thêm một khoảng nghỉ ngắn để đảm bảo tiêu đề được thiết lập sau khi DOM ổn định
    const timer = setTimeout(updateTitle, 500);
    return () => clearTimeout(timer);
  }, [customer]);

  // Cuộn đến ngày đang học sau khi render xong
  useEffect(() => {
    if (!loading && customer && !hasScrolledRef.current) {
      const today = toVnZeroHour();
      const startDate = toVnZeroHour(customer.start_date);
      const allowedDay = customer.allowed_day || getDiffDays(startDate, today) + 1;

      if (allowedDay >= 2) {
        // Giảm delay xuống để cảm giác nhanh hơn
        const timer = setTimeout(() => {
          const activeCard = document.querySelector('.day-card-active');
          if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            hasScrolledRef.current = true;
          }
        }, 100);
        return () => clearTimeout(timer);
      } else {
        hasScrolledRef.current = true;
      }
    }
  }, [loading, customer]);

  const triggerBackgroundRefresh = async (currentTask?: ExerciseTask) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      const customerData = await customerService.getCustomerByToken(customerId, token || '');
      if (customerData) {
        setCustomer(customerData);
        
        let planTasks: ExerciseTask[] = [];
        const actualId = customerData.customer_id || customerId;
        const customTasks = await customPlanService.getCustomPlan(actualId, token);
        
        if (customTasks && customTasks.length > 0) {
          planTasks = customTasks;
          if (customerData.ma_vd) {
            planTasks = planTasks.filter(t => !t.nhom || t.nhom === customerData.ma_vd);
          }
        } else {
          const videoDate = customerData.video_date || customerData.Video_date;
          if (videoDate) {
            planTasks = await planService.getMasterPlan(videoDate);
            if (customerData.ma_vd) {
              planTasks = planTasks.filter(t => t.nhom === customerData.ma_vd);
            }
          }
        }

        // Logic: Lấy nội dung mới nhất từ Lich phac do hoặc tự động heal link nếu bị thiếu
        const hasMissingLinks = planTasks.some(t => !t.link || String(t.link).trim() === '');
        if (!customerData.is_customized || hasMissingLinks) {
          const videoDate = customerData.video_date || customerData.Video_date;
          if (videoDate) {
            console.log(`Merging with latest master plan to display latest content or heal missing links...`);
            const masterTasks = await planService.getMasterPlan(videoDate);
            
            if (masterTasks && masterTasks.length > 0) {
              let actualMaVd = customerData.ma_vd;
              if (!actualMaVd || String(actualMaVd).trim() === '') {
                 actualMaVd = masterTasks[0].nhom;
              }
              const filteredMaster = actualMaVd ? masterTasks.filter(t => t.nhom === actualMaVd) : masterTasks;
              
              if (!customerData.is_customized) {
                 planTasks = filteredMaster;
              } else {
                 // Nếu đã customize nhưng bị thiếu link (trắng), auto map link từ master!
                 planTasks = planTasks.map(t => {
                    if (!t.link || String(t.link).trim() === '') {
                       const match = filteredMaster.find(m => m.day === t.day && (m.title || '').trim().toLowerCase() === (t.title || '').trim().toLowerCase());
                       if (match && match.link) {
                          return { ...t, link: match.link };
                       }
                    }
                    return t;
                 });
              }
            }
          }
        }

        const deduplicate = (list: any[]) => {
          const seen = new Set();
          return list.filter(t => {
            const key = `${t.day}-${(t.title || "").trim()}-${(t.link || "").trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const cleanTasks = deduplicate(planTasks || [])
          .filter((task: any) => !task.is_deleted && task.day <= 30)
          .sort((a: any, b: any) => {
            if (a.day !== b.day) return a.day - b.day;
            return (a.title || "").localeCompare(b.title || "", 'vi', { numeric: true });
          });
        setTasks(cleanTasks);

        // Lưu vào cache cho lần sau (không ghi đè db để tránh Supabase Timeout)
        localStorage.setItem(`phacdo_cache_${customerId}`, JSON.stringify({
          customer: customerData,
          tasks: cleanTasks,
          timestamp: Date.now()
        }));
        
        if (currentTask) {
          const updated = cleanTasks.find(t => t.day === currentTask.day && t.title === currentTask.title);
          if (updated) setSelectedTask(updated);
        } else if (selectedTask) {
          const updated = cleanTasks.find(t => t.day === selectedTask.day && t.title === selectedTask.title);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch (e) {
      console.error("Background refresh failed", e);
    } finally {
      refreshInFlight.current = false;
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCopyLink = () => {
    // Use the token from the loaded customer state if available, fallback to prop
    const dbToken = (customer?.token || token || "").trim();
    const dbCustomerId = customer?.customer_id || customerId;

    if (!dbToken && onNavigate) {
       setInfoModal({
         isOpen: true,
         title: "THÔNG BÁO",
         message: "Dữ liệu chưa tải xong hoặc thiếu Token. Vui lòng thử lại sau giây lát.",
         type: "INFO"
       });
       return;
    }

    // Luôn dùng domain học viên (VITE_CLIENT_PUBLIC_URL / phacdo4)
    let linkToCopy = generateCustomerLink(dbCustomerId, dbToken);
    
    const doCopy = (text: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopyToast(true);
          setTimeout(() => setCopyToast(false), 2000);
        }).catch(() => {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    };

    const fallbackCopy = (text: string) => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopyToast(true);
          setTimeout(() => setCopyToast(false), 2000);
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
    };

    doCopy(linkToCopy);
  };

  const handleDuplicate = () => {
    if (onNavigate && customer) {
      onNavigate('plan-editor', { templateId: customer.customer_id });
    }
  };

  const isMandatory = (task: ExerciseTask) => {
    const type = String(task.type || "").toLowerCase();
    return type.includes('bắt buộc') || type.includes('bat buoc');
  };

  const handleTaskClick = (task: ExerciseTask) => {
    const today = toVnZeroHour();
    const startDate = toVnZeroHour(customer.start_date);
    const allowedDay = customer.allowed_day || getDiffDays(startDate, today) + 1;
    const isNotStarted = allowedDay < 1;

    if (isNotStarted) {
      setInfoModal({ 
        isOpen: true, 
        title: "Chưa đến thời gian tập", 
        message: `Lộ trình của bạn bắt đầu từ ngày ${formatDDMMYYYY(customer.start_date)}. Hãy chuẩn bị sẵn sàng nhé!`, 
        type: "NOT_STARTED" 
      });
      return;
    }

    if (task.day > allowedDay) {
      const unlockDate = addDays(startDate, task.day - 1);
      setInfoModal({ 
        isOpen: true, 
        title: "Chưa đến ngày mở bài", 
        message: `Bài học này sẽ được mở vào ngày ${formatDDMMYYYY(unlockDate)}. Vui lòng quay lại sau nhé!`, 
        type: "LOCKED" 
      });
      return;
    }
    
    processTaskSelection(task);
  };

  const processTaskSelection = (task: ExerciseTask) => {
    // Luôn chạy cập nhật dữ liệu khi click vào bất kỳ bài nào để lấy nội dung mới nhất
    triggerBackgroundRefresh(task);
    setSelectedTask(task);
  }

  if (loading && !customer) return (
    <div className="min-h-screen bg-[#F8FBFF] p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="h-12 bg-blue-100 rounded-2xl w-3/4 mx-auto mb-4 animate-pulse"></div>
        <div className="h-6 bg-blue-50 rounded-xl w-1/2 mx-auto mb-12 animate-pulse"></div>
        
        <div className="bg-white rounded-[2.5rem] p-8 h-64 mb-10 animate-pulse border border-blue-50"></div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-80 h-96 bg-blue-900/10 rounded-[2.5rem] animate-pulse"></div>
          <div className="flex-1 h-screen bg-white rounded-[2.5rem] animate-pulse border border-blue-50"></div>
        </div>
      </div>
    </div>
  );

  const today = toVnZeroHour();
  let endDate = customer?.end_date ? toVnZeroHour(customer.end_date) : null;
  
  // Fallback calculation if end_date is missing but start_date and duration exist
  if (!endDate && customer?.start_date && customer?.duration_days) {
    const start = toVnZeroHour(customer.start_date);
    endDate = new Date(start.getTime() + (customer.duration_days * 24 * 60 * 60 * 1000));
  }

  const isExpiredByDate = endDate ? today >= endDate : false;

  // Logic: Nếu bị xóa thì là DELETED, nếu hết hạn theo ngày hoặc theo state thì là EXPIRED, còn lại là ACTIVE
  let accessState = customer?.access_state || "ACTIVE";
  if (customer?.status === CustomerStatus.DELETED) {
    accessState = "DELETED";
  } else if (isExpiredByDate || accessState === "EXPIRED") {
    accessState = "EXPIRED";
  }

  const isBlocked = accessState === "DELETED" || accessState === "EXPIRED";
  const showAdminUI = !!onNavigate;

  const handleDownloadPhacdoInfo = () => {
    const dbToken = (customer?.token || token || '').trim();
    const dbCustomerId = customer?.customer_id || customerId;
    const link = generateCustomerLink(dbCustomerId, dbToken);
    const text = [
      `Học viên: ${customer?.customer_name || ''}`,
      `ID: ${dbCustomerId}`,
      `Link phác đồ (học viên): ${link}`,
      `Xuất lúc: ${new Date().toLocaleString('vi-VN')}`
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phac-do-${dbCustomerId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderAdminHeader = () => {
    if (!showAdminUI) return null;

    return (
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-white border-b-2 border-blue-100 px-4 py-3 shadow-xl flex items-center justify-center">
        <div className="w-full max-w-[1200px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => onNavigate!('dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600 shrink-0" aria-label="Quay lại">
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-sm sm:text-base font-black text-[#1E3A8A] tracking-tight uppercase truncate">
              {customer
                ? `${customer.customer_name || ''}${customer.start_date ? ` – ${formatDDMMYYYY(customer.start_date)}` : ''}`.trim() || 'Xem trước phác đồ'
                : 'Xem trước phác đồ'}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 relative shrink-0">
            {copyToast && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black py-1 px-3 rounded-lg shadow-lg whitespace-nowrap">
                ĐÃ COPY LINK!
              </div>
            )}
            <button
              type="button"
              onClick={handleDownloadPhacdoInfo}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center hover:bg-blue-100 transition-all active:scale-95"
              title="Tải thông tin / link (file .txt)"
            >
              <ArrowDownToLine size={18} />
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center hover:bg-blue-100 transition-all active:scale-95"
              title="Sao chép link gửi học viên (domain phacdo4)"
            >
              <Copy size={18} />
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-orange-50 text-orange-600 border border-orange-100/80 flex items-center justify-center hover:bg-orange-100 transition-all active:scale-95"
              title="Nhân bản / tạo từ mẫu"
            >
              <CopyPlus size={18} />
            </button>
            <button
              type="button"
              onClick={() => customer && onNavigate!('plan-editor', { customerId: customer.customer_id })}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-green-50 text-green-600 border border-green-100/80 flex items-center justify-center hover:bg-green-100 transition-all active:scale-95 disabled:opacity-40"
              disabled={!customer}
              title="Chỉnh sửa phác đồ"
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate!('dashboard')}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-50 text-slate-500 border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
              title="Đóng xem trước"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#F8FBFF] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center mb-8 shadow-xl text-4xl">
          🚫
        </div>
        <h2 className="text-2xl font-black text-[#1E3A8A] mb-4 tracking-tight uppercase">
          TRUY CẬP BỊ TỪ CHỐI
        </h2>
        <p className="text-gray-500 mb-10 max-w-sm text-[16px] leading-relaxed font-medium">
          Liên kết không hợp lệ hoặc thiếu mã truy cập. Vui lòng sử dụng liên kết chính thức được cung cấp bởi MeGa Phương.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => fetchData(false)} 
            className="bg-blue-600 text-white font-bold py-4 px-12 rounded-full shadow-lg uppercase text-[12px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} /> Thử lại ngay
          </button>
          <a href="https://zalo.me/0378243131" target="_blank" className="bg-[#0068ff] text-white font-bold py-4 px-12 rounded-full shadow-lg uppercase text-[12px] tracking-widest transition-all active:scale-95 text-center">
            💬 Hỗ trợ qua Zalo
          </a>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="min-h-screen bg-[#F8FBFF] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center mb-8 shadow-xl text-4xl">
          📡
        </div>
        <h2 className="text-2xl font-black text-[#1E3A8A] mb-4 tracking-tight uppercase">
          LỖI KẾT NỐI
        </h2>
        <p className="text-gray-500 mb-10 max-w-sm text-[16px] leading-relaxed font-medium">
          {error}
        </p>
        <button 
          onClick={() => fetchData(false)} 
          className="bg-blue-600 text-white font-bold py-4 px-12 rounded-full shadow-lg uppercase text-[12px] tracking-widest transition-all active:scale-95 flex items-center gap-2"
        >
          <RefreshCw size={16} /> Thử lại ngay
        </button>
      </div>
    );
  }

  if (isBlocked && !onNavigate) {
    return (
      <div className="min-h-screen bg-[#F8FBFF] flex flex-col items-center justify-center p-6 text-center">
        {renderAdminHeader()}
        <div className={`flex flex-col items-center ${showAdminUI ? 'mt-20' : ''}`}>
          <div className="w-16 h-16 bg-white rounded-[22px] flex items-center justify-center mb-6 shadow-xl text-3xl">
            {accessState === "DELETED" ? "🔒" : "⌛"}
          </div>
          <h2 className="text-xl font-black text-[#1E3A8A] mb-3 tracking-tight uppercase">
            {accessState === "DELETED" ? "PHÁC ĐỒ ĐÃ KHÓA" : "PHÁC ĐỒ HẾT HẠN"}
          </h2>
          <p className="text-gray-500 mb-8 max-w-sm text-[15px] leading-relaxed font-medium">
            {accessState === "DELETED" 
              ? "Tài khoản hiện đang tạm khóa, vui lòng liên hệ với MeGa Phương để được hỗ trợ nhé!" 
              : `Phác đồ cá nhân của bạn đã hết thời hạn sử dụng. Hãy liên hệ với MeGa Phương để gia hạn và tiếp tục hành trình trẻ hóa nhé! (Ngày hết hạn: ${formatDDMMYYYY(customer?.end_date)})`}
          </p>
          <a href="https://zalo.me/0378243131" target="_blank" className="bg-[#0068ff] text-white font-bold py-4 px-10 rounded-full shadow-lg uppercase text-[12px] tracking-widest">
            💬 Liên hệ qua Zalo
          </a>
        </div>
      </div>
    );
  }

  if (!customer) return null;
  const startDate = toVnZeroHour(customer.start_date);
  const allowedDay = customer.allowed_day || getDiffDays(startDate, today) + 1;
  const isNotStarted = allowedDay < 1;
  const sidebarBlocks = customer.sidebar_blocks_json || customer.blocks || [];

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-[#1E3A8A] font-['Plus_Jakarta_Sans',sans-serif]">
      {isRefreshing && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[6000] bg-[#1E3A8A] text-white px-6 py-2 rounded-full text-xs font-bold shadow-xl animate-bounce">
          🔄 Đang đồng bộ phác đồ mới nhất...
        </div>
      )}

      {renderAdminHeader()}
      
      {/* Cảnh báo sắp hết hạn */}
      {(() => {
        if (!endDate) return null;
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (isBlocked) {
          return (
            <div className="bg-red-600 text-white px-4 py-3 text-center font-bold text-sm sticky top-0 z-[4000] shadow-md flex items-center justify-center gap-2">
              <AlertTriangle size={18} />
              CẢNH BÁO: PHÁC ĐỒ NÀY ĐÃ HẾT HẠN SỬ DỤNG ({formatDDMMYYYY(endDate)})
            </div>
          );
        }

        if (diffDays > 0 && diffDays <= 5) {
          return (
            <div className="bg-orange-500 text-white px-4 py-3 text-center font-bold text-sm animate-pulse sticky top-0 z-[4000] shadow-md flex items-center justify-center gap-2">
              <AlertTriangle size={18} />
              THÔNG BÁO: PHÁC ĐỒ CỦA BẠN SẼ HẾT HẠN TRONG {diffDays} NGÀY TỚI. HÃY LIÊN HỆ GIA HẠN NHÉ!
            </div>
          );
        }
        return null;
      })()}

      {/* Copy Toast Notification */}
      {copyToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] bg-green-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2">
          <CheckCircle size={18} /> ĐÃ COPY LINK PHÁC ĐỒ!
        </div>
      )}

      <div className={`${showAdminUI ? 'pt-28' : 'pt-10'} max-w-[1200px] mx-auto px-4 pb-20`}>
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-[#1E3A8A] mb-4 tracking-tight leading-tight uppercase">{customer.app_title || "Phác đồ 30 ngày thay đổi khuôn mặt"}</h1>
          <p className="text-blue-500 opacity-80 max-w-2xl mx-auto italic mb-10">"{customer.app_slogan || "Hành trình đánh thức vẻ đẹp tự nhiên, gìn giữ thanh xuân."}"</p>
          <div className="inline-flex items-center gap-2 bg-white px-6 py-2.5 rounded-full border border-blue-100 text-[#2563EB] font-bold text-xs uppercase tracking-widest shadow-sm">
            <Calendar size={14} /> BẮT ĐẦU: {formatDDMMYYYY(customer.start_date)} ĐẾN: {formatDDMMYYYY(endDate)}
          </div>
          <p className="mt-4 text-[10px] md:text-[11px] font-bold text-blue-400 uppercase tracking-wider max-w-2xl mx-auto leading-relaxed px-4">
            Sau thời gian trên, vui lòng liên hệ để gia hạn và tiếp tục luyện tập. Hãy duy trì sự kiên trì và đều đặn mỗi ngày để đạt kết quả tốt nhất nhé!
          </p>
        </header>

        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-blue-100 mb-10">
           <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-green-600 uppercase tracking-widest">Học viên:</span>
              <div className="text-xl font-black text-[#1E3A8A] uppercase tracking-tight">{customer.customer_name}</div>
           </div>
           <div className="text-[11px] font-black text-green-600 uppercase tracking-widest mb-6 border-b border-blue-50 pb-2 block w-full">PHÂN TÍCH & MONG MUỐN</div>
           <div className="text-[#1E3A8A] leading-relaxed text-base md:text-lg font-medium whitespace-pre-line text-justify">
             {customer.note && String(customer.note).toUpperCase() !== "NULL" && String(customer.note).trim() !== "" && String(customer.note).trim() !== "undefined"
               ? customer.note 
               : "Hệ thống đang cập nhật nội dung..."}
           </div>
        </section>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-80 flex flex-col gap-6 flex-shrink-0">
             <div className="bg-[#1E3A8A] text-white rounded-[2.5rem] p-8 shadow-xl">
                <h3 className="text-lg font-black mb-4 border-b border-white/10 pb-3 flex items-center gap-2 uppercase tracking-wide">Ăn Nhai Cân Bằng</h3>
                <p className="text-sm leading-relaxed opacity-90 text-justify whitespace-pre-line font-medium">
                  {customer.chewing_status && String(customer.chewing_status).toUpperCase() !== "NULL" && String(customer.chewing_status).trim() !== "" 
                    ? customer.chewing_status 
                    : "Đang cập nhật chỉ dẫn ăn nhai..."}
                </p>
             </div>
             
             {sidebarBlocks.map((block: any) => (
               <div key={block.id} className={`rounded-[2.5rem] p-8 border transition-all ${block.type === 'dark' ? 'bg-[#1E3A8A] text-white border-transparent' : 'bg-white border-blue-50 shadow-sm text-[#1E3A8A]'}`}>
                 <h3 className={`text-lg font-black mb-4 border-b pb-3 flex items-center gap-2 uppercase tracking-wide ${block.type === 'dark' ? 'border-white/10' : 'border-blue-50'}`}>{block.title}</h3>
                 <p className={`text-sm leading-relaxed mb-6 whitespace-pre-line font-medium text-justify ${block.type === 'dark' ? 'text-white/90' : 'text-blue-800'}`}>{block.content}</p>
                 
                 {block.is_chat ? (
                    <button onClick={() => setIsImmersiveOpen(true)} className={`w-full py-4 rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 ${block.type === 'dark' ? 'bg-white text-[#1E3A8A] hover:bg-blue-50' : 'bg-[#1E3A8A] text-white hover:bg-blue-900'}`}>💬 Chat cùng chuyên gia</button>
                 ) : block.video_link ? (
                    <button onClick={() => {
                        if (isAdmin && (checkPermission ? !checkPermission('view_video') : adminRole === 'qlhv')) {
                            setInfoModal({
                                isOpen: true,
                                title: "BỊ TỪ CHỐI",
                                message: "Bạn không có quyền xem video của học viên.",
                                type: "WARNING",
                                color: "red"
                            });
                            return;
                        }
                        let finalUrl = block.video_link;
                        if (finalUrl && typeof finalUrl === 'string') {
                            finalUrl = finalUrl.replace('vz-371142c2-906.b-cdn.net', 'video.phacdo.com');
                        }
                        if (finalUrl && typeof finalUrl === 'string' && (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be'))) {
                            handlePlayVideo(finalUrl, false, 0);
                        } else {
                            window.open(finalUrl, '_blank');
                        }
                    }} className={`w-full py-3.5 text-[11px] font-black rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 ${block.type === 'dark' ? 'bg-white text-[#1E3A8A] hover:bg-blue-50' : 'bg-[#1E3A8A] text-white hover:bg-blue-900'}`}>▶ Xem hướng dẫn video</button>
                 ) : null}
               </div>
             ))}

             {(() => {
                const start = parseVNDate(customer.start_date);
                if (!start) return null;

                const diffDays = getDiffDays(start, today) + 1;
                const cycle = Math.max(0, Math.floor((diffDays - 1) / 60));
                const cycleStartDate = addDays(start, cycle * 60);

                // Tính toán số liệu chuyên cần trong chu kỳ hiện tại
                const completedDays = customer.raw_backup?.completed_days || [];
                let attendedCount = 0;
                let missedCount = 0;
                const currentDayInCycle = Math.min(60, Math.max(1, getDiffDays(cycleStartDate, today) + 1));

                for (let i = 1; i <= currentDayInCycle; i++) {
                  if (completedDays.includes(i)) {
                    attendedCount++;
                  } else if (i < currentDayInCycle) {
                    missedCount++;
                  }
                }

                // Tạo nhận xét đánh giá
                let assessment = "";
                if (currentDayInCycle > 0) {
                  const rate = attendedCount / (attendedCount + missedCount || 1);
                  let encouragement = "";
                  if (rate >= 0.8) encouragement = "Mức độ chuyên cần tuyệt vời! Hãy tiếp tục phát huy nhé! 🔥";
                  else if (rate >= 0.5) encouragement = "Bạn đang làm khá tốt, hãy cố gắng đều đặn hơn nữa nhé! 💪";
                  else encouragement = "Hãy dành thời gian tập luyện đều đặn hơn để đạt hiệu quả tốt nhất bạn nhé! Cố lên nào! ✨";
                  
                  assessment = `Bạn đã tham gia ${attendedCount} buổi, vắng ${missedCount} buổi. Bạn đang ở ngày thứ ${currentDayInCycle} của lộ trình. ${encouragement}`;
                }

                return (
                  <div 
                    className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-blue-50 text-[#1E3A8A] cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setIsAttendanceExpanded(!isAttendanceExpanded)}
                  >
                    <h3 className="text-lg font-black flex items-center justify-between uppercase tracking-wide">
                      <span className="flex items-center gap-2">Theo dõi Chuyên cần</span>
                      {isAttendanceExpanded ? <ChevronUp size={20} className="text-blue-400" /> : <ChevronDown size={20} className="text-blue-400" />}
                    </h3>
                    
                    {isAttendanceExpanded && (
                      <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] text-gray-500 font-bold mb-4 uppercase tracking-widest text-center">
                          Chu kỳ {cycle + 1} (60 ngày)
                          {assessment && <div className="mt-2 text-[11px] text-blue-600 normal-case font-medium leading-relaxed italic px-4">{assessment}</div>}
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: 60 }, (_, i) => i + 1).map(day => {
                            const actualDate = addDays(cycleStartDate, day - 1);
                            const isFuture = actualDate > today;
                            const isToday = actualDate.getTime() === today.getTime();
                            
                            let status: 'none' | 'check' | 'cross' = 'none';
                            if (day <= currentDayInCycle) {
                              if (completedDays.includes(day)) {
                                status = 'check';
                              } else if (day < currentDayInCycle) {
                                status = 'cross';
                              }
                            }

                            let cellClass = 'bg-blue-50/50 border-blue-100/50 text-blue-900';
                            if (status === 'check') {
                              cellClass = 'bg-green-500 border-green-600 text-white font-bold';
                            } else if (status === 'cross') {
                              cellClass = 'bg-red-500 border-red-600 text-white font-bold';
                            } else if (isToday) {
                              cellClass = 'bg-[#E0F2FE] border-blue-300 text-blue-600 font-bold';
                            }

                            return (
                              <div 
                                key={day} 
                                className={`flex flex-col items-center justify-center h-10 rounded-lg relative border transition-colors ${cellClass}`}
                                title={isToday ? "Ngày học hiện tại" : status === 'check' ? "Đã học" : status === 'cross' ? "Chưa học" : undefined}
                              >
                                <span className="text-[10px] font-black">{day}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
             })()}
          </aside>


          <section className="flex-1">
             <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-blue-50 shadow-sm">
                <h2 className="text-2xl font-black text-center mb-10 uppercase tracking-tight text-[#1E3A8A] flex items-center justify-center gap-2">
                   Lịch học chi tiết
                   {isVerified && (
                     <button 
                       onClick={() => {
                         if(confirm("Bạn muốn đăng xuất khỏi Email hiện tại để xác thực lại?")) {
                           localStorage.removeItem(`verified_email_${customerId}`);
                           setIsVerified(false);
                           setToast("Đã đăng xuất! Vui lòng đăng nhập lại để xem video.");
                         }
                       }}
                       className="p-1.5 hover:bg-slate-50 rounded-full text-slate-300 hover:text-red-500 transition-all"
                       title="Đăng xuất / Thay đổi Email"
                     >
                       <LogOut size={20} />
                     </button>
                   )}
                </h2>
                <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center mb-10">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tight text-[#2563EB]"><div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></div> Bài bắt buộc</div>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tight text-[#10B981]"><div className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></div> Bài bổ trợ</div>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tight text-[#2563EB]"><div className="w-4 h-4 rounded-md border-2 border-[#2563EB]"></div> Đang học</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" ref={gridRef}>
                  {Array.from({ length: Math.min(customer.duration_days || 30, 30) }, (_, i) => i + 1).map(day => {
                    const isLocked = day > allowedDay || isNotStarted;
                    const isUnlocked = day <= allowedDay;
                    const isActive = day === allowedDay && !isNotStarted;
                    const dayTasks = tasks
                      .filter(t => t.day === day)
                      .sort((a, b) => (a.title || "").localeCompare(b.title || "", 'vi', { numeric: true }));
                    
                    // Kiểm tra xem ngày này đã học chưa
                    const isAttended = (customer.raw_backup?.completed_days || []).includes(day);
                    
                    // Hiển thị đến ngày hiện tại + 1 (ngày hôm sau), luôn hiện ngày 1 nếu chưa bắt đầu
                    const shouldHide = day > Math.max(1, allowedDay + 1);
                    if (shouldHide) return null;

                    return (
                      <div 
                        key={day} 
                        onClick={() => { if(dayTasks.length === 0) handleTaskClick({day} as any) }} 
                        className={`bg-white rounded-3xl border p-6 transition-all cursor-pointer hover:border-blue-300 ${isActive ? 'border-blue-600 ring-4 ring-blue-50 day-card-active' : 'border-blue-50'}`}
                      >
                        <div className={`flex items-center justify-center gap-1.5 text-center font-black text-xs border-b mb-4 pb-2 uppercase tracking-widest ${isUnlocked && !isNotStarted ? 'text-blue-600' : 'text-gray-400'}`}>
                          Ngày {day}
                          {isAttended && <CheckCircle size={14} className="text-green-500" strokeWidth={3} />}
                        </div>
                        {dayTasks.length > 0 ? dayTasks.map((t, idx) => (
                          <button 
                            key={idx} 
                            onClick={(e) => { e.stopPropagation(); handleTaskClick(t); }} 
                            className="w-full text-center py-2.5 text-[13px] font-bold hover:bg-blue-50 rounded-xl transition-colors mb-1" 
                            style={{ color: isLocked ? '#9CA3AF' : (isMandatory(t) ? '#2563EB' : '#10B981') }}
                          >
                            {t.title}
                          </button>
                        )) : <div className="text-center text-[10px] text-gray-300 font-bold uppercase italic py-4">Nghỉ ngơi</div>}
                      </div>
                    );
                  })}
                </div>
             </div>
          </section>
        </div>
      </div>

      {/* Floating Action Buttons for Students */}
      {!showAdminUI && (
        <div className="fixed bottom-6 right-6 z-[5000] flex flex-col gap-3">
          <button 
            onClick={() => window.print()}
            className="w-14 h-14 bg-white text-blue-600 border-2 border-blue-100 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all active:scale-95 group"
            title="In phác đồ"
          >
            <ArrowDownToLine size={24} />
            <span className="absolute right-16 bg-white text-[#1E3A8A] px-3 py-1 rounded-lg text-[10px] font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-blue-50">IN PHÁC ĐỒ</span>
          </button>
        </div>
      )}

      {isImmersiveOpen && <ImmersiveChat onClose={() => setIsImmersiveOpen(false)} />}

      {selectedTask && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTask(null)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-300">
             <div className="p-8 border-b bg-blue-50 flex items-center justify-between">
                <div><div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Ngày {selectedTask.day} • {selectedTask.type}</div><h3 className="text-xl font-black text-[#1E3A8A]">{selectedTask.title}</h3></div>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-blue-100 rounded-full text-[#1E3A8A] transition-colors"><X size={24}/></button>
             </div>
             <div className="p-8 max-h-[50vh] overflow-y-auto whitespace-pre-line text-base text-gray-700 leading-relaxed font-medium text-justify custom-scrollbar">{selectedTask.detail}</div>
             <div className="p-8 pt-0">{selectedTask.link && <button onClick={() => handlePlayVideo(selectedTask.link, false, selectedTask.day)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-full shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all hover:bg-blue-700 active:scale-95">▶ Xem hướng dẫn bài tập</button>}</div>
          </div>
        </div>
      )}

      {infoModal?.isOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setInfoModal(null)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 relative z-10 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 ${infoModal.type === 'WARNING' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-600'}`}><AlertTriangle size={32}/></div>
            <h3 className="text-xl font-black mb-3 text-[#1E3A8A] uppercase tracking-tight">{infoModal.title}</h3>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">{infoModal.message}</p>
            <button onClick={() => { if (infoModal.onConfirm) infoModal.onConfirm(); else setInfoModal(null); }} className="w-full py-4 bg-[#1E3A8A] text-white font-bold rounded-full uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95">{infoModal.confirmText ? infoModal.confirmText : (infoModal.type === 'WARNING' ? 'Tôi đã hiểu' : 'Đã hiểu')}</button>
          </div>
        </div>
      )}
      
      {/* 🚀 MÀN HÌNH CHẶN ZALO IOS */}
      {isZalo && !onNavigate && (
        <div className="fixed inset-0 z-[9999] bg-[#1E3A8A] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="text-6xl mb-6 animate-bounce">↗️</div>
          <h2 className="text-2xl font-black mb-4 uppercase">Mở Trình Duyệt Để Tiếp Tục</h2>
          <p className="text-lg opacity-90 mb-8 max-w-sm leading-relaxed">
            Hệ thống phát hiện bạn đang dùng trình duyệt nội bộ của Zalo/Facebook.<br/><br/>
            Vui lòng nhấn vào biểu tượng <b>( ••• )</b> ở góc phải trên cùng màn hình và chọn <b>"Mở bằng Trình duyệt" (Open in Safari/Chrome)</b> để xem video trơn tru nhé!
          </p>
        </div>
      )}

      {/* 🚀 MODAL XÁC THỰC EMAIL 1 LẦN DUY NHẤT */}
      {authModal.isOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setAuthModal({isOpen: false, link: null}); setSelfApprovalCode(''); setSelfApprovalError(''); }}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center">
            <button onClick={() => { setAuthModal({isOpen: false, link: null}); setSelfApprovalCode(''); setSelfApprovalError(''); }} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800"><X size={20}/></button>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><User size={32}/></div>
            
            {customer?.email && lastLoggedEmail && lastLoggedEmail !== customer.email.toLowerCase().trim() ? (
              /* ❌ TRƯỜNG HỢP EMAIL KHÔNG KHỚP */
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-black text-red-600 mb-2 uppercase tracking-tight">EMAIL ĐĂNG NHẬP KHÔNG KHỚP</h3>
                  <div className="text-gray-600 text-[13px] font-medium leading-relaxed space-y-4">
                    <div>
                      <p>Tài khoản đã đăng ký mở phác đồ của bạn là:</p>
                      <p className="font-black text-blue-900 bg-blue-50 py-2 px-4 rounded-xl mt-1 break-all">{customer.email}</p>
                    </div>
                    <p>Vui lòng đăng nhập lại bằng đúng email.</p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👉</span>
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        const jwt = credentialResponse.credential;
                        if (!jwt) return;
                        const decoded = jwtDecode<{email: string}>(jwt);
                        const loggedEmail = decoded.email.toLowerCase().trim();
                        const existingEmail = (customer.email || "").toLowerCase().trim();
                        
                        if (loggedEmail === existingEmail) {
                          safeSetLocalStorage(`verified_email_${customerId}`, loggedEmail);
                          setIsVerified(true);
                          setLastLoggedEmail(null);
                          setAuthModal(prev => {
                            if (prev.link) {
                              if (prev.link.includes('mediadelivery.net')) {
                                setPlayingVideo(prev.link);
                              } else {
                                window.open(prev.link, '_blank');
                              }
                              customerService.logVideoOpen(customerId!, customer?.token || token || '', prev.day);
                              markAttendanceLocally(prev.day);
                            }
                            return {isOpen: false, link: null, day: undefined};
                          });
                        } else {
                          setLastLoggedEmail(loggedEmail);
                        }
                      }}
                      onError={() => {
                        setInfoModal({isOpen: true, title: "Lỗi Kết Nối", message: "Kết nối tới máy chủ Google thất bại. Vui lòng thử lại!", type: "WARNING", color: "red"});
                      }}
                      theme="outline"
                      shape="rectangular"
                      size="large"
                      text="continue_with"
                      width="100%"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="text-gray-600 text-[13px] font-medium leading-relaxed mb-4">
                    <p>Hoặc bạn muốn đổi sang email này?</p>
                    <p className="font-black text-orange-600 bg-orange-50 py-2 px-4 rounded-xl mt-1 break-all">{lastLoggedEmail}</p>
                  </div>
                  <button 
                    disabled={isRequestingEmail}
                    onClick={async () => {
                      const existingEmail = (customer.email || "").toLowerCase().trim();
                      setIsRequestingEmail(true);
                      try {
                        const result = await customerService.requestEmailChange(customer.customer_id, lastLoggedEmail!, (customer.token || token || ""));
                        if (result && (result as any).success === false) {
                          throw new Error((result as any).message || 'Unauthorized');
                        }
                        localStorage.removeItem(`verified_email_${customerId}`);
                        setIsVerified(false);
                        setCustomer((prev: any) => ({ ...prev, pending_email: lastLoggedEmail }));
                        setToast("Gửi yêu cầu đổi Email thành công!");
                        const msg = `Chào Admin, em là ${customer?.customer_name || ''}, em vừa gửi yêu cầu đổi Email đăng ký cho phác đồ của em (Mã HV: ${customerId}).\n- Email cũ: ${existingEmail}\n- Email mới: ${lastLoggedEmail}\nNhờ Admin duyệt giúp em ạ!`;
                        window.open(`https://zalo.me/0378243131?text=${encodeURIComponent(msg)}`, '_blank');
                        setAuthModal({isOpen: false, link: null});
                        setSelfApprovalCode(''); setSelfApprovalError('');
                      } catch(e: any) { 
                        console.error("Email Change Error:", e);
                        alert(`Gửi yêu cầu thất bại: ${e.message || 'Lỗi hệ thống'}. Vui lòng liên hệ trực tiếp qua Zalo!`);
                      }
                      finally { setIsRequestingEmail(false); }
                    }}
                    className="bg-orange-500 text-white w-full py-4 rounded-full font-black shadow-lg hover:bg-orange-600 transition-all disabled:opacity-50 text-[12px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <span>👉</span> GỬI YÊU CẦU ĐỔI EMAIL
                  </button>

                  {/* THÊM TỰ PHÊ DUYỆT BẰNG MÃ XÁC THỰC - EMAIL */}
                  <div className="mt-4 pt-4 border-t border-gray-100/50">
                    <p className="text-[12px] font-bold text-gray-700 mb-2">Nhập mã xác thực</p>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={selfApprovalCode}
                         onChange={(e) => setSelfApprovalCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                         placeholder="Mã số"
                         className="flex-1 bg-gray-50 border border-gray-200 text-center text-lg font-bold rounded-xl tracking-[0.2em] outline-none focus:border-blue-500 focus:bg-blue-50 transition-all text-[#1E3A8A]"
                         disabled={selfApprovalLoading}
                       />
                       <button
                         disabled={selfApprovalCode.length < 5 || selfApprovalLoading}
                         onClick={async () => {
                            setSelfApprovalLoading(true);
                            setSelfApprovalError('');
                            const res = await customerService.verifySelfApprovalCode({
                               customer_id: customer.customer_id,
                               type: 'email',
                               code: selfApprovalCode,
                               old_email: (customer.email || "").toLowerCase().trim(),
                               new_email: lastLoggedEmail!,
                               token: (customer.token || token || "")
                            });
                            setSelfApprovalLoading(false);
                            if (res.success) {
                               setToast('Duyệt email thành công!');
                               safeSetLocalStorage(`verified_email_${customerId}`, lastLoggedEmail!);
                               setIsVerified(true);
                               setCustomer({ ...customer, email: lastLoggedEmail! });
                               setLastLoggedEmail(null);
                               
                               const linkToPlay = authModal.link;
                               const dayToPlay = authModal.day;
                               setAuthModal({isOpen: false, link: null, day: undefined});
                               if (linkToPlay) {
                                  handlePlayVideo(linkToPlay, true, dayToPlay);
                               }
                               
                               setSelfApprovalCode(''); setSelfApprovalError('');
                            } else {
                               setSelfApprovalError(res.message || 'Mã xác thực của bạn không đúng, hãy liên hệ để được trợ giúp.');
                               setSelfApprovalCode('');
                            }
                         }}
                         className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl uppercase tracking-wider text-xs shadow-md disabled:bg-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                       >
                         {selfApprovalLoading ? '...' : 'Gửi'}
                       </button>
                    </div>
                    {selfApprovalError && (
                      <div className="mt-3 flex flex-col gap-2">
                         <p className="text-red-500 text-[11px] font-medium leading-tight">{selfApprovalError}</p>
                         <a href="https://zalo.me/0378243131" target="_blank" className="mx-auto mt-1 bg-[#0068ff] text-white text-[11px] font-bold py-2 px-6 rounded-lg flex items-center justify-center shadow-sm w-max">
                            💬 Liên hệ Zalo
                         </a>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* ✅ TRƯỜNG HỢP XÁC THỰC BAN ĐẦU */
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-black text-[#1E3A8A] mb-2 uppercase tracking-tight">XÁC THỰC TÀI KHOẢN</h3>
                  <p className="text-gray-600 text-[14px] font-bold">
                    Nhấn “Tiếp tục” để truy cập phác đồ.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center w-full min-h-[44px] mb-4">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">👉</span>
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        const jwt = credentialResponse.credential;
                        if (!jwt) return;
                        const decoded = jwtDecode<{email: string}>(jwt);
                        const loggedEmail = decoded.email.toLowerCase().trim();
                        const existingEmail = (customer.email || "").toLowerCase().trim();
                        
                        if (!existingEmail) {
                          // Giai đoạn Đăng ký ban đầu
                          try {
                            await customerService.updateCustomerEmailByToken(customer.customer_id, (customer.token || token || ""), loggedEmail);
                            safeSetLocalStorage(`verified_email_${customerId}`, loggedEmail);
                          setIsVerified(true);
                          setCustomer({ ...customer, email: loggedEmail });
                          setLastLoggedEmail(null);
                          
                          const linkToPlay = authModal.link;
                          const dayToPlay = authModal.day;
                          setAuthModal({isOpen: false, link: null, day: undefined});
                          if (linkToPlay) {
                             handlePlayVideo(linkToPlay, true, dayToPlay);
                          }
                          
                        } catch (e) {
                          console.error("Auto enrollment failed:", e);
                          setInfoModal({isOpen: true, title: "Lỗi Hệ Thống", message: "Không thể tự động lưu Email. Vui lòng liên hệ Admin!", type: "WARNING", color: "red"});
                        }
                      } else if (loggedEmail === existingEmail) {
                        safeSetLocalStorage(`verified_email_${customerId}`, loggedEmail);
                        setIsVerified(true);
                        setLastLoggedEmail(null);
                        
                        const linkToPlay = authModal.link;
                        const dayToPlay = authModal.day;
                        setAuthModal({isOpen: false, link: null, day: undefined});
                        if (linkToPlay) {
                           handlePlayVideo(linkToPlay, true, dayToPlay);
                        }
                        
                        } else {
                          setLastLoggedEmail(loggedEmail);
                        }
                      }}
                      onError={() => {
                        setInfoModal({isOpen: true, title: "Lỗi Kết Nối", message: "Kết nối tới máy chủ Google thất bại. Vui lòng thử lại!", type: "WARNING", color: "red"});
                      }}
                      theme="outline"
                      shape="rectangular"
                      size="large"
                      text="continue_with"
                      width="100%"
                    />
                  </div>
                </div>

                <p className="text-gray-500 text-[12px] font-medium leading-relaxed mb-8">
                  Mỗi học viên chỉ sử dụng 1 tài khoản Google cho 1 phác đồ
                </p>

                <div className="text-[11px] text-gray-400 font-medium text-center border-t border-gray-100 pt-6">
                  Bạn cần hỗ trợ? <a href="https://zalo.me/0378243131" target="_blank" className="text-blue-600 hover:underline font-bold">Liên hệ Zalo</a>.
                </div>
              </>
            )}

           </div>
         </div>
       )}

      {/* 🚀 MÀN HÌNH CHẶN THIẾT BỊ (Device Limit) */}
      {deviceModal?.isOpen && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDeviceModal(null); setSelfApprovalCode(''); setSelfApprovalError(''); }}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">🚫</div>
            <h3 className="text-xl font-black mb-3 text-[#1E3A8A] uppercase italic">Thiết bị không được phép</h3>
            <p className="text-gray-500 mb-8 text-[14px] font-medium leading-relaxed">
              Thiết bị này của bạn không được phép truy cập, bạn chỉ được mở bài học trên các thiết bị trước đó.<br/><br/>
              Nếu muốn mở trên thiết bị mới, hãy ấn nút <b>'Liên hệ'</b> để đăng ký sử dụng.
            </p>
            
            <div className="flex gap-3">
               <button 
                  onClick={() => { setDeviceModal(null); setSelfApprovalCode(''); setSelfApprovalError(''); }} 
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-full uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95"
               >
                 Đóng
               </button>
               <button 
                  onClick={async () => {
                    if (customerId && token && deviceId) {
                       setIsRequestingApproval(true);
                       try {
                          const deviceName = `${navigator.platform} - ${window.screen.width}x${window.screen.height}`;
                          await customerService.requestDeviceApproval(customerId, token, deviceId, deviceName);
                          // Mở Zalo với tin nhắn mẫu giúp Admin dễ duyệt
                          const msg = `Chào Admin, em là ${customer?.customer_name || ''}, em vừa gửi yêu cầu duyệt thiết bị mới cho phác đồ của em (Mã HV: ${customerId}). Nhờ Admin duyệt giúp em ạ!`;
                          window.open(`https://zalo.me/0378243131?text=${encodeURIComponent(msg)}`, '_blank');
                       } catch(e) { console.error(e); }
                       finally { setIsRequestingApproval(false); }
                    }
                  }} 
                  disabled={isRequestingApproval}
                  className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-full uppercase text-xs tracking-widest shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:bg-blue-300"
               >
                 {isRequestingApproval ? 'Đang gửi...' : 'Liên hệ'}
               </button>
            </div>

            {/* THÊM TỰ PHÊ DUYỆT BẰNG MÃ XÁC THỰC - THIẾT BỊ */}
            <div className="mt-5 pt-5 border-t border-gray-100">
               <p className="text-[12px] font-bold text-gray-700 mb-2">Nhập mã xác thực</p>
               <div className="flex gap-2">
                  <input 
                     type="text" 
                     value={selfApprovalCode}
                     onChange={(e) => setSelfApprovalCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                     placeholder="Mã số"
                     className="flex-1 bg-gray-50 border border-gray-200 text-center text-lg font-bold rounded-xl tracking-[0.2em] outline-none focus:border-blue-500 focus:bg-blue-50 transition-all text-[#1E3A8A]"
                     disabled={selfApprovalLoading}
                  />
                  <button
                     disabled={selfApprovalCode.length < 5 || selfApprovalLoading}
                     onClick={async () => {
                        if (!customerId || !token || !deviceId) return;
                        setSelfApprovalLoading(true);
                        setSelfApprovalError('');
                        const deviceName = `${navigator.platform} - ${window.screen.width}x${window.screen.height}`;
                        const res = await customerService.verifySelfApprovalCode({
                           customer_id: customerId,
                           type: 'device',
                           code: selfApprovalCode,
                           device_id: deviceId,
                           device_name: deviceName,
                           token: token
                        });
                        setSelfApprovalLoading(false);
                        if (res.success) {
                           setToast('Duyệt thiết bị thành công!');
                           setDeviceAuthorized(true);
                           setDeviceModal(null);
                           setSelfApprovalCode(''); setSelfApprovalError('');
                        } else {
                           setSelfApprovalError(res.message || 'Mã xác thực của bạn không đúng, hãy liên hệ để được trợ giúp.');
                           setSelfApprovalCode('');
                        }
                     }}
                     className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl uppercase tracking-wider text-xs shadow-md disabled:bg-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                  >
                     {selfApprovalLoading ? '...' : 'Gửi'}
                  </button>
               </div>
               {selfApprovalError && (
                 <div className="mt-3 flex flex-col gap-2">
                    <p className="text-red-500 text-[11px] font-medium leading-tight">{selfApprovalError}</p>
                    <a href="https://zalo.me/0378243131" target="_blank" className="mx-auto mt-1 bg-[#0068ff] text-white text-[11px] font-bold py-2 px-6 rounded-lg flex items-center justify-center shadow-sm w-max">
                       💬 Liên hệ Zalo
                    </a>
                 </div>
               )}
            </div>

          </div>
        </div>
      )}

      {/* 🚀 THE BUNNY FULLSCREEN VIDEO MODAL */}
      {playingVideo && (
         <div id="bunny-fullscreen-modal" className="fixed inset-0 z-[9000] bg-black flex flex-col animate-in fade-in duration-300" onMouseMove={() => {
            const btn = document.getElementById('bunny-close-btn');
            if (btn) {
               btn.style.opacity = '1';
               btn.style.pointerEvents = 'auto';
               if ((window as any).bunnyCloseTimeout) clearTimeout((window as any).bunnyCloseTimeout);
               (window as any).bunnyCloseTimeout = setTimeout(() => {
                  btn.style.opacity = '0';
                  btn.style.pointerEvents = 'none';
               }, 3000);
            }
         }}>
           <div id="bunny-close-btn" className="absolute top-6 right-6 z-[9999] flex gap-4 transition-opacity duration-300">
             <button onClick={() => {
                setPlayingVideo(null);
                try {
                   if (document.fullscreenElement) {
                      document.exitFullscreen();
                   } else if ((document as any).webkitFullscreenElement) {
                      (document as any).webkitExitFullscreen();
                   }
                } catch(e) {}
             }} className="bg-white/20 hover:bg-white/40 p-4 rounded-full text-white backdrop-blur-md transition-all active:scale-95 shadow-xl"><X size={20}/></button>
           </div>
           <div className="flex-1 flex items-center justify-center p-0 md:p-10 w-full h-full">
              {playingVideo.includes('.m3u8') ? (
                 <div className="w-full h-full max-w-[1400px] mx-auto flex items-center justify-center">
                    <HlsVideoPlayer url={playingVideo} />
                 </div>
              ) : (
                 playingVideo.includes('youtube.com') || playingVideo.includes('youtu.be') ? (
                    <CustomYouTubePlayer url={playingVideo} onClose={() => {
                       setPlayingVideo(null);
                       try {
                          if (document.fullscreenElement) document.exitFullscreen();
                          else if ((document as any).webkitFullscreenElement) (document as any).webkitExitFullscreen();
                       } catch(e) {}
                    }} />
                 ) : (
                    <div className="relative w-full h-full max-w-[1400px] mx-auto flex items-center justify-center bg-black">
                        <iframe 
                           src={playingVideo.includes('player.mediadelivery.net/play/') ? playingVideo.replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/') : playingVideo}
                           className="w-full h-full md:rounded-[1rem] shadow-2xl border-none outline-none bg-black"
                           loading="lazy" 
                           allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                           sandbox="allow-scripts allow-same-origin allow-presentation"
                        ></iframe>
                    </div>
                 )
              )}
           </div>
         </div>
      )}
      
      <a href="https://zalo.me/0378243131" target="_blank" className="fixed bottom-6 right-6 w-14 h-14 bg-[#0068ff] rounded-full flex items-center justify-center shadow-2xl z-[5000] border-2 border-white"><img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" alt="Zalo" className="w-8 h-8" /></a>
      
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
};
