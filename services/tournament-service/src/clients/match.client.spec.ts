import axios from 'axios';
import { MatchClient } from './match.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MatchClient', () => {
  const OLD_ENV = process.env;
  let client: MatchClient;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...OLD_ENV,
      MATCH_SERVICE_URL: 'http://match:8005',
      SERVICE_INTERNAL_TOKEN: 'match-token',
    };
    client = new MatchClient();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('posts a batch to the internal endpoint with the match internal-service token', async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: [{ id: 'm1' }] } as any);

    const result = await client.createBatch({ matches: [] });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://match:8005/api/matches/internal/batch',
      { matches: [] },
      expect.objectContaining({ headers: { 'x-internal-service-token': 'match-token' } }),
    );
    expect(result).toEqual([{ id: 'm1' }]);
  });

  it('unwraps a { data: [...] } envelope', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { data: [{ id: 'm2' }] } } as any);
    expect(await client.createBatch({})).toEqual([{ id: 'm2' }]);
  });

  it('unwraps the batch { created, matches } envelope', async () => {
    mockedAxios.post.mockResolvedValue({ status: 201, data: { created: 1, matches: [{ id: 'm3' }] } } as any);
    expect(await client.createBatch({})).toEqual([{ id: 'm3' }]);
  });

  it('confirms a result by forwarding the caller JWT', async () => {
    mockedAxios.patch.mockResolvedValue({ status: 200, data: { status: 'CONFIRMED' } } as any);
    const res = await client.confirmResult('m1', { winner: 'TEAM_A' }, 'Bearer jwt');
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      'http://match:8005/api/matches/m1/confirm',
      { winner: 'TEAM_A' },
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt' } }),
    );
    expect(res).toEqual({ status: 'CONFIRMED' });
  });

  it('lists a tournament by uuid + status with the internal token', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200, data: { items: [{ id: 'm1' }] } } as any);
    const res = await client.listByTournament('t-uuid', 'CONFIRMED');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://match:8005/api/matches',
      expect.objectContaining({
        params: { tournamentId: 't-uuid', status: 'CONFIRMED', limit: 200 },
        headers: { 'x-internal-service-token': 'match-token' },
      }),
    );
    expect(res).toEqual([{ id: 'm1' }]);
  });

  it('returns [] on a non-2xx response', async () => {
    mockedAxios.post.mockResolvedValue({ status: 500, data: null } as any);
    expect(await client.createBatch({})).toEqual([]);
  });

  it('returns [] when the request throws', async () => {
    mockedAxios.post.mockRejectedValue(new Error('network'));
    expect(await client.createBatch({})).toEqual([]);
  });
});
