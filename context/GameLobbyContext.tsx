import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addDoc,
  collection,
  type CollectionReference,
  deleteField,
  doc,
  onSnapshot,
  where,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/firebase';

export type LobbyGame = {
  id: string;
  name: string;
  code: string;
  players: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'completed';
  hostId?: string;
  hostName?: string | null;
  isPrivate?: boolean;
};

type FirestoreLobbyGame = {
  name: string;
  code: string;
  maxPlayers: number;
  playerCount?: number;
  playerIds?: string[];
  status?: 'waiting' | 'playing' | 'completed';
  hostId?: string;
  hostName?: string | null;
  isPrivate?: boolean;
  players?: Record<
    string,
    {
      displayName?: string | null;
      joinedAt?: Timestamp | null;
      leftAt?: Timestamp | null;
    }
  >;
  state?: {
    currentPlayer?: string;
    lastUpdatedAt?: Timestamp | null;
  };
};

type GameLobbyContextValue = {
  games: LobbyGame[];
  loading: boolean;
  createGame: (name: string, code: string, options?: { maxPlayers?: number }) => Promise<LobbyGame>;
  joinGame: (gameId: string, code?: string) => Promise<void>;
  leaveGame: (gameId: string) => Promise<void>;
};

const GameLobbyContext = createContext<GameLobbyContextValue | undefined>(undefined);

function mapSnapshotToLobbyGame(snapshot: QueryDocumentSnapshot<FirestoreLobbyGame>): LobbyGame {
  const data = snapshot.data();
  const players = Array.isArray(data.playerIds) ? data.playerIds.length : data.playerCount ?? 0;

  return {
    id: snapshot.id,
    name: data.name,
    code: data.code,
    maxPlayers: data.maxPlayers,
    players,
    status: data.status ?? 'waiting',
    hostId: data.hostId,
    hostName: data.hostName,
    isPrivate: data.isPrivate ?? false,
  };
}

export function GameLobbyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gamesCollection = collection(db, 'games') as CollectionReference<FirestoreLobbyGame>;
    const gamesQuery = query(gamesCollection, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const nextGames = snapshot.docs.map(mapSnapshotToLobbyGame);
        setGames(nextGames);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to games:', error);
        setGames([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const createGame = useCallback(
    async (name: string, code: string, options?: { maxPlayers?: number }) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Game name is required');
      }

      if (!user) {
        throw new Error('You must be signed in to create a game.');
      }

      const maxPlayers = options?.maxPlayers ?? 2;
      const displayName = user.displayName ?? user.email ?? 'Host';

      const isPrivate = code.trim().length > 0;
      const newGame = {
        name: trimmedName,
        code: code,
        maxPlayers,
        playerIds: [user.uid],
        playerCount: 1,
        status: 'waiting' as const,
        hostId: user.uid,
        hostName: displayName,
        isPrivate,
        players: {
          [user.uid]: {
            displayName,
            joinedAt: serverTimestamp(),
          },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        state: {
          currentPlayer: 'north',
          positions: {
            north: { row: 0, col: 4 },
            south: { row: 8, col: 4 },
          },
          walls: [],
          wallsRemaining: {
            north: 10,
            south: 10,
          },
          winner: null,
          lastUpdatedAt: serverTimestamp(),
        },
      };

      const docRef = await addDoc(collection(db, 'games'), newGame);

      return {
        id: docRef.id,
        name: trimmedName,
        code: code,
        maxPlayers,
        players: 1,
        status: 'waiting',
        hostId: user.uid,
        hostName: displayName,
        isPrivate,
      } satisfies LobbyGame;
    },
    [user],
  );

  const joinGame = useCallback(
    async (gameId: string, code?: string) => {
      if (!user) {
        throw new Error('You must be signed in to join a game.');
      }

      const gameRef = doc(db, 'games', gameId);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(gameRef);

        if (!snapshot.exists()) {
          throw new Error('The selected game no longer exists.');
        }

        const data = snapshot.data() as FirestoreLobbyGame;
        const playerIds = data.playerIds ?? [];
        const currentCount = data.playerCount ?? playerIds.length;

        if (playerIds.includes(user.uid)) {
          return;
        }

        if (data.isPrivate && data.code !== code) {
          throw new Error('Invalid game code.');
        }

        if (currentCount >= data.maxPlayers) {
          throw new Error('This game is already full.');
        }

        const nextCount = currentCount + 1;
        const nextStatus = nextCount >= 2 ? 'active' : data.status ?? 'waiting';

        transaction.update(gameRef, {
          playerIds: [...playerIds, user.uid],
          playerCount: nextCount,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          [`players.${user.uid}`]: {
            displayName: user.displayName ?? user.email ?? 'Player',
            joinedAt: serverTimestamp(),
          },
        });
      });
    },
    [user],
  );

  const leaveGame = useCallback(
    async (gameId: string) => {
      if (!user) {
        throw new Error('You must be signed in to leave a game.');
      }

      const gameRef = doc(db, 'games', gameId);

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(gameRef);

        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data() as FirestoreLobbyGame;
        const playerIds = data.playerIds ?? [];

        if (!playerIds.includes(user.uid)) {
          return;
        }

        const nextIds = playerIds.filter((id) => id !== user.uid);
        const nextCount = Math.max(0, nextIds.length);

        // Delete game if no players left
        if (nextCount === 0) {
          transaction.delete(gameRef);
          return;
        }

        // If game is in progress and player leaves, opponent wins
        if (data.status === 'playing' && nextCount === 1) {
          const remainingPlayerId = nextIds[0];
          const leavingPlayerIndex = playerIds.indexOf(user.uid);
          const remainingPlayerIndex = playerIds.indexOf(remainingPlayerId);
          const remainingPlayerSide = remainingPlayerIndex === 0 ? 'north' : 'south';

          transaction.update(gameRef, {
            playerIds: nextIds,
            playerCount: nextCount,
            status: 'completed',
            'state.winner': remainingPlayerSide,
            'state.gameEndReason': 'opponent_left',
            updatedAt: serverTimestamp(),
            [`players.${user.uid}`]: deleteField(),
          });
          return;
        }

        const nextStatus = nextCount <= 1 ? 'waiting' : data.status ?? 'active';

        transaction.update(gameRef, {
          playerIds: nextIds,
          playerCount: nextCount,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          [`players.${user.uid}`]: deleteField(),
        });
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({
      games,
      loading,
      createGame,
      joinGame,
      leaveGame,
    }),
    [createGame, games, joinGame, leaveGame, loading],
  );

  return <GameLobbyContext.Provider value={value}>{children}</GameLobbyContext.Provider>;
}

export function useGameLobby() {
  const context = useContext(GameLobbyContext);

  if (!context) {
    throw new Error('useGameLobby must be used within a GameLobbyProvider');
  }

  return context;
}
