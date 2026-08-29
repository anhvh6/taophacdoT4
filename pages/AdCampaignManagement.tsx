import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button, Modal, Toast } from '../components/UI';
import { Megaphone, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AdCampaign, campaignService } from '../src/services/campaignService';
import Hls from 'hls.js';

const MiniHlsPlayer = ({ url }: { url: string }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (Hls.isSupported() && videoRef.current) {
      const hls = new Hls({ startLevel: 2, capLevelToPlayerSize: true });
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(e => console.log(e)));
      return () => hls.destroy();
    } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url;
      videoRef.current.addEventListener('loadedmetadata', () => videoRef.current?.play().catch(e => console.log(e)));
    }
  }, [url]);
  return <video ref={videoRef} autoPlay controls playsInline loop className="w-full h-full object-contain" />;
};

const AdCampaignManagement: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<AdCampaign>>({});
  
  const [previewCampaign, setPreviewCampaign] = useState<AdCampaign | null>(null);
  const [previewMediaIndex, setPreviewMediaIndex] = useState(0);
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    const data = await campaignService.getCampaigns();
    setCampaigns(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentCampaign.name) {
      setToast("Vui lòng nhập tên chiến dịch");
      return;
    }
    
    if (!currentCampaign.media || currentCampaign.media.length === 0) {
      setToast("Vui lòng thêm ít nhất 1 ảnh hoặc video");
      return;
    }
    
    const newCampaign: AdCampaign = {
      id: currentCampaign.id || 'AD' + Date.now(),
      name: currentCampaign.name,
      media: currentCampaign.media,
      cta_name: currentCampaign.cta_name || '',
      cta_link: currentCampaign.cta_link || '',
      description: currentCampaign.description || '',
      display_now: !!currentCampaign.display_now,
      display_days: currentCampaign.display_days || 0,
      from_session: currentCampaign.from_session || 0,
      to_session: currentCampaign.to_session || 0,
      is_active: currentCampaign.is_active !== undefined ? currentCampaign.is_active : true,
      created_at: currentCampaign.created_at || new Date().toISOString()
    };
    
    const newCampaigns = currentCampaign.id 
      ? campaigns.map(c => c.id === currentCampaign.id ? newCampaign : c)
      : [...campaigns, newCampaign];
      
    setCampaigns(newCampaigns);
    const success = await campaignService.saveCampaigns(newCampaigns);
    
    if (success) {
      setToast("Lưu chiến dịch thành công");
      setIsModalOpen(false);
    } else {
      setToast("Lỗi khi lưu chiến dịch");
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa chiến dịch này?")) return;
    const newCampaigns = campaigns.filter(c => c.id !== id);
    setCampaigns(newCampaigns);
    const success = await campaignService.saveCampaigns(newCampaigns);
    if (success) setToast("Xóa chiến dịch thành công");
    else setToast("Lỗi khi xóa");
  };
  
  const toggleActive = async (id: string, active: boolean) => {
    const newCampaigns = campaigns.map(c => c.id === id ? { ...c, is_active: active } : c);
    setCampaigns(newCampaigns);
    await campaignService.saveCampaigns(newCampaigns);
  };

  const openPreview = (campaign: AdCampaign) => {
    setPreviewCampaign(campaign);
    setPreviewMediaIndex(0);
    setShowPreviewDetails(false);
  };

  const renderPreviewMedia = (url: string) => {
    const mediaUrl = url.trim();
    const isBunnyVidId = mediaUrl !== "" && !/^https?:\/\//i.test(mediaUrl);
    
    const getYouTubeEmbedUrl = (u: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
      const match = u.match(regExp);
      return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
    };
    
    const ytEmbedUrl = getYouTubeEmbedUrl(mediaUrl);
    
    let directImageUrl = mediaUrl;
    if (mediaUrl.includes('drive.google.com')) {
       const match = mediaUrl.match(/[-\w]{25,}/);
       if (match && match[0]) {
           return <img src={`https://lh3.googleusercontent.com/d/${match[0]}`} alt="Ad Media" className="w-full h-full object-contain" />;
       }
    }

    if (isBunnyVidId) {
       return <MiniHlsPlayer url={`https://video.phacdo.com/${mediaUrl}/playlist.m3u8`} />;
    } else if (ytEmbedUrl) {
       return <iframe src={ytEmbedUrl} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
    } else if (mediaUrl.match(/\.(mp4|webm|m3u8)(\?.*)?$/i)) {
       return <video src={mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-contain" />;
    } else {
       return <img src={directImageUrl} alt="Ad Media" className="w-full h-full object-contain" />;
    }
  };

  return (
    <Layout 
      title="Quản lý Chiến dịch Quảng cáo" 
      onBack={() => onNavigate('dashboard')}
      actions={
        <Button variant="primary" onClick={() => {
          setCurrentCampaign({ is_active: true, display_now: true, media: [''] });
          setIsModalOpen(true);
        }}>
          <Plus size={16} className="mr-2" /> Tạo Mới
        </Button>
      }
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 uppercase text-xs font-black text-gray-500">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap min-w-[200px]">Tên chiến dịch</th>
                <th className="px-6 py-4 whitespace-nowrap min-w-[200px]">Điều kiện</th>
                <th className="px-6 py-4 whitespace-nowrap min-w-[120px]">Trạng thái</th>
                <th className="px-6 py-4 text-right whitespace-nowrap min-w-[150px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Đang tải...</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Chưa có chiến dịch nào.</td></tr>
              ) : (
                campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-blue-900 whitespace-nowrap">{c.name}</div>
                      <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">Ngày tạo: {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      {c.display_now ? (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded whitespace-nowrap">Hiển thị ngay (trong {c.display_days || 0} ngày)</span>
                      ) : (
                        <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded whitespace-nowrap">Từ buổi {c.from_session || 0} đến buổi {c.to_session || 0}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={c.is_active} onChange={e => toggleActive(c.id, e.target.checked)} />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                      <button onClick={() => openPreview(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Xem trước"><Play size={16} /></button>
                      <button onClick={() => { setCurrentCampaign(c); setIsModalOpen(true); }} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Sửa"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentCampaign.id ? "Sửa Chiến Dịch" : "Tạo Chiến Dịch QC"} maxWidth="max-w-2xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên Chiến Dịch</label>
            <input type="text" value={currentCampaign.name || ''} onChange={e => setCurrentCampaign({ ...currentCampaign, name: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ví dụ: Giảm giá ngày lễ..." />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700 uppercase">Danh sách Media (Ảnh/Video)</label>
              <Button size="sm" onClick={() => setCurrentCampaign({ ...currentCampaign, media: [...(currentCampaign.media || []), ''] })}>+ Thêm</Button>
            </div>
            {(currentCampaign.media || []).map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <input type="text" value={url} onChange={e => {
                  const m = [...(currentCampaign.media || [])]; m[idx] = e.target.value;
                  setCurrentCampaign({ ...currentCampaign, media: m });
                }} className="flex-1 px-4 py-2 border rounded-xl text-sm" placeholder="ID Bunny, URL Youtube hoặc URL Google Drive..." />
                <button onClick={() => {
                  const m = (currentCampaign.media || []).filter((_, i) => i !== idx);
                  setCurrentCampaign({ ...currentCampaign, media: m });
                }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên Nút Hành Động</label>
               <input type="text" value={currentCampaign.cta_name || ''} onChange={e => setCurrentCampaign({ ...currentCampaign, cta_name: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Ví dụ: Đặt ngay..." />
            </div>
            <div>
               <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Link Hành Động</label>
               <input type="text" value={currentCampaign.cta_link || ''} onChange={e => setCurrentCampaign({ ...currentCampaign, cta_link: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nội dung chi tiết</label>
            <textarea value={currentCampaign.description || ''} onChange={e => setCurrentCampaign({ ...currentCampaign, description: e.target.value })} className="w-full px-4 py-2 border rounded-xl h-24" placeholder="Nhập mô tả..." />
          </div>

          <div className="bg-orange-50 p-4 rounded-xl">
             <label className="block text-xs font-bold text-orange-900 uppercase mb-3">Điều Kiện Hiển Thị</label>
             <div className="flex flex-col gap-4">
               <label className="flex items-center gap-3 cursor-pointer">
                 <input type="radio" name="displayType" className="w-4 h-4 text-orange-600 focus:ring-orange-500" checked={!!currentCampaign.display_now} onChange={() => setCurrentCampaign({ ...currentCampaign, display_now: true })} />
                 <span className="text-sm font-bold text-gray-800">Hiển thị ngay (áp dụng mọi học viên)</span>
               </label>
               {currentCampaign.display_now && (
                 <div className="flex items-center gap-2 pl-7">
                   <span className="text-sm text-gray-600">Hiển thị trong vòng</span>
                   <input type="number" min="0" value={currentCampaign.display_days || 0} onChange={e => setCurrentCampaign({ ...currentCampaign, display_days: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1.5 border rounded-lg text-center" />
                   <span className="text-sm text-gray-600">ngày kế tiếp.</span>
                 </div>
               )}
               
               <label className="flex items-center gap-3 cursor-pointer mt-2">
                 <input type="radio" name="displayType" className="w-4 h-4 text-orange-600 focus:ring-orange-500" checked={!currentCampaign.display_now} onChange={() => setCurrentCampaign({ ...currentCampaign, display_now: false })} />
                 <span className="text-sm font-bold text-gray-800">Hiển thị theo tiến độ học của học viên</span>
               </label>
               {!currentCampaign.display_now && (
                 <div className="flex flex-wrap items-center gap-2 pl-7 mt-1">
                   <span className="text-sm text-gray-600">Từ buổi:</span>
                   <input type="number" min="0" value={currentCampaign.from_session || 0} onChange={e => setCurrentCampaign({ ...currentCampaign, from_session: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1.5 border rounded-lg text-center" />
                   <span className="text-sm text-gray-600 ml-2">Đến buổi:</span>
                   <input type="number" min="0" value={currentCampaign.to_session || 0} onChange={e => setCurrentCampaign({ ...currentCampaign, to_session: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1.5 border rounded-lg text-center" />
                 </div>
               )}
             </div>
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <Button variant="secondary" onClick={() => openPreview(currentCampaign as AdCampaign)}>XEM TRƯỚC</Button>
            <Button variant="primary" onClick={handleSave}>LƯU CHIẾN DỊCH</Button>
          </div>
        </div>
      </Modal>

      {previewCampaign && (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col justify-center">
           <div className="absolute top-0 left-0 right-0 z-10 flex justify-end items-center p-4 bg-gradient-to-b from-black/80 to-transparent gap-4">
              <div className="bg-white/20 backdrop-blur-md text-blue-400 font-bold px-3 py-1.5 text-xs rounded-full uppercase absolute left-4">Chế độ xem trước</div>
              {previewCampaign.cta_name && previewCampaign.cta_link && (
                 <a href={previewCampaign.cta_link} target="_blank" className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-blue-400 font-black px-6 py-2.5 rounded-full uppercase text-sm transition-colors">{previewCampaign.cta_name}</a>
              )}
              {previewCampaign.description && (
                 <button onClick={() => setShowPreviewDetails(!showPreviewDetails)} className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-blue-400 font-bold px-6 py-2.5 rounded-full text-sm transition-colors">Chi tiết</button>
              )}
              <button onClick={() => setPreviewCampaign(null)} className="bg-white/20 backdrop-blur-md hover:bg-white/30 p-2.5 rounded-full text-blue-400 transition-colors"><X size={20}/></button>
           </div>
           
           <div className="flex-1 relative flex items-center justify-center w-full overflow-hidden">
              {previewCampaign.media.length > 0 && renderPreviewMedia(previewCampaign.media[previewMediaIndex])}
              
              {previewCampaign.media.length > 1 && (
                 <>
                    <button onClick={() => setPreviewMediaIndex(prev => (prev - 1 + previewCampaign.media.length) % previewCampaign.media.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full"><ChevronLeft size={24}/></button>
                    <button onClick={() => setPreviewMediaIndex(prev => (prev + 1) % previewCampaign.media.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full"><ChevronRight size={24}/></button>
                 </>
              )}
           </div>

           {showPreviewDetails && previewCampaign.description && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreviewDetails(false)}></div>
                 <div className="relative bg-white/95 backdrop-blur-md rounded-[2rem] shadow-2xl p-6 sm:p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto flex flex-col">
                    <button onClick={() => setShowPreviewDetails(false)} className="absolute top-6 right-6 text-gray-500 hover:text-black p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                    <h3 className="text-xl font-black text-blue-900 uppercase mb-4 pr-10">Thông tin chi tiết</h3>
                    <div className="whitespace-pre-wrap text-sm font-medium text-gray-700 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: previewCampaign.description.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600 underline hover:text-blue-800">$1</a>') }} />
                    {previewCampaign.cta_name && previewCampaign.cta_link && (
                       <div className="mt-auto pt-4 border-t border-gray-200 flex justify-center">
                          <a href={previewCampaign.cta_link} target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3 rounded-full uppercase text-sm shadow-lg transform transition hover:scale-105 active:scale-95">
                             {previewCampaign.cta_name}
                          </a>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </Layout>
  );
};

export default AdCampaignManagement;
