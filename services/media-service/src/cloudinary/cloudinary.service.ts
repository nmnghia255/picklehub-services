import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  uploadFile(
    file: any,
    folder?: string,
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        ...(folder ? { folder } : {}),
        resource_type: resourceType,
      };
      
      if (file && file.originalname) {
        const extensionMatch = file.originalname.match(/\.[^/.]+$/);
        const extension = extensionMatch ? extensionMatch[0] : '';
        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        
        const isPdf = extension.toLowerCase() === '.pdf';
        // Do not append .pdf to avoid Cloudinary strict delivery 401 blocks.
        if (resourceType === 'raw' && !isPdf && extension) {
          uploadOptions.public_id = `${baseName}-${randomSuffix}${extension}`;
        } else {
          uploadOptions.public_id = `${baseName}-${randomSuffix}`;
        }
      }
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          if (result) return resolve(result);
          reject(new Error('Unknown Cloudinary Error'));
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
