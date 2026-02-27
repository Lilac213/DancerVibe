import { Song } from '../types';
import { saveSong, findSongByAcrcloudId } from './songService';

interface MusicInfo {
  songId: string;
  title: string;
  artist: string;
  album?: string;
  confidence: number;
  acrcloudId?: string;
}

export const recognizeMusic = async (videoBlob: Blob): Promise<MusicInfo | null> => {
  try {
    const audioBlob = await extractAudio(videoBlob);
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
    const response = await fetch(`${supabaseUrl}/functions/v1/identify-music`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success && result.acrcloudId) {
      // 检查缓存
      let song = await findSongByAcrcloudId(result.acrcloudId);
      
      if (!song) {
        // 保存新歌曲
        song = {
          id: crypto.randomUUID(),
          title: result.title,
          artist: result.artist,
          album: result.album,
          acrcloudId: result.acrcloudId,
          createdAt: new Date().toISOString()
        };
        await saveSong(song);
      }
      
      return {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        confidence: result.confidence,
        acrcloudId: song.acrcloudId
      };
    }
    
    return null;
  } catch (error) {
    console.error('Music recognition failed:', error);
    return null;
  }
};

const extractAudio = (videoBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoBlob);
    
    video.onloadedmetadata = async () => {
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(video);
        const dest = audioContext.createMediaStreamDestination();
        source.connect(dest);
        
        const mediaRecorder = new MediaRecorder(dest.stream);
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          URL.revokeObjectURL(video.src);
          resolve(audioBlob);
        };
        
        video.play();
        mediaRecorder.start();
        
        setTimeout(() => {
          mediaRecorder.stop();
          video.pause();
        }, 15000);
      } catch (error) {
        reject(error);
      }
    };
    
    video.onerror = reject;
  });
};
