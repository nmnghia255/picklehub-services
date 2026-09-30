import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface GeocodingResult {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(address: string): Promise<GeocodingResult> {
    if (!address || !address.trim()) {
      return { latitude: null, longitude: null, city: null, district: null };
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          addressdetails: 1,
          limit: 1,
        },
        headers: {
          'User-Agent': 'PickleHub/1.0 (contact@picklehub.com)',
        },
        timeout: 5000,
      });

      if (response.data && response.data.length > 0) {
        const item = response.data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const details = item.address;

        const city = details.city || details.town || details.village || details.state || null;
        const district = details.suburb || details.district || details.county || null;

        return {
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lon) ? null : lon,
          city: city,
          district: district,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Nominatim geocoding failed for address: "${address}". Error: ${error.message}`);
    }

    return this.fallbackGeocode(address);
  }

  private fallbackGeocode(address: string): GeocodingResult {
    this.logger.log(`Running fallback regex geocoding for address: "${address}"`);
    const addr = address.toLowerCase();

    let city: string | null = null;
    let district: string | null = null;

    if (addr.includes('hà nội') || addr.includes('ha noi')) {
      city = 'Hà Nội';
    } else if (addr.includes('hồ chí minh') || addr.includes('ho chi minh') || addr.includes('hcm') || addr.includes('sài gòn') || addr.includes('sai gon')) {
      city = 'Hồ Chí Minh';
    } else if (addr.includes('đà nẵng') || addr.includes('da nang')) {
      city = 'Đà Nẵng';
    } else if (addr.includes('bình dương') || addr.includes('binh duong')) {
      city = 'Bình Dương';
    } else if (addr.includes('đồng nai') || addr.includes('dong nai')) {
      city = 'Đồng Nai';
    }

    if (addr.includes('quận 1') || addr.includes('district 1') || addr.includes('q1') || addr.includes('q.1')) {
      district = 'Quận 1';
    } else if (addr.includes('quận 2') || addr.includes('district 2') || addr.includes('q2') || addr.includes('q.2')) {
      district = 'Quận 2';
    } else if (addr.includes('quận 3') || addr.includes('district 3') || addr.includes('q3') || addr.includes('q.3')) {
      district = 'Quận 3';
    } else if (addr.includes('quận 7') || addr.includes('district 7') || addr.includes('q7') || addr.includes('q.7')) {
      district = 'Quận 7';
    } else if (addr.includes('thủ đức') || addr.includes('thu duc')) {
      district = 'Thủ Đức';
    } else if (addr.includes('bình thạnh') || addr.includes('binh thanh')) {
      district = 'Bình Thạnh';
    } else if (addr.includes('phú nhuận') || addr.includes('phu nhuan')) {
      district = 'Phú Nhuận';
    } else if (addr.includes('tân bình') || addr.includes('tan binh')) {
      district = 'Tân Bình';
    } else if (addr.includes('gò vấp') || addr.includes('go vap')) {
      district = 'Gò Vấp';
    } else if (addr.includes('hoàn kiếm') || addr.includes('hoan kiem')) {
      district = 'Hoàn Kiếm';
    } else if (addr.includes('ba đình') || addr.includes('ba dinh')) {
      district = 'Ba Đình';
    } else if (addr.includes('đống đa') || addr.includes('dong da')) {
      district = 'Đống Đa';
    } else if (addr.includes('hai bà trưng') || addr.includes('hai ba trung')) {
      district = 'Hai Bà Trưng';
    } else if (addr.includes('cầu giấy') || addr.includes('cau giay')) {
      district = 'Cầu Giấy';
    } else if (addr.includes('tây hồ') || addr.includes('tay ho')) {
      district = 'Tây Hồ';
    } else if (addr.includes('thanh xuân') || addr.includes('thanh xuan')) {
      district = 'Thanh Xuân';
    }

    return {
      latitude: null,
      longitude: null,
      city,
      district,
    };
  }
}
