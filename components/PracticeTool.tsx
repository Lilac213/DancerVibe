import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, RotateCw, FastForward, Repeat, X, ChevronLeft, Film, Zap, Layers, Scissors, Trash2, Clock, MoreVertical, ChevronUp, ChevronDown, PenLine, Camera, SplitSquareVertical, ArrowLeftRight, Save, LayoutPanelLeft, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { saveVideo, getRecentVideos, deleteVideo, updateLastPlayed, renameVideo, StoredVideo, getAllVideos, getVideoCount, MAX_VIDEO_COUNT } from '../services/videoStorage';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import SmartCamera from './SmartCamera';

interface PracticeToolProps {
}

// Updated speeds as requested
const SPEEDS = [0.5, 0.7, 0.8, 0.9, 1.0, 1.1];

export const PracticeTool: React.FC<PracticeToolProps> = () => {
  // Navigation State
  const [view, setView] = useState<'home' | 'player' | 'all'>('home');

  // Data State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');
  
  const [recentVideos, setRecentVideos] = useState<StoredVideo[]>([]);
  const [allVideos, setAllVideos] = useState<StoredVideo[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  
  // AB Loop State
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // --- COMPARE MODE STATE ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareVideoUrl, setCompareVideoUrl] = useState<string | null>(null);
  const compareVideoRef = useRef<HTMLVideoElement>(null);
  const [compareOffset, setCompareOffset] = useState(0); // Offset in seconds
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false); 
  
  // --- CAMERA STATE ---
  const [showSmartCamera, setShowSmartCamera] = useState(false);

  // Load Recents on Mount
  useEffect(() => {
      refreshData();
  }, []);

  const refreshData = async () => {
      try {
          const [vids, count] = await Promise.all([
              getRecentVideos(),
              getVideoCount()
          ]);
          setRecentVideos(vids);
          setVideoCount(count);
      } catch (e) {
          console.error("Failed to load videos", e);
      }
  };

  const loadAllVideos = async () => {
      setLoading(true);
      try {
          const vids = await getAllVideos();
          setAllVideos(vids);
          // Update count while we are at it
          setVideoCount(vids.length);
          setView('all');
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (compareVideoUrl) URL.revokeObjectURL(compareVideoUrl);
    };
  }, [videoUrl, compareVideoUrl]); 

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (showComparePicker) {
          const url = URL.createObjectURL(file);
          setCompareVideoUrl(url);
          setShowComparePicker(false);
          setIsCompareMode(true);
          return;
      }

      // Check Limit for New Uploads
      const currentCount = await getVideoCount();
      if (currentCount >= MAX_VIDEO_COUNT) {
          alert(`本地存储空间已满 (${MAX_VIDEO_COUNT}个)。\n请先删除旧视频后再上传。`);
          event.target.value = ''; 
          return;
      }

      try {
          const stored = await saveVideo(file);
          playVideo(stored);
          refreshData(); 
      } catch (e) {
          alert("视频存储失败 (可能空间不足)");
          console.error(e);
      }
    }
  };

  const handleCameraCapture = async () => {
      // Logic for limit check before opening camera
      if (!showComparePicker) {
          const currentCount = await getVideoCount();
          if (currentCount >= MAX_VIDEO_COUNT) {
                alert(`本地存储空间已满 (${MAX_VIDEO_COUNT}个)。\n请先删除旧视频后再录制。`);
                return;
          }
      }
      setShowSmartCamera(true);
  };
  
  const handleSmartCameraComplete = async () => {
      // When camera finishes, reload recent videos
      await refreshData();
      // Optionally play the latest video
      const vids = await getRecentVideos(1);
      if (vids.length > 0) {
          if (showComparePicker) {
               // If we were picking a compare video
               const latest = vids[0];
               const url = URL.createObjectURL(latest.blob);
               setCompareVideoUrl(url);
               setShowComparePicker(false);
               setIsCompareMode(true);
          } else {
               playVideo(vids[0]);
          }
      }
  };

  const playVideo = async (video: StoredVideo) => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      
      const url = URL.createObjectURL(video.blob);
      setVideoUrl(url);
      setVideoTitle(video.name);
      setCurrentVideoId(video.id);
      
      resetPlayerState();
      setView('player');

      // Update timestamp in DB
      await updateLastPlayed(video.id);
      refreshData();
  };

  const handleRename = async (id: string, currentName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const newName = prompt("重命名视频 (例如: 歌曲名 + 编舞师)", currentName);
      if (newName && newName.trim() !== "") {
          await renameVideo(id, newName.trim());
          if (id === currentVideoId) setVideoTitle(newName.trim());
          // Refresh lists
          await refreshData();
          if (view === 'all') await loadAllVideos();
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); 
      if (confirm('确定要删除这个练习视频吗？此操作不可恢复。')) {
          await deleteVideo(id);
          // Refresh lists
          await refreshData();
          if (view === 'all') await loadAllVideos();
      }
  };

  const resetPlayerState = () => {
      setLoopA(null);
      setLoopB(null);
      setPlaybackRate(1);
      setIsMirrored(false);
      setIsPlaying(true);
      setIsPanelExpanded(true); // Auto expand on new video
      
      // Reset Compare
      setIsCompareMode(false);
      setCompareVideoUrl(null);
      setCompareOffset(0);
      setShowSyncModal(false);

      if (videoRef.current) {
          videoRef.current.playbackRate = 1;
      }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);

      // Sync Compare Video
      if (isCompareMode && compareVideoRef.current) {
          const targetTime = curr + compareOffset;
          // Only sync if diff is significant to avoid jitter
          if (Math.abs(compareVideoRef.current.currentTime - targetTime) > 0.1) {
              compareVideoRef.current.currentTime = targetTime;
          }
          if (!videoRef.current.paused && compareVideoRef.current.paused) {
              compareVideoRef.current.play();
          } else if (videoRef.current.paused && !compareVideoRef.current.paused) {
              compareVideoRef.current.pause();
          }
      }

      // AB Loop Logic
      if (loopA !== null && loopB !== null) {
        // Buffer of 0.1s to prevent glitching at exact edge
        if (curr >= loopB || curr < loopA) {
            videoRef.current.currentTime = loopA;
            if (isCompareMode && compareVideoRef.current) {
                compareVideoRef.current.currentTime = loopA + compareOffset;
            }
            // Force play if it got paused
            if (videoRef.current.paused) videoRef.current.play();
        }
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (compareVideoRef.current) compareVideoRef.current.pause();
      } else {
        videoRef.current.play();
        if (compareVideoRef.current) compareVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const setLoopPoint = () => {
      if (loopA === null) {
          setLoopA(currentTime);
      } else if (loopB === null) {
          // Ensure B is after A
          if (currentTime > loopA) {
              setLoopB(currentTime);
          } else {
              setLoopB(loopA);
              setLoopA(currentTime);
          }
      } else {
          // Reset
          setLoopA(null);
          setLoopB(null);
      }
  };

  const handleSpeedChange = (speed: number) => {
      setPlaybackRate(speed);
      if (videoRef.current) videoRef.current.playbackRate = speed;
      if (compareVideoRef.current) compareVideoRef.current.playbackRate = speed;
  };

  const exitPlayer = () => {
      setView('home');
      setVideoUrl(null); // Clear memory
      setCompareVideoUrl(null);
      setIsPlaying(false);
  };

  // --- VIEW 2.3: ALL VIDEOS ---
  if (view === 'all') {
      return (
        <div className="h-full bg-gray-50 flex flex-col p-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setView('home')} className="p-2 bg-white rounded-full border border-gray-200">
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-gray-900">全部练习视频</h2>
                <div className="ml-auto text-xs font-mono bg-gray-100 px-2 py-1 rounded-md text-gray-500">
                    {videoCount}/{MAX_VIDEO_COUNT}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pb-20 overflow-y-auto">
                {allVideos.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-400 py-10">暂无视频</div>
                ) : (
                    allVideos.map(v => (
                        <div key={v.id} onClick={() => playVideo(v)} className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform relative group">
                             {/* Thumbnail */}
                             <div className="aspect-video bg-gray-100 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                                {v.thumbnail ? (
                                    <img src={v.thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                                ) : (
                                    <Play className="text-gray-400 fill-gray-400" size={24} />
                                )}
                            </div>
                            
                            <div className="flex justify-between items-start gap-1">
                                <div className="font-bold text-sm text-gray-900 truncate flex-1 leading-tight">{v.name}</div>
                                <div className="flex gap-1 shrink-0 z-20">
                                    <button 
                                        onClick={(e) => handleRename(v.id, v.name, e)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer"
                                    >
                                        <PenLine size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => handleDelete(v.id, e)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                                {formatDistanceToNow(v.lastPlayedAt, { addSuffix: true, locale: zhCN })}
                            </div>
                        </div>
                    ))
                )}
            </div>
            {showSmartCamera && (
                <SmartCamera 
                    isOpen={showSmartCamera} 
                    onClose={() => setShowSmartCamera(false)}
                    onCaptureComplete={handleSmartCameraComplete}
                />
            )}
        </div>
      );
  }

  // --- VIEW 2.1: PRACTICE HOME ---
  if (view === 'home') {
    return (
      <div className="h-full bg-gray-50 flex flex-col p-4 animate-in fade-in duration-300 overflow-y-auto pb-24">
        <div className="mb-6">
            <h2 className="text-2xl font-black italic text-gray-900">PRACTICE<span className="text-red-600">.</span></h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">练舞核心工具</p>
        </div>

        {/* Recent Videos */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <Clock size={14} className="text-red-500" /> 最近练习
                </h3>
                {videoCount > 0 && (
                     <button onClick={loadAllVideos} className="text-xs text-gray-400 hover:text-black font-medium px-2 py-1 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-1">
                        查看全部 ({videoCount})
                    </button>
                )}
            </div>
            
            {recentVideos.length === 0 ? (
                <div className="h-24 bg-gray-100 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                    暂无练习记录，去上传一个吧
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                    {recentVideos.map((v) => (
                        <div 
                            key={v.id} 
                            onClick={() => playVideo(v)}
                            className="min-w-[140px] w-[140px] bg-white p-2 rounded-xl border border-gray-100 shadow-sm relative flex flex-col cursor-pointer active:scale-95 transition-transform group"
                        >
                            <div className="h-20 bg-gray-900 rounded-lg relative overflow-hidden flex items-center justify-center mb-2">
                                {v.thumbnail ? (
                                    <img src={v.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                                ) : (
                                    <Play className="text-white/50 group-hover:text-white transition-colors" size={24} fill="currentColor" />
                                )}
                                {/* Fix Delete Button Clickability */}
                                <div className="absolute top-1 right-1 z-[50]">
                                    <button 
                                        onClick={(e) => handleDelete(v.id, e)}
                                        className="bg-black/60 text-white p-2 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center shadow-md backdrop-blur-sm"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <div className="font-bold text-xs text-gray-900 truncate flex-1">{v.name}</div>
                                {/* Fix Rename Button Clickability */}
                                <div className="z-[50]">
                                    <button 
                                        onClick={(e) => handleRename(v.id, v.name, e)}
                                        className="text-gray-400 hover:text-black p-2 -mr-2"
                                    >
                                        <PenLine size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                                {formatDistanceToNow(v.lastPlayedAt, { addSuffix: true, locale: zhCN })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Main CTA */}
        <div className="flex-1 flex flex-col justify-center items-center mb-12 min-h-[200px]">
            {/* Limit Warning */}
            {videoCount >= MAX_VIDEO_COUNT && (
                 <div className="mb-4 bg-orange-50 border border-orange-100 text-orange-800 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>存储空间已满 (3/3)，请先删除视频。</span>
                 </div>
            )}

            <div className="flex gap-4 w-full justify-center">
                 <label className={`relative group flex-1 max-w-[160px] aspect-[4/5] rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 shadow-sm ${
                     videoCount >= MAX_VIDEO_COUNT 
                     ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
                     : 'border-gray-300 hover:border-red-500 bg-white hover:bg-red-50 cursor-pointer hover:shadow-md'
                 }`}>
                    <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={handleFileChange} 
                        disabled={videoCount >= MAX_VIDEO_COUNT}
                    />
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform shadow-lg ${
                        videoCount >= MAX_VIDEO_COUNT ? 'bg-gray-200 text-gray-400 shadow-none' : 'bg-red-100 text-red-600 group-hover:scale-110 shadow-red-100'
                    }`}>
                        <Upload size={24} />
                    </div>
                    <div className="text-center px-2">
                        <p className="font-bold text-gray-900 text-sm">上传视频</p>
                        <p className={`text-[10px] mt-1 font-mono font-bold ${videoCount >= MAX_VIDEO_COUNT ? 'text-red-500' : 'text-gray-400'}`}>
                            {videoCount}/{MAX_VIDEO_COUNT}
                        </p>
                    </div>
                </label>

                <button 
                    onClick={handleCameraCapture}
                    disabled={videoCount >= MAX_VIDEO_COUNT}
                    className={`relative group flex-1 max-w-[160px] aspect-[4/5] rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 shadow-sm ${
                        videoCount >= MAX_VIDEO_COUNT 
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
                        : 'border-gray-300 hover:border-black bg-white hover:bg-gray-50 cursor-pointer hover:shadow-md'
                    }`}
                >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform shadow-lg ${
                        videoCount >= MAX_VIDEO_COUNT ? 'bg-gray-200 text-gray-400 shadow-none' : 'bg-gray-100 text-black group-hover:scale-110'
                    }`}>
                        <Camera size={24} />
                    </div>
                    <div className="text-center px-2">
                        <p className="font-bold text-gray-900 text-sm">拍摄视频</p>
                        <p className={`text-[10px] mt-1 font-mono font-bold ${videoCount >= MAX_VIDEO_COUNT ? 'text-red-500' : 'text-gray-400'}`}>
                            AI 辅助构图
                        </p>
                    </div>
                </button>
            </div>
        </div>

        {/* Features Info */}
        <div className="grid grid-cols-3 gap-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><SplitSquareVertical size={18} /></div>
                <span className="text-[10px] font-bold text-gray-600">同屏对比<br/>同步纠错</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><RotateCw size={18} /></div>
                <span className="text-[10px] font-bold text-gray-600">镜面翻转<br/>扒舞神器</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Repeat size={18} /></div>
                <span className="text-[10px] font-bold text-gray-600">A-B 循环<br/>死磕细节</span>
            </div>
        </div>

        {showSmartCamera && (
            <SmartCamera 
                isOpen={showSmartCamera} 
                onClose={() => setShowSmartCamera(false)}
                onCaptureComplete={handleSmartCameraComplete}
            />
        )}
      </div>
    );
  }

  // --- VIEW 2.2: PLAYER (Full Screen) ---
  return (
    // Z-Index increased to 100 to cover bottom navigation
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-in slide-in-from-bottom duration-300">
        
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 pt- safe-top flex justify-between items-center z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <button onClick={exitPlayer} className="pointer-events-auto p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all">
                <ChevronLeft size={24} />
            </button>
            <div className="flex-1 mx-4 text-center">
                <div 
                    onClick={() => handleRename(currentVideoId!, videoTitle, { stopPropagation: () => {} } as any)}
                    className="text-xs font-bold bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 truncate max-w-[200px] mx-auto pointer-events-auto cursor-text flex items-center justify-center gap-2"
                >
                    {videoTitle} <PenLine size={10} className="opacity-50" />
                </div>
            </div>
            <div className="w-10"></div>
        </div>

        {/* Video Area */}
        <div className={`flex-1 relative flex items-center justify-center overflow-hidden bg-gray-900 ${isCompareMode ? 'gap-1' : ''}`} onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
            
            {/* Main Video */}
            <div className={`relative ${isCompareMode ? 'w-1/2 h-full' : 'w-full h-full'}`}>
                <video 
                    ref={videoRef}
                    src={videoUrl || ''}
                    className="w-full h-full object-contain bg-black"
                    style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                    playsInline
                    loop={loopA === null || loopB === null}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    autoPlay
                />
                {!isPlaying && !isCompareMode && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <Play size={48} className="fill-white/80 text-white/80" />
                    </div>
                )}
                 {isCompareMode && (
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white/80 font-bold">原视频</div>
                )}
            </div>

            {/* Compare Video (If Active) */}
            {isCompareMode && (
                <div className={`relative w-1/2 h-full border-l border-white/10 bg-black`}>
                    {compareVideoUrl ? (
                         <>
                            <video 
                                ref={compareVideoRef}
                                src={compareVideoUrl}
                                className="w-full h-full object-contain bg-black"
                                style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                                playsInline
                                muted
                            />
                             <div className="absolute bottom-2 left-2 bg-red-600/80 px-2 py-0.5 rounded text-[10px] text-white font-bold">对比视频</div>
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                 {!isPlaying && <Play size={32} className="fill-white/50 text-white/50" />}
                             </div>
                         </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-gray-500 gap-2">
                             <p className="text-xs">未选择对比视频</p>
                             <button onClick={(e) => { e.stopPropagation(); setShowComparePicker(true); }} className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold">选择视频</button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Sync Controls Modal (Updated: Bottom Aligned + Transparent Backdrop) */}
        {showSyncModal && isCompareMode && compareVideoUrl && (
            <div 
                className="fixed inset-0 z-[120] flex flex-col justify-end items-center pb-28 sm:pb-32 px-4 pointer-events-none" // Pointer events none allows clicks to pass through empty areas if needed, but the wrapper is full screen.
                onClick={() => setShowSyncModal(false)}
            >
                 <div 
                    className="bg-black/80 backdrop-blur-md border border-white/20 w-full max-w-sm rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                 >
                      <div className="flex justify-between items-center mb-4">
                         <div className="flex items-center gap-2">
                            <SlidersHorizontal size={18} className="text-red-500"/>
                            <h3 className="text-lg font-bold text-white">对齐调整</h3>
                         </div>
                         <button onClick={() => setShowSyncModal(false)} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20"><X size={16} /></button>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
                          <div className="flex justify-between items-center mb-4">
                             <span className="text-xs font-bold text-gray-400">时间偏移</span>
                             <span className="text-xl font-mono text-red-500 font-bold">{compareOffset > 0 ? '+' : ''}{compareOffset.toFixed(1)}s</span>
                          </div>
                          
                          {/* Slider Control */}
                          <div className="flex items-center gap-3">
                             <button onClick={() => setCompareOffset(p => p - 0.1)} className="text-gray-400 hover:text-white bg-white/10 p-2 rounded-lg"><ChevronLeft size={16} /></button>
                             <input 
                                type="range" 
                                min="-5" 
                                max="5" 
                                step="0.1" 
                                value={compareOffset}
                                onChange={(e) => setCompareOffset(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                            />
                             <button onClick={() => setCompareOffset(p => p + 0.1)} className="text-gray-400 hover:text-white bg-white/10 p-2 rounded-lg"><ChevronLeft size={16} className="rotate-180" /></button>
                          </div>
                      </div>

                      <div className="text-center">
                           <button onClick={() => setCompareOffset(0)} className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">重置对齐 (0.0s)</button>
                      </div>
                 </div>
            </div>
        )}

        {/* Collapsible Workspace */}
        <div className={`bg-zinc-900 border-t border-zinc-800 transition-all duration-300 ease-in-out px-4 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col z-50 ${isPanelExpanded ? 'rounded-t-3xl pb-4' : 'rounded-t-2xl pb-2'}`}>
            
            {/* Drag Handle */}
            <div 
                className="w-full flex justify-center py-2 -mt-2 cursor-pointer touch-none active:opacity-70"
                onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            >
                <div className={`w-10 h-1 bg-zinc-700 rounded-full transition-all ${isPanelExpanded ? 'bg-zinc-600 w-12' : 'bg-zinc-500'}`} />
            </div>

            {/* Timeline */}
            <div className="space-y-1 relative px-1 mb-3 mt-1">
                 {/* Markers */}
                 <div className="absolute top-1/2 -translate-y-1/2 left-1 right-1 h-1 pointer-events-none z-10">
                    {loopA !== null && (
                        <div className="absolute top-0 bottom-0 bg-orange-500 w-1 rounded-full z-20" style={{ left: `${(loopA / duration) * 100}%` }} />
                    )}
                    {loopB !== null && (
                        <div className="absolute top-0 bottom-0 bg-orange-500 w-1 rounded-full z-20" style={{ left: `${(loopB / duration) * 100}%` }} />
                    )}
                    {loopA !== null && loopB !== null && (
                         <div className="absolute top-0 bottom-0 bg-orange-500/30 rounded-full" style={{ left: `${(loopA / duration) * 100}%`, width: `${((loopB - loopA) / duration) * 100}%` }} />
                    )}
                 </div>

                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (videoRef.current) videoRef.current.currentTime = val;
                        setCurrentTime(val);
                    }}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600 relative z-20 focus:outline-none"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Main Controls Row */}
            <div className="flex items-center justify-between gap-4">
                 <button onClick={() => setIsPanelExpanded(true)} className="flex-1 h-10 text-xs font-bold text-gray-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors flex items-center justify-center gap-1">
                    <FastForward size={14} /> {playbackRate}x
                 </button>

                 <button onClick={togglePlay} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition-transform border-4 border-zinc-900 shrink-0">
                    {isPlaying ? <span className="w-5 h-5 bg-white rounded-sm" /> : <Play className="fill-white ml-1" size={24} />}
                 </button>

                 <button onClick={() => { setIsMirrored(!isMirrored); }} className={`flex-1 h-10 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 ${isMirrored ? 'bg-white text-black' : 'bg-zinc-800/50 text-gray-400 hover:bg-zinc-800'}`}>
                    <RotateCw size={14} /> {isMirrored ? '翻转' : '正常'}
                 </button>
            </div>

            {/* Expanded Controls Area */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isPanelExpanded ? 'max-h-[300px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                
                {/* Speed Grid */}
                <div className="mb-2">
                     <div className="flex justify-between items-center mb-1 px-1">
                         <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">精细倍速</span>
                     </div>
                     <div className="grid grid-cols-6 gap-1">
                         {SPEEDS.map(s => (
                             <button key={s} onClick={() => handleSpeedChange(s)} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${playbackRate === s ? 'bg-zinc-600 text-white ring-1 ring-zinc-500 shadow-sm' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
                                 {s}
                             </button>
                         ))}
                     </div>
                </div>

                {/* Compare Mode Toggle */}
                <div className="mb-2">
                    <div className="flex justify-between items-center mb-1 px-1">
                         <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">高级功能</span>
                     </div>
                     <div className="flex gap-1.5">
                        <button 
                            onClick={() => {
                                if (isCompareMode) {
                                    setIsCompareMode(false);
                                    setCompareVideoUrl(null);
                                    setShowSyncModal(false);
                                } else {
                                    setShowComparePicker(true);
                                }
                            }}
                            className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border ${
                                isCompareMode 
                                ? 'bg-blue-600 text-white border-blue-500' 
                                : 'bg-zinc-800 text-gray-300 border-zinc-800 hover:bg-zinc-700'
                            }`}
                        >
                            <LayoutPanelLeft size={14} /> {isCompareMode ? '退出对比' : '同屏对比'}
                        </button>

                        {/* Sync Adjustment Button (Visible only in compare mode) */}
                        {isCompareMode && (
                             <button
                                onClick={() => setShowSyncModal(true)}
                                className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border bg-zinc-800 text-gray-300 border-zinc-800 hover:bg-zinc-700`}
                            >
                                <SlidersHorizontal size={14} /> 对齐调整
                            </button>
                        )}
                     </div>
                </div>

                {/* AB Loop Row */}
                <div>
                     <div className="flex justify-between items-center mb-1 px-1">
                         <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">A-B 循环</span>
                         {(loopA !== null || loopB !== null) && (
                             <span className="text-[10px] text-orange-500 font-bold animate-pulse">
                                 {loopA !== null && loopB !== null ? '● 循环播放中' : '● 设置中...'}
                             </span>
                         )}
                     </div>
                     <div className="flex gap-1.5">
                         <button onClick={() => { setLoopA(null); setLoopB(null); }} disabled={loopA === null} className="flex-1 py-2 rounded-xl bg-zinc-800 text-gray-400 font-bold text-xs disabled:opacity-30 hover:bg-zinc-700 transition-colors">
                             重置
                         </button>
                         <button onClick={setLoopPoint} className={`flex-[3] py-2 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 ${loopA !== null && loopB !== null ? 'bg-zinc-700 text-white border border-zinc-600' : (loopA !== null ? 'bg-orange-600 text-white shadow-orange-600/20' : 'bg-white text-black')}`}>
                             {loopA === null ? <><Repeat size={14}/> 设定起点 (A)</> : (loopB === null ? <><Repeat size={14}/> 设定终点 (B)</> : '清除并重新设定')}
                         </button>
                     </div>
                </div>

            </div>

        </div>

        {/* Compare Picker Modal */}
        {showComparePicker && (
            <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">选择对比视频</h3>
                        <button onClick={() => setShowComparePicker(false)} className="p-2 bg-zinc-800 rounded-full"><X size={18} /></button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <label className="aspect-square bg-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-700 transition-colors border border-zinc-700">
                            <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-blue-500">
                                <Upload size={24} />
                            </div>
                            <span className="text-xs font-bold text-gray-300">上传视频</span>
                        </label>

                        <button 
                            onClick={handleCameraCapture}
                            className="aspect-square bg-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-700 transition-colors border border-zinc-700"
                        >
                            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-red-500">
                                <Camera size={24} />
                            </div>
                            <span className="text-xs font-bold text-gray-300">现场拍摄</span>
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-gray-500 mt-6">
                        选择第二个视频与当前视频同屏播放，用于纠错对比。
                    </p>
                </div>
            </div>
        )}
    </div>
  );
};