import { registerPlugin } from '@capacitor/core';

export interface PhotoLibraryPlugin {
  pickVideo(): Promise<{
    assetId: string;
    duration: number;
    width: number;
    height: number;
    creationDate?: string;
    latitude?: number;
    longitude?: number;
  }>;
  
  getVideoUrl(options: { assetId: string }): Promise<{
    url: string;
    duration: number;
  }>;
  
  getThumbnail(options: { assetId: string }): Promise<{
    thumbnail: string;
  }>;
  
  checkPermission(): Promise<{ status: number }>;
  requestPermission(): Promise<{ status: number }>;
}

const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary');

export default PhotoLibrary;
