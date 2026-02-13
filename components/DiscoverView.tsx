import React, { useState } from 'react';
import { Heart, MapPin, Clock, Music, User, Plus, Shirt, Zap, Play, Search, Bell, MoreHorizontal, ChevronDown, Building2 } from 'lucide-react';

// --- Types ---

type RecType = 'course' | 'teacher' | 'music' | 'buddy' | 'gear' | 'studio';

interface BaseRec {
  id: string;
  type: RecType;
  title: string;
  coverUrl: string;
  liked: boolean;
  likes: number;
  reason?: string;
}

interface CourseRec extends BaseRec {
  type: 'course';
  studio: string;
  teacher: string;
  time: string; // "19:00-20:30"
  difficulty: number;
  tags: string[];
  isVerifiedTeacher?: boolean;
}

interface TeacherRec extends BaseRec {
  type: 'teacher';
  styles: string[];
  matchRate: number; // 0-100
}

interface StudioRec extends BaseRec {
    type: 'studio';
    location: string;
    distance: string;
}

interface MusicRec extends BaseRec {
  type: 'music';
  artist: string;
  context: string; // "Used by X at Y"
}

interface BuddyRec extends BaseRec {
  type: 'buddy';
  nickname: string;
  sharedInterest: string;
}

interface GearRec extends BaseRec {
  type: 'gear';
  saveCount: number;
}

export type Recommendation = CourseRec | TeacherRec | MusicRec | BuddyRec | GearRec | StudioRec;

interface DiscoverViewProps {
    onAddToSchedule?: (rec: CourseRec) => void;
    onViewProfile?: (userId: string, userName: string) => void;
}

// --- Mock Data ---

const MOCK_DATA: Recommendation[] = [
  {
    id: '1',
    type: 'course',
    title: 'New Jeans - OMG (Original)',
    coverUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=600',
    studio: 'Millennium',
    teacher: 'Kyoka',
    time: '19:00-20:30',
    difficulty: 3,
    tags: ['Hiphop', 'Swag'],
    liked: false,
    likes: 124,
    reason: '根据你的 Hiphop 偏好推荐',
    isVerifiedTeacher: true,
  },
  {
    id: '2',
    type: 'gear',
    title: '适合 Jazz 打铁课的宽松训练裤',
    coverUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600',
    liked: true,
    likes: 892,
    saveCount: 450,
    reason: '同风格舞者都在看',
  },
  {
    id: '3',
    type: 'music',
    title: 'Water - Tyla',
    artist: 'Tyla',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=600',
    liked: false,
    likes: 56,
    context: '最近 Mark 在 En Dance 用这首歌教过',
  },
  {
    id: '4',
    type: 'teacher',
    title: 'Yumeri',
    coverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    liked: false,
    likes: 230,
    styles: ['Jazz Funk', 'Vogue'],
    matchRate: 92,
    reason: '与你常上的老师风格相似',
  },
  {
    id: '5',
    type: 'course',
    title: 'Basic Training / Isolation',
    coverUrl: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&q=80&w=600',
    studio: 'En Dance',
    teacher: 'Akinen',
    time: '20:30-22:00',
    difficulty: 4,
    tags: ['Isolation', 'Basic'],
    liked: false,
    likes: 45,
    reason: '进阶必备基础课',
  },
  {
    id: '6',
    type: 'buddy',
    title: '一起约练？',
    nickname: 'Momo',
    coverUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=600',
    liked: false,
    likes: 12,
    sharedInterest: '都上过 Kyoka 的课',
  },
  {
    id: '7',
    type: 'studio',
    title: 'Sinostage',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=600',
    location: 'Chengdu',
    distance: '1.2km',
    liked: true,
    likes: 2200,
    reason: '你附近的热门舞室'
  },
  {
    id: '8',
    type: 'music',
    title: 'Paint The Town Red',
    artist: 'Doja Cat',
    coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&q=80&w=600',
    liked: true,
    likes: 88,
    context: '本周热歌榜 Top 3',
  }
];

