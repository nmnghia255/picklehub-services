import { Test, TestingModule } from '@nestjs/testing';
import { PosterService } from './poster.service';

describe('PosterService', () => {
  let service: PosterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PosterService],
    }).compile();

    service = module.get<PosterService>(PosterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateMetadataHash', () => {
    it('should generate a valid MD5 hash', () => {
      const name = 'Saigon Winter Open 2026';
      const startDate = new Date('2026-08-20T08:00:00Z');
      const venue = 'Saigon Pickleball Arena, District 7';

      const hash1 = service.generateMetadataHash(name, startDate, venue);
      const hash2 = service.generateMetadataHash(name, startDate, venue);

      expect(hash1).toHaveLength(32);
      expect(hash1).toBe(hash2);

      const hashDifferent = service.generateMetadataHash('Different Name', startDate, venue);
      expect(hash1).not.toBe(hashDifferent);
    });
  });

  describe('generatePoster', () => {
    it('should generate a poster buffer successfully', async () => {
      const tournament = {
        id: 9992,
        name: 'Saigon Winter Open 2026',
        startDate: new Date('2026-08-20T08:00:00Z'),
        venue: 'Saigon Pickleball Arena, District 7',
      };

      const buffer = await service.generatePoster(tournament);
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
