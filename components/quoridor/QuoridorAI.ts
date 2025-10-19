import {
  BOARD_SIZE,
  Position,
  Wall,
  PlayerId,
  buildBlockedEdges,
  getValidPawnMoves,
  canPlaceWall,
  computeAvailableWalls,
  isWinningPosition,
} from './game-logic';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AIMove {
  type: 'move' | 'wall';
  data: Position | Wall;
  score: number;
}

function mirrorPosition(position: Position): Position {
  return {
    row: BOARD_SIZE - 1 - position.row,
    col: position.col,
  };
}

function mirrorWall(wall: Wall): Wall {
  return {
    orientation: wall.orientation,
    row: (BOARD_SIZE - 2) - wall.row,
    col: wall.col,
  };
}

export class QuoridorAI {
  private difficulty: Difficulty;
  private gameHistory: { positions: Record<PlayerId, Position>; walls: Wall[] }[] = [];

  constructor(difficulty: Difficulty) {
    this.difficulty = difficulty;
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
  }

  private recordSnapshot(positions: Record<PlayerId, Position>, walls: Wall[]) {
    this.gameHistory.push({ positions: { ...positions }, walls: [...walls] });
  }

  // ---------- utils ----------
  private getShortestPath(from: Position, targetRow: number, blockedEdges: Set<string>, otherPlayer?: Position): number {
    const queue = [{ pos: from, dist: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { pos, dist } = queue.shift()!;
      const key = `${pos.row},${pos.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (pos.row === targetRow) return dist;

      const moves = getValidPawnMoves(pos, otherPlayer || { row: -1, col: -1 }, blockedEdges);
      for (const move of moves) {
        const moveKey = `${move.row},${move.col}`;
        if (!visited.has(moveKey)) queue.push({ pos: move, dist: dist + 1 });
      }
    }
    return 999;
  }

  // ---------- evaluation ----------
  private evaluatePosition(positions: Record<PlayerId, Position>, walls: Wall[]): number {
    const edges = buildBlockedEdges(walls);
    const aiDist = this.getShortestPath(positions.south, 0, edges, positions.north);
    const playerDist = this.getShortestPath(positions.north, 8, edges, positions.south);

    // Base race evaluation
    let score = (playerDist - aiDist) * 18; // HARD++ slightly higher base weight

    // Positional factors
    const aiRow = positions.south.row;
    const aiCol = positions.south.col;
    const playerRow = positions.north.row;
    const playerCol = positions.north.col;

    // Phase (0..1)
    const totalWalls = walls.length;
    const gamePhase = Math.min(totalWalls / 20, 1);

    // Center control bonus, stronger early; also slight corridor bonus (|col-4| small)
    const centerWeight = 3.5 - gamePhase * 2.2; // HARD++ sharper decay
    score += (4 - Math.abs(aiCol - 4)) * centerWeight;

    // Forward progress (concave for AI, convex penalty for player)
    score += Math.pow(8 - aiRow, 1.55) * 3.4;
    score -= Math.pow(playerRow, 1.45) * 3.2;

    // Mobility differential
    const aiMoves = getValidPawnMoves(positions.south, positions.north, edges);
    const playerMoves = getValidPawnMoves(positions.north, positions.south, edges);
    score += (aiMoves.length - playerMoves.length) * 2.4;

    // Proximity heuristic (close & ahead encourages blocking traps)
    const distToOpponent = Math.abs(aiRow - playerRow) + Math.abs(aiCol - playerCol);
    if (distToOpponent < 3 && aiRow < playerRow) score += 6;

    // Difficulty-specific tweaks
    if (this.difficulty === 'easy') {
      score = score * 0.7 + (8 - aiRow) * 5;
    } else if (this.difficulty === 'hard') {
      // HARD++: penalize giving the opponent mobility, reward late-game distance edges
      score += (playerMoves.length - aiMoves.length) * 3.6;
      if (totalWalls > 10) score += (playerDist - aiDist) * 6.0;

      // Edge/corner aversion for AI (prefer central corridors)
      if (aiCol === 0 || aiCol === 8) score -= 6;
      if (aiCol === 1 || aiCol === 7) score -= 3;

      // Bonus for creating "choke" near opponent (if our col ~= opponent col within 1)
      if (Math.abs(aiCol - playerCol) <= 1 && aiRow < playerRow) score += 5;
    }

    return score;
  }

  // ---------- walls ----------
  private isBlockingWall(wall: Wall, positions: Record<PlayerId, Position>, walls: Wall[]): number {
    const currentEdges = buildBlockedEdges(walls);
    const currentPlayerDist = this.getShortestPath(positions.north, 8, currentEdges, positions.south);
    const testWalls = [...walls, wall];
    const testEdges = buildBlockedEdges(testWalls);
    const newPlayerDist = this.getShortestPath(positions.north, 8, testEdges, positions.south);
    return newPlayerDist - currentPlayerDist;
  }

  private getWallValue(wall: Wall, positions: Record<PlayerId, Position>, walls: Wall[], wallsRemaining: number): number {
    let value = 0;

    // Check if wall blocks AI's own path - heavily penalize
    const currentEdges = buildBlockedEdges(walls);
    const currentAiDist = this.getShortestPath(positions.south, 0, currentEdges, positions.north);
    const testWalls = [...walls, wall];
    const testEdges = buildBlockedEdges(testWalls);
    const newAiDist = this.getShortestPath(positions.south, 0, testEdges, positions.north);
    
    // Heavily penalize walls that increase AI's distance
    if (newAiDist > currentAiDist) {
      value -= (newAiDist - currentAiDist) * 50;
    }

    // Core blocking power for opponent
    const blockingValue = this.isBlockingWall(wall, positions, walls);
    value += blockingValue * 20;

    // Distances to actors
    const distToPlayer = Math.abs(wall.row - positions.north.row) + Math.abs(wall.col - positions.north.col);
    const distToAI = Math.abs(wall.row - positions.south.row) + Math.abs(wall.col - positions.south.col);

    if (distToPlayer <= 2) value += (3 - distToPlayer) * 8;
    if (distToAI < 2) value -= 20; // Stronger penalty for walls too close to AI

    // Strategic positioning - walls should be between players or blocking opponent's path
    if (wall.orientation === 'horizontal') {
      // Horizontal walls should block opponent's forward progress
      if (wall.row >= positions.north.row && wall.row < positions.south.row - 1) {
        value += 15;
      }
      // Avoid walls behind AI
      if (wall.row >= positions.south.row) {
        value -= 25;
      }
    } else {
      // Vertical walls should channel or block opponent
      if (Math.abs(wall.col - positions.north.col) <= 1) value += 12;
      // Avoid walls that might trap AI
      if (Math.abs(wall.col - positions.south.col) <= 1 && wall.row >= positions.south.row - 2) {
        value -= 15;
      }
    }

    // HARD++ predictive/phase logic
    if (this.difficulty === 'hard') {
      const currentEdges = buildBlockedEdges(walls);
      const aiDist = this.getShortestPath(positions.south, 0, currentEdges, positions.north);
      const playerDist = this.getShortestPath(positions.north, 8, currentEdges, positions.south);
      const totalMoves = positions.south.row + (8 - positions.north.row);
      const gamePhase = Math.min(totalMoves / 16, 1);

      const predictedPath = this.predictPlayerPath(positions, walls);
      if (predictedPath.length > 0) {
        const blocksPath = predictedPath.some(pos => {
          if (wall.orientation === 'horizontal') {
            return pos.row === wall.row + 1 && pos.col >= wall.col && pos.col <= wall.col + 1;
          } else {
            return pos.col === wall.col + 1 && pos.row >= wall.row && pos.row <= wall.row + 1;
          }
        });
        if (blocksPath) value += 28; // HIGH for path interception
      }

      // Early game - only place walls that significantly block opponent
      if (gamePhase < 0.3) {
        if (blockingValue < 2) value -= 60;
        if (distToPlayer > 3) value -= 40;
        // Don't place walls near AI in early game
        if (distToAI <= 2) value -= 50;
      }

      // Mid-game - focus on strategic blocking
      if (gamePhase >= 0.3 && gamePhase < 0.7) {
        if (blockingValue < 1 && playerDist - aiDist < 3) value -= 35;
        if (blockingValue >= 2) value += 25;
        
        // Prefer walls that create multiple blocking opportunities
        const testWalls = [...walls, wall];
        const futureWallSpots = computeAvailableWalls('horizontal', testWalls, positions)
          .concat(computeAvailableWalls('vertical', testWalls, positions))
          .filter(w => Math.abs(w.row - positions.north.row) <= 2);
        if (futureWallSpots.length > 4) value += 15;
      }

      // Wall conservation - don't waste walls early
      const wallRatio = wallsRemaining / 10;
      if (gamePhase < 0.4 && wallRatio > 0.6 && blockingValue < 2) value -= 45;
      
      // Late game - be more aggressive with remaining walls
      if (gamePhase > 0.7 && wallRatio > 0.3 && blockingValue >= 1) value += 20;
    }

    return value;
  }

  private addRandomness(score: number): number {
    const randomFactor = this.difficulty === 'easy' ? 0.3 :
      this.difficulty === 'medium' ? 0.15 : 0.015; // HARD++ slightly less noise
    return score + (Math.random() - 0.5) * Math.abs(score) * randomFactor;
  }

  private predictPlayerPath(positions: Record<PlayerId, Position>, walls: Wall[]): Position[] {
    const edges = buildBlockedEdges(walls);
    const queue = [{ pos: positions.north, path: [positions.north] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;
      const key = `${pos.row},${pos.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (pos.row === 8) return path;

      const moves = getValidPawnMoves(pos, positions.south, edges);
      // Greedy toward the goal row
      const bestMove = moves.reduce((best, move) => (move.row > best.row ? move : best), moves[0]);
      if (bestMove && !visited.has(`${bestMove.row},${bestMove.col}`)) {
        queue.push({ pos: bestMove, path: [...path, bestMove] });
      }
    }
    return [];
  }

  private shouldUseWall(positions: Record<PlayerId, Position>, walls: Wall[], wallsRemaining: number): boolean {
    if (wallsRemaining === 0) return false;

    const edges = buildBlockedEdges(walls);
    const aiDist = this.getShortestPath(positions.south, 0, edges, positions.north);
    const playerDist = this.getShortestPath(positions.north, 8, edges, positions.south);
    const totalMoves = positions.south.row + (8 - positions.north.row);
    const gamePhase = Math.min(totalMoves / 16, 1);

    if (this.difficulty === 'easy') return Math.random() < 0.25;

    if (this.difficulty === 'hard') {
      const wallRatio = wallsRemaining / 10;
      const distanceDiff = playerDist - aiDist;

      // Early game - very conservative, only if opponent is close and we're behind
      if (gamePhase < 0.3) {
        if (positions.north.row >= 4 && distanceDiff <= -2) return Math.random() < 0.6;
        if (positions.north.row >= 3 && distanceDiff <= -3) return Math.random() < 0.4;
        return Math.random() < 0.05;
      }

      // Mid game - strategic wall placement
      if (gamePhase < 0.6) {
        const predictedPath = this.predictPlayerPath(positions, walls);
        if (predictedPath.length > 0 && predictedPath.length <= 5) return Math.random() < 0.8;
        if (distanceDiff <= -1) return Math.random() < 0.7;
        if (distanceDiff <= 0) return Math.random() < 0.5;
        return Math.random() < 0.2;
      }

      // Late mid game - more aggressive
      if (gamePhase < 0.8) {
        if (playerDist <= 4 && distanceDiff <= 0) return Math.random() < 0.9;
        if (distanceDiff <= 0) return Math.random() < 0.7;
        if (wallRatio > 0.4) return Math.random() < 0.4;
        return Math.random() < 0.5;
      }

      // End game - use remaining walls strategically
      if (playerDist <= 3) return Math.random() < 0.95;
      if (distanceDiff <= 1) return Math.random() < 0.8;
      return Math.random() < 0.6;
    }

    // medium difficulty
    const distanceDiff = playerDist - aiDist;
    if (distanceDiff <= -1) return Math.random() < 0.8;
    if (distanceDiff <= -3) return Math.random() < 0.4;
    return Math.random() < 0.6;
  }

  // ---------- HARD++: one-ply opponent reply search ----------
  private opponentBestReplyScore(
    positions: Record<PlayerId, Position>,
    walls: Wall[],
    oppWallsRemaining: number
  ): number {
    // From AI perspective, evaluate after opponent (north) plays best.
    // Generate opponent pawn moves
    const edges = buildBlockedEdges(walls);
    const oppMoves = getValidPawnMoves(positions.north, positions.south, edges);

    let best = -Infinity;
    for (const m of oppMoves) {
      const next = { ...positions, north: m };
      const s = this.evaluatePosition(next, walls);
      if (s > best) best = s; // Opponent wants to maximize his advantage (minimize our eval)
    }

    // Consider a handful of top opponent walls if any remain
    if (oppWallsRemaining > 0) {
      const allOppWalls = computeAvailableWalls('horizontal', walls, positions)
        .concat(computeAvailableWalls('vertical', walls, positions))
        .filter(w => canPlaceWall(w, walls, positions));

      // rank by how much they hurt us (inverse of our eval)
      const scored = allOppWalls
        .map(w => {
          const testWalls = [...walls, w];
          return { w, score: this.evaluatePosition(positions, testWalls) };
        })
        .sort((a, b) => a.score - b.score) // lowest eval for us = best for them
        .slice(0, 10); // cap to keep it fast

      for (const { w } of scored) {
        const s = this.evaluatePosition(positions, [...walls, w]);
        if (s > best) best = s;
      }
    }

    return best === -Infinity ? this.evaluatePosition(positions, walls) : best;
  }

  // ---------- move selection ----------
  async getBestMove(
    positions: Record<PlayerId, Position>,
    walls: Wall[],
    wallsRemaining: Record<PlayerId, number>
  ): Promise<AIMove | null> {
    return this.getBestMoveFromTypeScript(positions, walls, wallsRemaining.south);
  }

  private getBestMoveFromTypeScript(
    positions: Record<PlayerId, Position>,
    walls: Wall[],
    wallsRemaining: number
  ): AIMove | null {
    this.recordSnapshot(positions, walls);
    const edges = buildBlockedEdges(walls);
    const aiMoves = getValidPawnMoves(positions.south, positions.north, edges);
    let bestMove: AIMove | null = null;

    // Check for immediate win
    for (const move of aiMoves) {
      if (isWinningPosition('south', move)) {
        return { type: 'move', data: move, score: 1000 };
      }
    }

    // Try pawn moves
    for (const move of aiMoves) {
      const testPos = { ...positions, south: move };
      let score = this.evaluatePosition(testPos, walls);

      // HARD++: look at opponent reply (minimax-ish, depth 1)
      if (this.difficulty === 'hard') {
        const oppReply = this.opponentBestReplyScore(testPos, walls, /*oppWallsRemaining*/ 10); // assume opponent has some walls; adjust if you track it
        // We want to avoid positions where opponent reply improves their eval.
        const replyPenalty = Math.max(0, oppReply - score);
        score = score - 0.85 * replyPenalty;

        // Strong progress incentive - heavily penalize backward or non-progress moves
        const newEdges = buildBlockedEdges(walls);
        const newAiDist = this.getShortestPath(move, 0, newEdges, testPos.north);
        const currentAiDist = this.getShortestPath(positions.south, 0, edges, positions.north);
        
        // Penalize moves that don't improve distance to goal
        if (newAiDist > currentAiDist) score -= 50;
        if (newAiDist === currentAiDist && move.row >= positions.south.row) score -= 30;
        
        // Reward forward progress
        if (move.row < positions.south.row) score += 15;
        
        // Center preference but not at expense of progress
        if (Math.abs(move.col - 4) <= 2 && move.row < positions.south.row) score += 8;
        
        // Avoid self-trapping moves
        const futureAi = getValidPawnMoves(move, testPos.north, newEdges);
        if (futureAi.length <= 1) score -= 40;
        if (futureAi.length === 2) score -= 15;
      }

      score = this.addRandomness(score);
      if (!bestMove || score > bestMove.score) bestMove = { type: 'move', data: move, score };
    }

    // Consider walls
    if (wallsRemaining > 0 && this.shouldUseWall(positions, walls, wallsRemaining)) {
      const allWalls = computeAvailableWalls('horizontal', walls, positions)
        .concat(computeAvailableWalls('vertical', walls, positions));

      const strategicWalls = allWalls
        .filter(wall => canPlaceWall(wall, walls, positions))
        .map(wall => ({ wall, value: this.getWallValue(wall, positions, walls, wallsRemaining) }))
        .sort((a, b) => b.value - a.value);

      const wallsToCheck = this.difficulty === 'easy' ? strategicWalls.slice(0, 3) :
        this.difficulty === 'medium' ? strategicWalls.slice(0, 12) :
          strategicWalls.slice(0, 18); // HARD++ consider a few more

      for (const { wall } of wallsToCheck) {
        const withWall = [...walls, wall];
        let score = this.evaluatePosition(positions, withWall);

        if (this.difficulty === 'hard') {
          // HARD++: if a wall meaningfully increases player's path, boost a lot
          const inc = this.isBlockingWall(wall, positions, walls);
          if (inc >= 2) score += 30;
          if (inc >= 3) score += 50;

          // Consider opponent reply after our wall
          const oppReply = this.opponentBestReplyScore(positions, withWall, /*oppWallsRemaining*/ 9);
          const replyPenalty = Math.max(0, oppReply - score);
          score = score - 0.7 * replyPenalty;

          // Avoid walls that also hurt us (recompute aiDist swing)
          const aiDistBefore = this.getShortestPath(positions.south, 0, buildBlockedEdges(walls), positions.north);
          const aiDistAfter = this.getShortestPath(positions.south, 0, buildBlockedEdges(withWall), positions.north);
          if (aiDistAfter > aiDistBefore) score -= 14;
        }

        score = this.addRandomness(score);

        // if (this.difficulty === 'hard' && bestMove && bestMove.type === 'move' && score <= bestMove.score + 2) {
        //   // Only choose wall if it's significantly better than moving forward
        //   continue;
        // }

        if (!bestMove || score > bestMove.score) {
          bestMove = { type: 'wall', data: wall, score };
        }
      }
    }

    return bestMove;
  }

  getBestMoveForSide(
    side: PlayerId,
    positions: Record<PlayerId, Position>,
    walls: Wall[],
    wallsRemaining: number,
  ): AIMove | null {
    // if (side === 'south') {
    //   const wallsRemainingRecord = { north: 10, south: wallsRemaining };
      return this.getBestMoveFromTypeScript(positions, walls, wallsRemaining);
    // }

    // const mirroredPositions: Record<PlayerId, Position> = {
    //   north: mirrorPosition(positions.south),
    //   south: mirrorPosition(positions.north),
    // };
    //
    // const mirroredWalls = walls.map(mirrorWall);
    // const mirroredMove = this.getBestMoveFromTypeScript(mirroredPositions, mirroredWalls, wallsRemaining);
    //
    // if (!mirroredMove) {
    //   return null;
    // }
    //
    // if (mirroredMove.type === 'move') {
    //   const mirroredData = mirroredMove.data as Position;
    //   return {
    //     ...mirroredMove,
    //     data: mirrorPosition(mirroredData),
    //   };
    // }
    //
    // const mirroredWallPlacement = mirroredMove.data as Wall;
    // return {
    //   ...mirroredMove,
    //   data: mirrorWall(mirroredWallPlacement),
    // };
  }

  getThinkingTime(): number {

    const baseTime = this.difficulty === 'easy' ? 300 :
      this.difficulty === 'medium' ? 1000 : 1400;
    const variation = this.difficulty === 'easy' ? 300 :
      this.difficulty === 'medium' ? 400 : 400;
    return baseTime + Math.random() * variation;
  }
}
