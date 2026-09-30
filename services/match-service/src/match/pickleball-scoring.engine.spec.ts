import { MatchType } from '@prisma/client';
import { PickleballScoringEngine, RallyEvent } from './pickleball-scoring.engine';

describe('PickleballScoringEngine', () => {
  const teamA = ['user-a1', 'user-a2'];
  const teamB = ['user-b1', 'user-b2'];

  describe('Đánh đôi (Doubles)', () => {
    it('khởi tạo trạng thái ban đầu của Set 1 ở tỷ số 0-0-2, đội A giao bóng', () => {
      const history: RallyEvent[] = [];
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, history, 1);

      expect(state.scoreA).toBe(0);
      expect(state.scoreB).toBe(0);
      expect(state.servingTeam).toBe('TEAM_A');
      expect(state.serverNumber).toBe(2);
      expect(state.servingPlayerId).toBe('user-a1'); // A1 đứng bên phải ban đầu
      expect(state.scoreCall).toBe('0 - 0 - 2');
      expect(state.positions.teamA.right).toBe('user-a1');
      expect(state.positions.teamA.left).toBe('user-a2');
    });

    it('đội giao bóng ghi điểm: điểm tăng, VĐV giao bóng đổi bên đứng, lượt giao giữ nguyên', () => {
      const history: RallyEvent[] = [
        { scoringTeam: 'TEAM_A', setId: 1 },
      ];
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, history, 1);

      expect(state.scoreA).toBe(1);
      expect(state.scoreB).toBe(0);
      expect(state.servingTeam).toBe('TEAM_A');
      expect(state.serverNumber).toBe(2); // lượt giao thứ 2 giữ nguyên
      expect(state.servingPlayerId).toBe('user-a1'); // VĐV a1 tiếp tục giao bóng
      expect(state.scoreCall).toBe('1 - 0 - 2');
      expect(state.positions.teamA.right).toBe('user-a2'); // đổi bên, a2 đứng phải
      expect(state.positions.teamA.left).toBe('user-a1');  // a1 đứng trái
    });

    it('đội giao bóng thua lượt giao đầu trận (Server 2): chuyển quyền giao bóng (Side-out)', () => {
      const history: RallyEvent[] = [
        { scoringTeam: 'TEAM_B', setId: 1 }, // Team B thắng loạt bóng đầu
      ];
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, history, 1);

      expect(state.scoreA).toBe(0);
      expect(state.scoreB).toBe(0);
      expect(state.servingTeam).toBe('TEAM_B');
      expect(state.serverNumber).toBe(1); // side-out reset về Server 1
      expect(state.servingPlayerId).toBe('user-b1'); // B1 đang đứng bên phải
      expect(state.scoreCall).toBe('0 - 0 - 1'); // Điểm đội giao (B: 0) - Điểm đội nhận (A: 0) - Lượt (1)
    });

    it('loạt điểm đầy đủ của trận đôi', () => {
      const history: RallyEvent[] = [
        { scoringTeam: 'TEAM_A', setId: 1 }, // 1-0-2, A giao, A1/A2 đảo vị trí (A1 đứng trái)
        { scoringTeam: 'TEAM_B', setId: 1 }, // Fault Server 2 -> Side-out -> B giao, lượt Server 1. Tỷ số B: 0, A: 1. Gọi 0-1-1. B1 đứng phải giao.
        { scoringTeam: 'TEAM_B', setId: 1 }, // B thắng -> 1-1-1, B giao, B1/B2 đảo vị trí (B1 đứng trái)
        { scoringTeam: 'TEAM_A', setId: 1 }, // Fault Server 1 -> B chuyển sang Server 2. Gọi 1-1-2. B2 đang đứng phải sẽ giao.
        { scoringTeam: 'TEAM_B', setId: 1 }, // B thắng -> 2-1-2, B giao, B1/B2 đảo vị trí
        { scoringTeam: 'TEAM_A', setId: 1 }, // Fault Server 2 -> Side-out -> A giao, lượt Server 1. Gọi 1-2-1. A2 đang đứng phải sẽ giao.
      ];

      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, history, 1);

      expect(state.scoreA).toBe(1);
      expect(state.scoreB).toBe(2);
      expect(state.servingTeam).toBe('TEAM_A');
      expect(state.serverNumber).toBe(1);
      expect(state.scoreCall).toBe('1 - 2 - 1');
    });
  });

  describe('Đánh đơn (Singles)', () => {
    const singleA = ['user-a1'];
    const singleB = ['user-b1'];

    it('khởi tạo trận đơn ở tỷ số 0-0, đội A giao', () => {
      const history: RallyEvent[] = [];
      const state = PickleballScoringEngine.computeState(singleA, singleB, MatchType.SINGLES, history, 1);

      expect(state.scoreA).toBe(0);
      expect(state.scoreB).toBe(0);
      expect(state.servingTeam).toBe('TEAM_A');
      expect(state.serverNumber).toBe(1);
      expect(state.scoreCall).toBe('0 - 0');
    });

    it('giao bóng thắng loạt bóng -> điểm tăng, giao bóng thua loạt bóng -> side-out', () => {
      const history: RallyEvent[] = [
        { scoringTeam: 'TEAM_A', setId: 1 }, // A thắng -> 1-0
        { scoringTeam: 'TEAM_B', setId: 1 }, // A thua loạt bóng -> Side-out sang B. B:0, A:1. Gọi 0-1.
      ];
      const state = PickleballScoringEngine.computeState(singleA, singleB, MatchType.SINGLES, history, 1);

      expect(state.scoreA).toBe(1);
      expect(state.scoreB).toBe(0);
      expect(state.servingTeam).toBe('TEAM_B');
      expect(state.scoreCall).toBe('0 - 1');
    });
  });

  describe('Đội giao bóng đầu tiên (firstServingTeam)', () => {
    it('khi firstServingTeam = TEAM_B, Set 1 bắt đầu với TEAM_B giao bóng', () => {
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, [], 1, 'TEAM_B');
      expect(state.servingTeam).toBe('TEAM_B');
      expect(state.servingPlayerId).toBe('user-b1');
      expect(state.scoreCall).toBe('0 - 0 - 2');
    });

    it('khi firstServingTeam = TEAM_B, Set 2 bắt đầu với TEAM_A giao bóng', () => {
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, [], 2, 'TEAM_B');
      expect(state.servingTeam).toBe('TEAM_A');
      expect(state.servingPlayerId).toBe('user-a1');
    });

    it('khi firstServingTeam = TEAM_B, Set 3 bắt đầu với TEAM_B giao bóng', () => {
      const state = PickleballScoringEngine.computeState(teamA, teamB, MatchType.DOUBLES, [], 3, 'TEAM_B');
      expect(state.servingTeam).toBe('TEAM_B');
    });
  });
});
