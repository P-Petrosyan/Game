import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type LobbyGame = {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
};

type GameLobbyContextValue = {
  games: LobbyGame[];
  createGame: (name: string) => LobbyGame;
};

const GameLobbyContext = createContext<GameLobbyContextValue | undefined>(undefined);

const initialGames: LobbyGame[] = [
  { id: 'game-1', name: 'Evening Match', players: 1, maxPlayers: 2 },
  { id: 'game-2', name: 'Weekend Tournament', players: 2, maxPlayers: 2 },
  { id: 'game-3', name: 'Strategy Session', players: 1, maxPlayers: 2 },
];

function createGameFromName(name: string): LobbyGame {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    players: 1,
    maxPlayers: 2,
  };
}

export function GameLobbyProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<LobbyGame[]>(initialGames);

  const createGame = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error('Game name is required');
    }

    const newGame = createGameFromName(trimmedName);
    setGames((previous) => [...previous, newGame]);
    return newGame;
  };

  const value = useMemo(() => ({ games, createGame }), [games]);

  return <GameLobbyContext.Provider value={value}>{children}</GameLobbyContext.Provider>;
}

export function useGameLobby() {
  const context = useContext(GameLobbyContext);

  if (!context) {
    throw new Error('useGameLobby must be used within a GameLobbyProvider');
  }

  return context;
}
