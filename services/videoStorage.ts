import { format } from 'date-fns';

export const MAX_VIDEO_COUNT = 3;

const DB_NAME = 'DancerVibeVideoDB';
const STORE_NAME = 'videos';
const VERSION = 1;

export interface StoredVideo {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
  lastPlayedAt: number;
  duration?: number;
  thumbnail?: string; // Data URL
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Helper to generate video thumbnail
const generateThumbnail = (file: File | Blob): Promise<string> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.playsInline = true;
        
        // Seek to 0.5s to ensure we get an image
        video.currentTime = 0.5;

        video.onloadeddata = () => {
            // Wait a bit for seek
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                // Limit thumbnail size
                const w = video.videoWidth;
                const h = video.videoHeight;
                const scale = Math.min(1, 480 / w); // Max width 480px
                
                canvas.width = w * scale;
                canvas.height = h * scale;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    URL.revokeObjectURL(video.src);
                    resolve(dataUrl);
                } else {
                    resolve('');
                }
            }, 200);
        };
        
        video.onerror = () => {
             resolve('');
        }
    });
};

export const saveVideo = async (file: File): Promise<StoredVideo> => {
  const db = await openDB();
  const id = crypto.randomUUID();
  
  // Generate thumbnail
  let thumbnail = '';
  try {
      thumbnail = await generateThumbnail(file);
  } catch (e) {
      console.error("Thumbnail generation failed", e);
  }

  const video: StoredVideo = {
    id,
    name: file.name,
    blob: file,
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    thumbnail: thumbnail
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(video);

    request.onsuccess = () => resolve(video);
    request.onerror = () => reject(request.error);
  });
};

export const getRecentVideos = async (limit = 5): Promise<StoredVideo[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('lastPlayedAt');
    const request = index.openCursor(null, 'prev');
    const results: StoredVideo[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllVideos = async (): Promise<StoredVideo[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastPlayedAt');
      // Get all, sorted by last played desc
      const request = index.getAll();
      
      request.onsuccess = () => {
          // IDB getAll returns in ascending order of key usually, we reverse for desc
          resolve(request.result ? request.result.reverse() : []);
      };
      request.onerror = () => reject(request.error);
    });
};

// NEW: Helper to get count efficiently
export const getVideoCount = async (): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteVideo = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const renameVideo = async (id: string, newName: string): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const getReq = store.get(id);
    
    getReq.onsuccess = () => {
        const data = getReq.result as StoredVideo;
        if (data) {
            data.name = newName;
            store.put(data);
        }
    }
};

export const updateLastPlayed = async (id: string): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First get, then update
    const getReq = store.get(id);
    
    getReq.onsuccess = () => {
        const data = getReq.result as StoredVideo;
        if (data) {
            data.lastPlayedAt = Date.now();
            store.put(data);
        }
    }
};