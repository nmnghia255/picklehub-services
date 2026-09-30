import { MatchType } from '@prisma/client';

export interface PlayerPositions {
  right: string;
  left: string | null;
}

export interface PickleballState {
  scoreA: number;
  scoreB: number;
  servingTeam: 'TEAM_A' | 'TEAM_B';
  servingPlayerId: string;
  serverNumber: number; // 1 or 2 for doubles
  scoreCall: string;
  positions: {
    teamA: PlayerPositions;
    teamB: PlayerPositions;
  };
}

export interface RallyEvent {
  scoringTeam: string;
  setId: number;
}

export class PickleballScoringEngine {
  /**
   * Computes the current state of a match or set by replaying all rallies sequentially.
   *
   * @param teamA Array of user IDs for Team A
   * @param teamB Array of user IDs for Team B
   * @param matchType Thể thức (SINGLES or DOUBLES)
   * @param history Lịch sử các loạt bóng (rallies) đã đấu, sắp xếp theo thời gian tăng dần
   * @param targetSetId ID của set đấu cần tính toán (1-indexed). Nếu không truyền sẽ tính cho set hiện tại (cuối cùng).
   */
  static computeState(
    teamA: string[],
    teamB: string[],
    matchType: MatchType,
    history: RallyEvent[],
    targetSetId?: number,
    firstServingTeam: 'TEAM_A' | 'TEAM_B' = 'TEAM_A'
  ): PickleballState {
    const isDoubles = matchType === MatchType.DOUBLES;

    // 1. Lọc lịch sử theo Set mục tiêu. Nếu không chỉ định, lấy setId lớn nhất trong history
    const activeSetId = targetSetId ?? (history.length > 0 ? Math.max(...history.map(h => h.setId)) : 1);
    const setRallies = history.filter(h => h.setId === activeSetId);

    // 2. Khởi tạo trạng thái ban đầu của Set
    // Set 1 và 3 giao bóng theo firstServingTeam. Set 2 đảo ngược.
    let servingTeam: 'TEAM_A' | 'TEAM_B';
    if (activeSetId === 2) {
      servingTeam = firstServingTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
    } else {
      servingTeam = firstServingTeam;
    }
    
    // Đánh đôi bắt đầu ở lượt giao 2 (gọi là 0-0-2). Đánh đơn bắt đầu ở lượt giao 1.
    let serverNumber = isDoubles ? 2 : 1;

    // Vị trí đứng ban đầu của VĐV
    const positions = {
      teamA: {
        right: teamA[0] || 'Player A1',
        left: isDoubles ? teamA[1] || 'Player A2' : null,
      },
      teamB: {
        right: teamB[0] || 'Player B1',
        left: isDoubles ? teamB[1] || 'Player B2' : null,
      },
    };

    let scoreA = 0;
    let scoreB = 0;

    // Để theo dõi VĐV đang giao bóng trực tiếp, ta khai báo biến lưu ID VĐV giao bóng
    let servingPlayerId = servingTeam === 'TEAM_A' ? positions.teamA.right : positions.teamB.right;

    // 3. Quét qua từng loạt bóng trong lịch sử của Set
    for (const rally of setRallies) {
      const winner = rally.scoringTeam;

      if (winner === servingTeam) {
        // --- ĐỘI GIAO BÓNG THẮNG LOẠT BÓNG (Ghi điểm) ---
        if (servingTeam === 'TEAM_A') {
          scoreA++;
        } else {
          scoreB++;
        }

        // Đảo vị trí đứng của 2 VĐV đội giao bóng (Đánh đôi)
        if (isDoubles) {
          const teamPos = servingTeam === 'TEAM_A' ? positions.teamA : positions.teamB;
          const temp = teamPos.right;
          teamPos.right = teamPos.left!;
          teamPos.left = temp;
          // VĐV giao bóng giữ nguyên, nhưng vị trí đứng đã đổi
        }
      } else {
        // --- ĐỘI GIAO BÓNG THUA LOẠT BÓNG (Fault / Side-out) ---
        if (isDoubles) {
          if (serverNumber === 1) {
            // Chuyển sang lượt giao của Server 2
            serverNumber = 2;
            
            // Người giao bóng mới là VĐV đồng đội (đang đứng ở vị trí còn lại)
            const teamPos = servingTeam === 'TEAM_A' ? positions.teamA : positions.teamB;
            servingPlayerId = servingPlayerId === teamPos.right ? teamPos.left! : teamPos.right;
          } else {
            // Đã là Server 2 ➔ SIDE-OUT (Chuyển giao sang đối thủ)
            servingTeam = servingTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
            serverNumber = 1;

            // Người giao bóng đầu tiên (Server 1) của lượt mới là người đang đứng bên PHẢI của đội giao mới
            const newTeamPos = servingTeam === 'TEAM_A' ? positions.teamA : positions.teamB;
            servingPlayerId = newTeamPos.right;
          }
        } else {
          // Đánh đơn: lập tức Side-out
          servingTeam = servingTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
          // VĐV giao bóng mới
          servingPlayerId = servingTeam === 'TEAM_A' ? positions.teamA.right : positions.teamB.right;
        }
      }
    }

    // 4. Định dạng chuỗi đọc điểm gợi ý (scoreCall)
    let scoreCall = '';
    if (isDoubles) {
      if (servingTeam === 'TEAM_A') {
        scoreCall = `${scoreA} - ${scoreB} - ${serverNumber}`;
      } else {
        scoreCall = `${scoreB} - ${scoreA} - ${serverNumber}`;
      }
    } else {
      if (servingTeam === 'TEAM_A') {
        scoreCall = `${scoreA} - ${scoreB}`;
      } else {
        scoreCall = `${scoreB} - ${scoreA}`;
      }
    }

    return {
      scoreA,
      scoreB,
      servingTeam,
      servingPlayerId,
      serverNumber,
      scoreCall,
      positions,
    };
  }
}
