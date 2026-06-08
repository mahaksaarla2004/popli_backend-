import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dekt0pjij',
      api_key: process.env.CLOUDINARY_API_KEY || '277917496774264',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'ekp_Umr7qld9fLwDdKqku033mb0',
    });
  }

  getSignedUrl(folder: string) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET || 'ekp_Umr7qld9fLwDdKqku033mb0'
    );

    return {
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'dekt0pjij',
      apiKey: process.env.CLOUDINARY_API_KEY || '277917496774264',
      folder,
    };
  }
}
