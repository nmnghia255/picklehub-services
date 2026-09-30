import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CloudinaryService } from './cloudinary/cloudinary.service';

describe('AppController', () => {
  let appController: AppController;
  let cloudinaryService: jest.Mocked<CloudinaryService>;

  beforeEach(async () => {
    const mockCloudinaryService = {
      uploadFile: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    cloudinaryService = app.get(CloudinaryService);
  });

  describe('uploadImage', () => {
    it('should call cloudinaryService.uploadFile and return formatted response', async () => {
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;
      const mockResult = {
        secure_url: 'https://cloudinary.com/image.png',
        public_id: 'test_id',
        format: 'png',
      } as any;

      cloudinaryService.uploadFile.mockResolvedValue(mockResult);

      const result = await appController.uploadImage(mockFile);

      expect(cloudinaryService.uploadFile).toHaveBeenCalledWith(mockFile, 'picklehub');
      expect(result).toEqual({
        url: 'https://cloudinary.com/image.png',
        publicId: 'test_id',
        format: 'png',
      });
    });
  });
});
