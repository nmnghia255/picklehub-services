import { Test, TestingModule } from '@nestjs/testing';
import { GeocodingService } from './geocoding.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocodingService],
    }).compile();

    service = module.get<GeocodingService>(GeocodingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('geocode', () => {
    it('should return empty result for empty address', async () => {
      const result = await service.geocode('');
      expect(result).toEqual({ latitude: null, longitude: null, city: null, district: null });
    });

    it('should return coordinates and details on successful Nominatim response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            lat: '10.7769',
            lon: '106.7009',
            address: {
              city: 'Hồ Chí Minh',
              suburb: 'Quận 1',
            },
          },
        ],
      });

      const result = await service.geocode('123 Nguyen Hue, Quan 1, HCMC');
      expect(result).toEqual({
        latitude: 10.7769,
        longitude: 106.7009,
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
      });
      expect(mockedAxios.get).toHaveBeenCalledWith('https://nominatim.openstreetmap.org/search', expect.any(Object));
    });

    it('should fallback to regex parsing when API returns empty results', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      const result = await service.geocode('Hà Nội, Ba Đình');
      expect(result).toEqual({
        latitude: null,
        longitude: null,
        city: 'Hà Nội',
        district: 'Ba Đình',
      });
    });

    it('should fallback to regex parsing when API throws an error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.geocode('Hồ Chí Minh, Quận 7');
      expect(result).toEqual({
        latitude: null,
        longitude: null,
        city: 'Hồ Chí Minh',
        district: 'Quận 7',
      });
    });
  });
});