const CITIES = ['上海', '北京', '成都', '广州', '深圳', '杭州'];
const CATEGORIES = [
    { id: 'all', label: '总览' },
    { id: 'course', label: '课程' },
    { id: 'teacher', label: '老师' },
    { id: 'studio', label: '舞室' },
    { id: 'buddy', label: '搭子' },
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onAddToSchedule, onViewProfile }) => {
  const [items, setItems] = useState(MOCK_DATA);
  const [selectedCity, setSelectedCity] = useState('上海');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const toggleLike = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 } : item
    ));
  };

  // Filter Logic
  const filteredItems = items.filter(item => {
      if (selectedCategory === 'all') return true;
      return item.type === selectedCategory;
  });

  // Split items into two columns for masonry effect
  const leftCol = filteredItems.filter((_, i) => i % 2 === 0);
  const rightCol = filteredItems.filter((_, i) => i % 2 !== 0);

  const renderCard = (item: Recommendation) => {
    return (
      <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-3 group break-inside-avoid relative animate-in fade-in zoom-in-95 duration-300">
        
        {/* Cover Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          
          {/* Top Left Badge (Reason) */}
          {item.reason && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] text-white font-bold max-w-[85%] truncate">
              {item.reason}
            </div>
          )}

          {/* Type Badge (Top Right) */}
          <div className="absolute top-2 right-2">
             {item.type === 'course' && <div className="bg-red-600 text-white p-1 rounded-full"><Zap size={10} fill="currentColor"/></div>}
             {item.type === 'music' && <div className="bg-blue-600 text-white p-1 rounded-full"><Music size={10} /></div>}
             {item.type === 'teacher' && <div className="bg-purple-600 text-white p-1 rounded-full"><User size={10} /></div>}
             {item.type === 'buddy' && <div className="bg-green-600 text-white p-1 rounded-full"><User size={10} /></div>}
             {item.type === 'gear' && <div className="bg-orange-600 text-white p-1 rounded-full"><Shirt size={10} /></div>}
             {item.type === 'studio' && <div className="bg-black text-white p-1 rounded-full"><Building2 size={10} /></div>}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3">
          
          {/* Title */}
          <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2 leading-tight">
            {item.title}
          </h3>

          {/* Specific Content per Type */}
          
          {/* TYPE A: COURSE */}
          {item.type === 'course' && (
            <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <img 
                        src={`https://ui-avatars.com/api/?name=${item.teacher}&background=random`} 
                        className="w-4 h-4 rounded-full" 
                    />
                    <span className="truncate">{item.teacher}</span>
                    {item.isVerifiedTeacher && <span className="text-[8px] bg-blue-50 text-blue-600 px-1 rounded border border-blue-100">本人</span>}
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><MapPin size={10} /> {item.studio}</span>
                    <span className="font-mono bg-gray-50 px-1 rounded">{item.time}</span>
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                    {item.tags.map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">#{t}</span>
                    ))}
                </div>
                <button 
                    onClick={() => onAddToSchedule?.(item)}
                    className="w-full mt-2 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1"
                >
                    <Plus size={12} /> 加入课表
                </button>
            </div>
          )}

          {/* TYPE B: TEACHER */}
          {item.type === 'teacher' && (
             <div className="space-y-2">
                <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                    {item.styles.map(s => <span key={s}>#{s}</span>)}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">契合度 {item.matchRate}%</span>
                    <button className="text-xs font-bold bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200">关注</button>
                </div>
             </div>
          )}

          {/* TYPE C: MUSIC */}
          {item.type === 'music' && (
              <div className="space-y-2">
                  <p className="text-xs text-gray-500">{item.artist}</p>
                  <div className="text-[10px] text-gray-400 bg-gray-50 p-1.5 rounded leading-tight">
                      {item.context}
                  </div>
                  <button className="w-full flex items-center justify-center gap-1 py-1.5 border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50">
                      <Play size={10} fill="currentColor" /> 试听
                  </button>
              </div>
          )}

          {/* TYPE D: BUDDY */}
          {item.type === 'buddy' && (
              <div className="space-y-2">
                  <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                            <img src={item.coverUrl} className="w-full h-full object-cover blur-[1px]" />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{item.nickname}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{item.sharedInterest}</p>
                  <button 
                    onClick={() => onViewProfile?.(item.id, item.nickname)}
                    className="w-full py-1.5 bg-green-50 text-green-700 border border-green-100 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                  >
                      👋 Say Hi
                  </button>
              </div>
          )}

          {/* TYPE F: STUDIO */}
          {item.type === 'studio' && (
               <div className="space-y-2">
                   <div className="flex justify-between items-center text-xs text-gray-500">
                       <span className="flex items-center gap-1"><MapPin size={10} /> {item.location}</span>
                       <span>{item.distance}</span>
                   </div>
                    <button className="w-full py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg">
                      查看课表
                  </button>
               </div>
          )}

          {/* TYPE E: GEAR */}
          {item.type === 'gear' && (
              <div className="space-y-2 mt-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{item.saveCount} 人收藏</span>
                  </div>
              </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
             <div className="flex items-center gap-2">
                 <button onClick={() => toggleLike(item.id)} className="flex items-center gap-1 group/like">
                     <Heart size={16} className={`transition-all ${item.liked ? 'fill-red-500 text-red-500' : 'text-gray-400 group-hover/like:text-red-500'}`} />
                     <span className="text-xs text-gray-400 font-mono">{item.likes}</span>
                 </button>
             </div>
             <button className="text-gray-300 hover:text-black"><MoreHorizontal size={14}/></button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 px-4 py-3 border-b border-gray-100">
            {/* Row 1: City + Search + Bell */}
            <div className="flex items-center gap-3 mb-3">
                 <div className="relative group shrink-0">
                     <button className="flex items-center gap-1 text-sm font-black text-gray-900">
                         {selectedCity} <ChevronDown size={14} />
                     </button>
                     {/* City Dropdown (Mock) */}
                     <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 min-w-[100px] hidden group-hover:block z-30">
                         {CITIES.map(c => (
                             <button key={c} onClick={() => setSelectedCity(c)} className={`block w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-gray-50 ${c===selectedCity ? 'text-red-600' : 'text-gray-600'}`}>
                                 {c}
                             </button>
                         ))}
                     </div>
                 </div>

                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="搜舞室、老师、搭子..."
                        className="w-full bg-gray-100 rounded-full py-2 pl-9 pr-4 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-black/5 outline-none transition-all placeholder-gray-400"
                    />
                </div>
                <Bell size={20} className="text-gray-600" />
            </div>
            
            {/* Row 2: Categories */}
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide text-sm font-bold text-gray-400">
                {CATEGORIES.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`shrink-0 pb-1 border-b-2 transition-colors ${selectedCategory === cat.id ? 'text-black border-black' : 'border-transparent hover:text-gray-600'}`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Content: Waterfall */}
        <div className="flex-1 overflow-y-auto p-2 pb-24">
            {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <p className="text-sm font-bold">暂无内容</p>
                </div>
            ) : (
                <div className="flex gap-2 items-start">
                    <div className="flex-1 flex flex-col gap-2">
                        {leftCol.map(renderCard)}
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        {rightCol.map(renderCard)}
                    </div>
                </div>
            )}
            {filteredItems.length > 0 && (
                <div className="text-center py-6 text-gray-300 text-xs font-bold uppercase tracking-widest">
                    — End of Recommendations —
                </div>
            )}
        </div>
    </div>
  );
};