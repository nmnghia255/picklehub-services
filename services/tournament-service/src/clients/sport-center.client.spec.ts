import axios from 'axios';
import { SportCenterClient } from './sport-center.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SportCenterClient', () => {
  const OLD_ENV = process.env;
  let client: SportCenterClient;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...OLD_ENV,
      SPORT_CENTER_SERVICE_URL: 'http://sc:8007',
      SERVICE_INTERNAL_TOKEN: 'sc-token',
    };
    client = new SportCenterClient();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('resolves courts by ids (deduped) into a Map, with the internal-service token', async () => {
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: [{ id: 'c1', name: 'Court 1' }],
    } as any);

    const map = await client.getCourtsByIds(['c1', 'c1']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://sc:8007/api/sport-centers/internal/courts/batch',
      { courtIds: ['c1'] },
      expect.objectContaining({ headers: { 'x-internal-service-token': 'sc-token' } }),
    );
    expect(map.get('c1')).toEqual({ id: 'c1', name: 'Court 1' });
  });

  it('short-circuits to an empty Map when no ids are given', async () => {
    const map = await client.getCourtsByIds([]);
    expect(map.size).toBe(0);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('returns an empty Map when the request throws', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network'));
    const map = await client.getCourtsByIds(['c1']);
    expect(map.size).toBe(0);
  });
});
