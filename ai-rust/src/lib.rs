use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{HashSet, VecDeque};
use wasm_bindgen::prelude::*;

const BOARD_SIZE: i32 = 9;
const GOAL_SOUTH: i32 = 0;
const GOAL_NORTH: i32 = BOARD_SIZE - 1;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Position {
    pub row: i32,
    pub col: i32,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Orientation {
    Horizontal,
    Vertical,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Wall {
    pub row: i32,
    pub col: i32,
    pub orientation: Orientation,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct Positions {
    pub north: Position,
    pub south: Position,
}

#[derive(Clone, Copy, Debug, Deserialize, Default)]
pub struct WallsRemaining {
    #[serde(default = "zero")]
    pub north: u8,
    #[serde(default = "zero")]
    pub south: u8,
}

fn zero() -> u8 {
    0
}

#[derive(Clone, Debug, Deserialize)]
pub struct GameStateInput {
    pub positions: Positions,
    #[serde(default)]
    pub walls: Vec<Wall>,
    #[serde(rename = "wallsRemaining")]
    #[serde(default)]
    pub walls_remaining: WallsRemaining,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum BestMoveOutput {
    Move { data: Position },
    Wall { data: Wall },
}

#[derive(Clone, Debug)]
struct GameState {
    positions: Positions,
    walls: Vec<Wall>,
    walls_remaining: WallsRemaining,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Player {
    North,
    South,
}

impl Player {
    fn opponent(self) -> Player {
        match self {
            Player::North => Player::South,
            Player::South => Player::North,
        }
    }
}

impl GameState {
    fn for_player(&self, player: Player) -> Position {
        match player {
            Player::North => self.positions.north,
            Player::South => self.positions.south,
        }
    }

    fn goal_row(player: Player) -> i32 {
        match player {
            Player::North => GOAL_NORTH,
            Player::South => GOAL_SOUTH,
        }
    }

    fn walls_left(&self, player: Player) -> u8 {
        match player {
            Player::North => self.walls_remaining.north,
            Player::South => self.walls_remaining.south,
        }
    }

    fn update_position(&mut self, player: Player, pos: Position) {
        match player {
            Player::North => self.positions.north = pos,
            Player::South => self.positions.south = pos,
        }
    }

    fn decrement_wall(&mut self, player: Player) {
        match player {
            Player::North => {
                if self.walls_remaining.north > 0 {
                    self.walls_remaining.north -= 1;
                }
            }
            Player::South => {
                if self.walls_remaining.south > 0 {
                    self.walls_remaining.south -= 1;
                }
            }
        }
    }
}

#[wasm_bindgen]
pub fn get_best_move(state: &str) -> String {
    init_panic_hook();
    let parsed: Result<GameStateInput, _> = serde_json::from_str(state);
    let Ok(parsed) = parsed else {
        return serde_json::to_string(&BestMoveOutput::Move {
            data: Position { row: 7, col: 4 },
        })
        .unwrap_or_else(|_| "{}".to_string());
    };

    let mut game_state = GameState {
        positions: parsed.positions,
        walls: parsed.walls,
        walls_remaining: parsed.walls_remaining,
    };

    if game_state.walls.is_empty() {
        game_state.walls = Vec::new();
    }

    let (best_move, _) = search_best_move(&game_state);
    match best_move {
        Some(MoveChoice::Pawn(pos)) => serde_json::to_string(&BestMoveOutput::Move { data: pos })
            .unwrap_or_else(|_| "{}".to_string()),
        Some(MoveChoice::Wall(wall)) => serde_json::to_string(&BestMoveOutput::Wall { data: wall })
            .unwrap_or_else(|_| "{}".to_string()),
        None => serde_json::to_string(&BestMoveOutput::Move {
            data: fallback_move(game_state.positions.south, &game_state),
        })
        .unwrap_or_else(|_| "{}".to_string()),
    }
}

#[derive(Clone, Debug)]
enum MoveChoice {
    Pawn(Position),
    Wall(Wall),
}

fn search_best_move(state: &GameState) -> (Option<MoveChoice>, f32) {
    let depth = if state.walls_remaining.south > 4 {
        3
    } else {
        2
    };
    let (score, mv) = minimax(
        state,
        depth,
        f32::NEG_INFINITY,
        f32::INFINITY,
        Player::South,
    );
    (mv, score)
}

fn minimax(
    state: &GameState,
    depth: i32,
    mut alpha: f32,
    mut beta: f32,
    player: Player,
) -> (f32, Option<MoveChoice>) {
    if depth == 0 || is_terminal(state) {
        return (evaluate(state), None);
    }

    let mut best_move = None;
    if player == Player::South {
        let mut best_score = f32::NEG_INFINITY;
        for mv in generate_moves(state, player, depth) {
            if let Some(next_state) = apply_move(state, player, &mv) {
                let (score, _) = minimax(&next_state, depth - 1, alpha, beta, player.opponent());
                if score > best_score {
                    best_score = score;
                    best_move = Some(mv.clone());
                }
                alpha = alpha.max(best_score);
                if beta <= alpha {
                    break;
                }
            }
        }
        (best_score, best_move)
    } else {
        let mut best_score = f32::INFINITY;
        for mv in generate_moves(state, player, depth) {
            if let Some(next_state) = apply_move(state, player, &mv) {
                let (score, _) = minimax(&next_state, depth - 1, alpha, beta, player.opponent());
                if score < best_score {
                    best_score = score;
                    best_move = Some(mv.clone());
                }
                beta = beta.min(best_score);
                if beta <= alpha {
                    break;
                }
            }
        }
        (best_score, best_move)
    }
}

fn is_terminal(state: &GameState) -> bool {
    state.positions.south.row == GOAL_SOUTH || state.positions.north.row == GOAL_NORTH
}

fn evaluate(state: &GameState) -> f32 {
    let edges = build_blocked_edges(&state.walls);
    let ai_dist = shortest_path(
        state.positions.south,
        GOAL_SOUTH,
        &edges,
        Some(state.positions.north),
    );
    let player_dist = shortest_path(
        state.positions.north,
        GOAL_NORTH,
        &edges,
        Some(state.positions.south),
    );

    let ai_dist = ai_dist as f32;
    let player_dist = player_dist as f32;

    let mut score = (player_dist - ai_dist) * 20.0;

    let ai_row = state.positions.south.row as f32;
    let ai_col = state.positions.south.col as f32;
    let player_row = state.positions.north.row as f32;
    let player_col = state.positions.north.col as f32;

    score += (4.0 - (ai_col - 4.0).abs()) * 3.0;
    score -= (4.0 - (player_col - 4.0).abs()) * 1.5;

    score += (8.0 - ai_row).powf(1.4) * 3.5;
    score -= player_row.powf(1.35) * 3.0;

    let ai_moves = get_valid_pawn_moves(state.positions.south, state.positions.north, &edges);
    let player_moves = get_valid_pawn_moves(state.positions.north, state.positions.south, &edges);
    score += (ai_moves.len() as f32 - player_moves.len() as f32) * 2.0;

    let dist_between = (ai_row - player_row).abs() + (ai_col - player_col).abs();
    if dist_between < 3.0 && ai_row < player_row {
        score += 6.0;
    }

    score += (state.walls_remaining.south as f32 - state.walls_remaining.north as f32) * 1.5;

    if state.positions.south.row == GOAL_SOUTH {
        score += 10000.0;
    }
    if state.positions.north.row == GOAL_NORTH {
        score -= 10000.0;
    }

    score
}

fn generate_moves(state: &GameState, player: Player, depth: i32) -> Vec<MoveChoice> {
    let mut moves: Vec<MoveChoice> = Vec::new();
    let edges = build_blocked_edges(&state.walls);
    let self_pos = state.for_player(player);
    let opp_pos = state.for_player(player.opponent());

    for pos in get_valid_pawn_moves(self_pos, opp_pos, &edges) {
        moves.push(MoveChoice::Pawn(pos));
    }

    if state.walls_left(player) > 0 {
        let mut candidates: Vec<(f32, Wall)> = Vec::new();
        for orientation in [Orientation::Horizontal, Orientation::Vertical] {
            for row in 0..(BOARD_SIZE - 1) {
                for col in 0..(BOARD_SIZE - 1) {
                    let wall = Wall {
                        row,
                        col,
                        orientation,
                    };
                    if can_place_wall(&wall, &state.walls, state.positions) {
                        let value = wall_value(state, &wall, player, &edges);
                        if value > -200.0 {
                            candidates.push((value, wall));
                        }
                    }
                }
            }
        }
        candidates.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let cap = if depth > 2 { 12 } else { 8 };
        for (_, wall) in candidates.into_iter().take(cap) {
            moves.push(MoveChoice::Wall(wall));
        }
    }

    moves
}

fn wall_value(state: &GameState, wall: &Wall, player: Player, edges: &HashSet<u16>) -> f32 {
    let mut next_walls = state.walls.clone();
    next_walls.push(wall.clone());
    let next_edges = build_blocked_edges(&next_walls);

    let player_pos = state.for_player(player);
    let opp_pos = state.for_player(player.opponent());

    let opp_before = shortest_path(
        opp_pos,
        GameState::goal_row(player.opponent()),
        edges,
        Some(player_pos),
    );
    let opp_after = shortest_path(
        opp_pos,
        GameState::goal_row(player.opponent()),
        &next_edges,
        Some(player_pos),
    );
    let self_before = shortest_path(
        player_pos,
        GameState::goal_row(player),
        edges,
        Some(opp_pos),
    );
    let self_after = shortest_path(
        player_pos,
        GameState::goal_row(player),
        &next_edges,
        Some(opp_pos),
    );

    let blocking_gain = (opp_after - opp_before) as f32;
    let self_penalty = (self_after - self_before) as f32;

    let dist_to_opp = (wall.row - opp_pos.row).abs() + (wall.col - opp_pos.col).abs();
    let dist_to_self = (wall.row - player_pos.row).abs() + (wall.col - player_pos.col).abs();

    let orientation_bonus = match wall.orientation {
        Orientation::Horizontal => {
            if wall.row > opp_pos.row {
                4.0
            } else {
                2.0
            }
        }
        Orientation::Vertical => {
            if (wall.col - opp_pos.col).abs() <= 1 {
                5.0
            } else {
                3.0
            }
        }
    };

    blocking_gain * 25.0 - self_penalty * 18.0 + orientation_bonus - (dist_to_self as f32) * 2.0
        + (max(0, 4 - dist_to_opp) as f32) * 4.0
}

fn apply_move(state: &GameState, player: Player, mv: &MoveChoice) -> Option<GameState> {
    let mut next_state = state.clone();
    match mv {
        MoveChoice::Pawn(pos) => {
            next_state.update_position(player, *pos);
            Some(next_state)
        }
        MoveChoice::Wall(wall) => {
            if !can_place_wall(wall, &state.walls, state.positions) {
                return None;
            }
            next_state.walls.push(wall.clone());
            next_state.decrement_wall(player);
            Some(next_state)
        }
    }
}

fn fallback_move(current: Position, state: &GameState) -> Position {
    let edges = build_blocked_edges(&state.walls);
    let moves = get_valid_pawn_moves(current, state.positions.north, &edges);
    moves.into_iter().max_by_key(|p| -p.row).unwrap_or(current)
}

fn can_place_wall(candidate: &Wall, walls: &[Wall], positions: Positions) -> bool {
    if candidate.row < 0
        || candidate.col < 0
        || candidate.row >= BOARD_SIZE - 1
        || candidate.col >= BOARD_SIZE - 1
    {
        return false;
    }

    for wall in walls {
        if wall.row == candidate.row
            && wall.col == candidate.col
            && wall.orientation != candidate.orientation
        {
            return false;
        }
    }

    let mut edges = build_blocked_edges(walls);
    let wall_edges = wall_edge_keys(candidate);
    for edge in &wall_edges {
        if edges.contains(edge) {
            return false;
        }
    }

    for edge in wall_edges {
        edges.insert(edge);
    }

    bfs_has_path(positions.north, GOAL_NORTH, &edges)
        && bfs_has_path(positions.south, GOAL_SOUTH, &edges)
}

fn build_blocked_edges(walls: &[Wall]) -> HashSet<u16> {
    let mut blocked = HashSet::new();
    for wall in walls {
        for edge in wall_edge_keys(wall) {
            blocked.insert(edge);
        }
    }
    blocked
}

fn wall_edge_keys(wall: &Wall) -> Vec<u16> {
    let top_left = Position {
        row: wall.row,
        col: wall.col,
    };
    let top_right = Position {
        row: wall.row,
        col: wall.col + 1,
    };
    let bottom_left = Position {
        row: wall.row + 1,
        col: wall.col,
    };
    let bottom_right = Position {
        row: wall.row + 1,
        col: wall.col + 1,
    };

    match wall.orientation {
        Orientation::Horizontal => vec![
            edge_key(top_left, bottom_left),
            edge_key(top_right, bottom_right),
        ],
        Orientation::Vertical => vec![
            edge_key(top_left, top_right),
            edge_key(bottom_left, bottom_right),
        ],
    }
}

fn encode(pos: Position) -> u8 {
    (pos.row * BOARD_SIZE + pos.col) as u8
}

fn edge_key(a: Position, b: Position) -> u16 {
    let a_idx = encode(a) as u16;
    let b_idx = encode(b) as u16;
    if a_idx < b_idx {
        (a_idx << 8) | b_idx
    } else {
        (b_idx << 8) | a_idx
    }
}

fn get_adjacent_positions(pos: Position) -> Vec<Position> {
    let mut result = Vec::with_capacity(4);
    for (dr, dc) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
        let next = Position {
            row: pos.row + dr,
            col: pos.col + dc,
        };
        if next.row >= 0 && next.row < BOARD_SIZE && next.col >= 0 && next.col < BOARD_SIZE {
            result.push(next);
        }
    }
    result
}

fn is_edge_blocked(a: Position, b: Position, blocked: &HashSet<u16>) -> bool {
    blocked.contains(&edge_key(a, b))
}

fn get_valid_pawn_moves(
    current: Position,
    opponent: Position,
    blocked: &HashSet<u16>,
) -> Vec<Position> {
    let mut moves = Vec::new();
    for delta in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
        let adjacent = Position {
            row: current.row + delta.0,
            col: current.col + delta.1,
        };
        if adjacent.row < 0
            || adjacent.row >= BOARD_SIZE
            || adjacent.col < 0
            || adjacent.col >= BOARD_SIZE
            || is_edge_blocked(current, adjacent, blocked)
        {
            continue;
        }

        if adjacent.row == opponent.row && adjacent.col == opponent.col {
            let jump = Position {
                row: adjacent.row + delta.0,
                col: adjacent.col + delta.1,
            };
            if jump.row >= 0
                && jump.row < BOARD_SIZE
                && jump.col >= 0
                && jump.col < BOARD_SIZE
                && !is_edge_blocked(adjacent, jump, blocked)
            {
                moves.push(jump);
                continue;
            }

            let perpendiculars = match delta {
                (1, 0) | (-1, 0) => vec![(0, -1), (0, 1)],
                (0, 1) | (0, -1) => vec![(-1, 0), (1, 0)],
                _ => vec![],
            };
            for diag in perpendiculars {
                let diagonal = Position {
                    row: adjacent.row + diag.0,
                    col: adjacent.col + diag.1,
                };
                if diagonal.row >= 0
                    && diagonal.row < BOARD_SIZE
                    && diagonal.col >= 0
                    && diagonal.col < BOARD_SIZE
                    && !is_edge_blocked(adjacent, diagonal, blocked)
                    && !is_edge_blocked(current, adjacent, blocked)
                {
                    moves.push(diagonal);
                }
            }
        } else {
            moves.push(adjacent);
        }
    }

    moves.sort_by_key(|p| (p.row, p.col));
    moves.dedup_by(|a, b| a.row == b.row && a.col == b.col);
    moves
}

fn bfs_has_path(start: Position, goal_row: i32, blocked: &HashSet<u16>) -> bool {
    let mut queue = VecDeque::new();
    let mut visited = HashSet::new();
    queue.push_back(start);
    visited.insert((start.row, start.col));

    while let Some(node) = queue.pop_front() {
        if node.row == goal_row {
            return true;
        }
        for neighbor in get_adjacent_positions(node) {
            if is_edge_blocked(node, neighbor, blocked) {
                continue;
            }
            if visited.insert((neighbor.row, neighbor.col)) {
                queue.push_back(neighbor);
            }
        }
    }

    false
}

fn shortest_path(
    start: Position,
    goal_row: i32,
    blocked: &HashSet<u16>,
    opponent: Option<Position>,
) -> i32 {
    let mut queue = VecDeque::new();
    let mut visited = HashSet::new();
    queue.push_back((start, 0));
    visited.insert((start.row, start.col));

    while let Some((node, dist)) = queue.pop_front() {
        if node.row == goal_row {
            return dist;
        }
        for neighbor in get_valid_pawn_moves(
            node,
            opponent.unwrap_or(Position { row: -1, col: -1 }),
            blocked,
        ) {
            if visited.insert((neighbor.row, neighbor.col)) {
                queue.push_back((neighbor, dist + 1));
            }
        }
    }

    99
}