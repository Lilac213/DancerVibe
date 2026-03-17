import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Download, Type, Move, RefreshCcw, Loader2 } from 'lucide-react';
import { ClassSession, User } from '../types';
import { format } from 'date-fns';

interface PosterGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassSession[];
  user: User;
}

const PosterGenerator: React.FC<PosterGeneratorProps> = ({ isOpen, onClose, classes, user }) => {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [portraitImage, setPortraitImage] = useState<string | null>(null);
  const [size, setSize] = useState<'1:1' | '3:4' | '9:16'>('3:4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('街舞教室，霓虹灯光，高对比度');
  
  // Draggable text positions
  const [titlePos, setTitlePos] = useState({ x: 50, y: 50 });
  const [listPos, setListPos] = useState({ x: 50, y: 150 });
  const [titleText, setTitleText] = useState(`${user.name} ${format(new Date(), 'M月')}课表`);
  const [textColor, setTextColor] = useState('#FFFFFF');

  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, setPos: any) => {
    // Simple drag logic (for a real app, use react-draggable or similar)
    const el = e.currentTarget as HTMLElement;
    const rect = el.parentElement!.getBoundingClientRect();
    
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const initialTop = el.offsetTop;
    const initialLeft = el.offsetLeft;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
        const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        setPos({ x: initialLeft + dx, y: initialTop + dy });
    };

    const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  };

  const generateAIBackground = async () => {
      setIsGenerating(true);
      try {
          const res = await fetch('http://localhost:5000/api/ai/generate_poster', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, size })
          });
          const data = await res.json();
          if (data.success) {
              setBgImage(data.imageUrl);
          } else {
              alert('生成失败: ' + data.error);
          }
      } catch (e) {
          console.error(e);
          alert('请求失败');
      } finally {
          setIsGenerating(false);
      }
  };

  const handlePortraitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setPortraitImage(URL.createObjectURL(file));
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setBgImage(URL.createObjectURL(file));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90">
      {/* Sidebar Controls */}
      <div className="w-80 bg-white p-6 flex flex-col gap-6 overflow-y-auto">
         <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">AI 海报生成</h2>
            <button onClick={onClose}><X /></button>
         </div>

         <div className="space-y-4">
             <div>
                 <label className="text-xs font-bold text-gray-500 mb-2 block">画布比例</label>
                 <div className="flex gap-2">
                     {['1:1', '3:4', '9:16'].map(s => (
                         <button 
                            key={s} 
                            onClick={() => setSize(s as any)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg border ${size === s ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'}`}
                         >
                            {s}
                         </button>
                     ))}
                 </div>
             </div>

             <div>
                 <label className="text-xs font-bold text-gray-500 mb-2 block">AI 背景生成</label>
                 <textarea 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    className="w-full border rounded-lg p-2 text-sm mb-2"
                    rows={2}
                 />
                 <button 
                    onClick={generateAIBackground} 
                    disabled={isGenerating}
                    className="w-full bg-red-600 text-white py-2 rounded-lg font-bold flex justify-center items-center gap-2"
                 >
                     {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                     生成背景
                 </button>
             </div>

             <div className="border-t pt-4">
                 <label className="text-xs font-bold text-gray-500 mb-2 block">自定义素材</label>
                 <div className="flex gap-2">
                    <label className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-50">
                        <ImageIcon className="mx-auto text-gray-400 mb-1" size={20}/>
                        <span className="text-xs text-gray-500">上传人像</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handlePortraitUpload} />
                    </label>
                    <label className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-50">
                        <ImageIcon className="mx-auto text-gray-400 mb-1" size={20}/>
                        <span className="text-xs text-gray-500">上传背景</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                    </label>
                 </div>
             </div>

             <div className="border-t pt-4">
                 <label className="text-xs font-bold text-gray-500 mb-2 block">文字编辑</label>
                 <input 
                    type="text" 
                    value={titleText} 
                    onChange={e => setTitleText(e.target.value)} 
                    className="w-full border rounded-lg p-2 text-sm mb-2"
                 />
                 <div className="flex items-center gap-2">
                     <span className="text-xs">文字颜色:</span>
                     <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
                 </div>
             </div>
         </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-8 overflow-hidden relative">
          <div 
            ref={containerRef}
            className="bg-white relative overflow-hidden shadow-2xl transition-all"
            style={{
                width: size === '1:1' ? '500px' : size === '3:4' ? '450px' : '360px',
                height: size === '1:1' ? '500px' : size === '3:4' ? '600px' : '640px',
                backgroundImage: bgImage ? `url(${bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: bgImage ? 'transparent' : '#1a1a1a'
            }}
          >
              {portraitImage && (
                  <img src={portraitImage} className="absolute bottom-0 right-0 max-h-[70%] object-contain opacity-90 pointer-events-none" />
              )}
              
              <div 
                className="absolute cursor-move group"
                style={{ left: titlePos.x, top: titlePos.y, color: textColor }}
                onMouseDown={e => handleDragStart(e, setTitlePos)}
                onTouchStart={e => handleDragStart(e, setTitlePos)}
              >
                  <h1 className="text-4xl font-black italic tracking-tighter drop-shadow-md whitespace-nowrap">
                      {titleText}
                  </h1>
                  <div className="absolute -inset-2 border border-dashed border-white/50 hidden group-hover:block pointer-events-none"></div>
              </div>

              <div 
                className="absolute cursor-move group max-w-[90%]"
                style={{ left: listPos.x, top: listPos.y, color: textColor }}
                onMouseDown={e => handleDragStart(e, setListPos)}
                onTouchStart={e => handleDragStart(e, setListPos)}
              >
                  <div className="space-y-3 drop-shadow-md bg-black/20 backdrop-blur-sm p-4 rounded-2xl">
                      {classes.slice(0, 8).map((c, i) => (
                          <div key={i} className="flex justify-between items-center gap-4 border-b border-white/10 pb-2 last:border-0">
                              <div>
                                  <div className="font-bold text-lg leading-none">{c.studio}</div>
                                  <div className="text-sm opacity-80 mt-1">{c.song || '常规课'}</div>
                              </div>
                              <div className="text-right shrink-0">
                                  <div className="text-sm font-bold bg-white/20 px-2 py-0.5 rounded">周{['日','一','二','三','四','五','六'][c.dayOfWeek]}</div>
                                  <div className="text-sm font-black mt-1">{c.startTime}-{c.endTime}</div>
                              </div>
                          </div>
                      ))}
                      {classes.length > 8 && <div className="text-center text-sm opacity-70">...及更多课程</div>}
                  </div>
                  <div className="absolute -inset-2 border border-dashed border-white/50 hidden group-hover:block pointer-events-none"></div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PosterGenerator;
