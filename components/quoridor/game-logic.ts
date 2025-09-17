export const BOARD_SIZE = 9;
export const MAX_WALLS_PER_PLAYER = 10;

export type Orientation = 'horizontal' | 'vertical';

export type Position = {
  row: number;
  col: number;
};

export type Wall = {
  row: number;
  col: number;
  orientation: Orientation;
};

export type PlayerId = 'north' | 'south';

export const INITIAL_POSITIONS: Record<PlayerId, Position> = {
  north: { row: 0, col: Math.floor(BOARD_SIZE / 2) },
  south: { row: BOARD_SIZE - 1, col: Math.floor(BOARD_SIZE / 2) },
};

const GOAL_ROW: Record<PlayerId, number> = {
  north: BOARD_SIZE - 1,
  south: 0,
};

const DIRECTIONS: Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const PERPENDICULARS: Record<string, Position[]> = {
  '1,0': [
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ],
  '-1,0': [
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ],
  '0,1': [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
  ],
  '0,-1': [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
  ],
};

export function getOpponent(player: PlayerId): PlayerId {
  return player === 'north' ? 'south' : 'north';
}

export function positionKey({ row, col }: Position): string {
  return `${row},${col}`;
}

function edgeKey(a: Position, b: Position): string {
  if (a.row < b.row || (a.row === b.row && a.col <= b.col)) {
    return `${a.row},${a.col}-${b.row},${b.col}`;
  }
  return `${b.row},${b.col}-${a.row},${a.col}`;
}

function isWithinBounds({ row, col }: Position): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isWallWithinBounds({ row, col, orientation }: Wall): boolean {
  const limit = BOARD_SIZE - 1;
  if (row < 0 || col < 0 || row >= limit || col >= limit) {
    return false;
  }
  return orientation === 'horizontal' || orientation === 'vertical';
}

export function buildBlockedEdges(walls: Wall[]): Set<string> {
  const blocked = new Set<string>();

  for (const wall of walls) {
    for (const edge of getWallEdgeKeys(wall)) {
      blocked.add(edge);
    }
  }

  return blocked;
}

function isEdgeBlocked(a: Position, b: Position, blockedEdges: Set<string>): boolean {
  return blockedEdges.has(edgeKey(a, b));
}

function getWallEdgeKeys(wall: Wall): string[] {
  const topLeft = { row: wall.row, col: wall.col };
  const topRight = { row: wall.row, col: wall.col + 1 };
  const bottomLeft = { row: wall.row + 1, col: wall.col };
  const bottomRight = { row: wall.row + 1, col: wall.col + 1 };

  if (wall.orientation === 'horizontal') {
    return [edgeKey(topLeft, bottomLeft), edgeKey(topRight, bottomRight)];
  }

  return [edgeKey(topLeft, topRight), edgeKey(bottomLeft, bottomRight)];
}

function getAdjacentPositions({ row, col }: Position): Position[] {
  return DIRECTIONS.map((delta) => ({ row: row + delta.row, col: col + delta.col })).filter((pos) =>
    isWithinBounds(pos),
  );
}

export function getValidPawnMoves(
  current: Position,
  opponent: Position,
  blockedEdges: Set<string>,
): Position[] {
  const moves: Position[] = [];

  for (const delta of DIRECTIONS) {
    const adjacent = { row: current.row + delta.row, col: current.col + delta.col };
    if (!isWithinBounds(adjacent) || isEdgeBlocked(current, adjacent, blockedEdges)) {
      continue;
    }

    if (adjacent.row === opponent.row && adjacent.col === opponent.col) {
      const jump = { row: adjacent.row + delta.row, col: adjacent.col + delta.col };

      if (isWithinBounds(jump) && !isEdgeBlocked(adjacent, jump, blockedEdges)) {
        moves.push(jump);
        continue;
      }

      const perpendicularKey = `${delta.row},${delta.col}`;
      const diagonals = PERPENDICULARS[perpendicularKey] ?? [];

      for (const diagDelta of diagonals) {
        const diagonal = { row: adjacent.row + diagDelta.row, col: adjacent.col + diagDelta.col };
        if (
          isWithinBounds(diagonal) &&
          !isEdgeBlocked(adjacent, diagonal, blockedEdges) &&
          !isEdgeBlocked(current, adjacent, blockedEdges)
        ) {
          moves.push(diagonal);
        }
      }
    } else {
      moves.push(adjacent);
    }
  }

  const uniqueMoves: Position[] = [];
  const seen = new Set<string>();
  for (const move of moves) {
    const key = positionKey(move);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMoves.push(move);
    }
  }
  return uniqueMoves;
}

function bfsHasPath(start: Position, goalRow: number, blockedEdges: Set<string>): boolean {
  const queue: Position[] = [start];
  const visited = new Set<string>([positionKey(start)]);

  for (let i = 0; i < queue.length; i += 1) {
    const node = queue[i];
    if (node.row === goalRow) {
      return true;
    }

    for (const neighbor of getAdjacentPositions(node)) {
      if (isEdgeBlocked(node, neighbor, blockedEdges)) {
        continue;
      }

      const key = positionKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  return false;
}

function crossesExistingWall(candidate: Wall, walls: Wall[]): boolean {
  return walls.some(
    (wall) =>
      wall.orientation !== candidate.orientation &&
      wall.row === candidate.row &&
      wall.col === candidate.col,
  );
}

export function canPlaceWall(
  candidate: Wall,
  walls: Wall[],
  positions: Record<PlayerId, Position>,
): boolean {
  if (!isWallWithinBounds(candidate)) {
    return false;
  }

  if (crossesExistingWall(candidate, walls)) {
    return false;
  }

  const blockedEdges = buildBlockedEdges(walls);
  const candidateEdges = getWallEdgeKeys(candidate);

  if (candidateEdges.some((edge) => blockedEdges.has(edge))) {
    return false;
  }

  const updatedBlockedEdges = new Set(blockedEdges);
  for (const edge of candidateEdges) {
    updatedBlockedEdges.add(edge);
  }

  return (
    bfsHasPath(positions.north, GOAL_ROW.north, updatedBlockedEdges) &&
    bfsHasPath(positions.south, GOAL_ROW.south, updatedBlockedEdges)
  );
}

export function computeAvailableWalls(
  orientation: Orientation,
  walls: Wall[],
  positions: Record<PlayerId, Position>,
): Wall[] {
  const placements: Wall[] = [];

  for (let row = 0; row < BOARD_SIZE - 1; row += 1) {
    for (let col = 0; col < BOARD_SIZE - 1; col += 1) {
      const candidate: Wall = { row, col, orientation };
      if (canPlaceWall(candidate, walls, positions)) {
        placements.push(candidate);
      }
    }
  }

  return placements;
}

export function isWinningPosition(player: PlayerId, position: Position): boolean {
  return position.row === GOAL_ROW[player];
}

export function describeWallPlacement(wall: Wall): string {
  const direction = wall.orientation === 'horizontal' ? 'east-west' : 'north-south';
  const article = wall.orientation === 'horizontal' ? 'an' : 'a';
  return `${article} ${direction} wall at row ${wall.row + 1}, column ${wall.col + 1}`;
}