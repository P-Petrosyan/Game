import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  aiMatch?: {
    enabled: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    aiPlayerId: string;
    aiName: string;
  };
};

type GameLobbyContextValue = {
  games: LobbyGame[];
  loading: boolean;
  createGame: (name: string, code: string, options?: { maxPlayers?: number }) => Promise<LobbyGame>;
  joinGame: (gameId: string, code?: string) => Promise<void>;
  leaveGame: (gameId: string) => Promise<void>;
  ensureAIGameAvailability: () => Promise<void>;
};

const GameLobbyContext = createContext<GameLobbyContextValue | undefined>(undefined);

export const AI_PLAYER_ID = '__quori_ai_hard__';
export const AI_DISPLAY_NAME = 'Lio';
const AI_GAME_BASE_NAME = 'Quick Match';
const MAX_OPEN_AI_GAMES = 2;
const MAX_JOINABLE_GAMES = 2;
const AI_SEED_LOCK_DURATION_MS = 15_000;

type AiSeedState = {
  lockedUntil?: number;
  lockToken?: string | null;
};

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
  const aiCreationInProgressRef = useRef(false);

  const acquireAiSeedLock = useCallback(async (): Promise<string | null> => {
    const sentinelRef = doc(db, 'metadata', 'aiLobbySeed');
    const now = Date.now();
    const lockToken = `${now}-${Math.random().toString(36).slice(2)}`;

    try {
      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(sentinelRef);
        const data = snapshot.exists() ? (snapshot.data() as AiSeedState) : {};

        if (data.lockedUntil && data.lockedUntil > now && data.lockToken) {
          return null;
        }

        transaction.set(
          sentinelRef,
          {
            lockedUntil: now + AI_SEED_LOCK_DURATION_MS,
            lockToken,
          },
          { merge: true },
        );

        return lockToken;
      });

      return result ?? null;
    } catch (error) {
      console.error('Failed to acquire AI lobby seed lock:', error);
      return null;
    }
  }, []);

  const releaseAiSeedLock = useCallback(async (token: string | null) => {
    if (!token) {
      return;
    }

    const sentinelRef = doc(db, 'metadata', 'aiLobbySeed');

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(sentinelRef);

        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data() as AiSeedState;

        if (data.lockToken !== token) {
          return;
        }

        transaction.set(
          sentinelRef,
          {
            lockedUntil: Date.now(),
            lockToken: null,
          },
          { merge: true },
        );
      });
    } catch (error) {
      console.error('Failed to release AI lobby seed lock:', error);
    }
  }, []);

  const createAIGame = useCallback(async () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const name = `${AI_GAME_BASE_NAME} ${randomSuffix}`;

    const aiGame: FirestoreLobbyGame = {
      name,
      code: '',
      maxPlayers: 2,
      playerIds: [AI_PLAYER_ID],
      playerCount: 1,
      status: 'waiting',
      hostId: AI_PLAYER_ID,
      hostName: AI_DISPLAY_NAME,
      isPrivate: false,
      players: {
        [AI_PLAYER_ID]: {
          displayName: AI_DISPLAY_NAME,
          joinedAt: serverTimestamp(),
          ready: false,
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
      aiMatch: {
        enabled: true,
        difficulty: 'hard',
        aiPlayerId: AI_PLAYER_ID,
        aiName: AI_DISPLAY_NAME,
      },
    };

    await addDoc(collection(db, 'games'), aiGame);
  }, []);

  const ensureAIGameAvailability = useCallback(async (overrideGames?: LobbyGame[]) => {
    const sourceGames = overrideGames ?? games;
    const joinableGames = sourceGames.filter(
      (game) =>
        !game.isPrivate &&
        game.status === 'waiting' &&
        game.players < game.maxPlayers,
    );

    if (joinableGames.length >= MAX_JOINABLE_GAMES) {
      return;
    }

    const humanJoinable = joinableGames.filter((game) => game.hostId && game.hostId !== AI_PLAYER_ID);
    if (humanJoinable.length > 0) {
      return;
    }

    const aiJoinable = joinableGames.filter((game) => game.hostId === AI_PLAYER_ID);

    // Only seed a fresh batch once all existing AI-hosted games are unavailable.
    if (aiJoinable.length > 0 || aiCreationInProgressRef.current) {
      return;
    }

    const lockToken = await acquireAiSeedLock();

    if (!lockToken) {
      return;
    }

    aiCreationInProgressRef.current = true;

    try {
      const latestSource = overrideGames ?? games;
      const latestJoinable = latestSource.filter(
        (game) =>
          !game.isPrivate &&
          game.status === 'waiting' &&
          game.players < game.maxPlayers,
      );
      const latestHumanJoinable = latestJoinable.filter(
        (game) => game.hostId && game.hostId !== AI_PLAYER_ID,
      );

      if (latestHumanJoinable.length > 0) {
        return;
      }

      const latestAiJoinable = latestJoinable.filter((game) => game.hostId === AI_PLAYER_ID);

      if (latestAiJoinable.length > 0) {
        return;
      }

      for (let index = 0; index < MAX_OPEN_AI_GAMES; index += 1) {
        await createAIGame();
      }
    } catch (error) {
      console.error('Failed to seed AI lobby game:', error);
    } finally {
      aiCreationInProgressRef.current = false;
      await releaseAiSeedLock(lockToken);
    }
  }, [acquireAiSeedLock, createAIGame, games, releaseAiSeedLock]);

  useEffect(() => {
    const gamesCollection = collection(db, 'games') as CollectionReference<FirestoreLobbyGame>;
    const gamesQuery = query(gamesCollection, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const nextGames = snapshot.docs.map(mapSnapshotToLobbyGame);
        setGames(nextGames);
        setLoading(false);
        void ensureAIGameAvailability(nextGames);
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

        const isAIMatch = Boolean(data.aiMatch?.enabled && data.aiMatch?.aiPlayerId);
        const aiPlayerId = isAIMatch ? data.aiMatch?.aiPlayerId : undefined;

        const nextCount = currentCount + 1;
        const nextStatus = nextCount >= 2 ? 'active' : data.status ?? 'waiting';
        const nextPlayerIds = isAIMatch && aiPlayerId
          ? [user.uid, aiPlayerId]
          : [...playerIds, user.uid];

        const updates: Record<string, unknown> = {
          playerIds: nextPlayerIds,
          playerCount: nextCount,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          [`players.${user.uid}`]: {
            displayName: user.displayName ?? user.email ?? 'Player',
            joinedAt: serverTimestamp(),
          },
        };

        if (isAIMatch && aiPlayerId) {
          updates[`players.${aiPlayerId}.ready`] = true;
        }

        transaction.update(gameRef, updates);
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
        const aiPlayerId = data.aiMatch?.aiPlayerId;
        const remainingHumanIds = nextIds.filter((id) => id !== aiPlayerId);
        const nextCount = Math.max(0, nextIds.length);

        // Delete game if there are no human players remaining
        if (remainingHumanIds.length === 0) {
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

        const updates: Record<string, unknown> = {
          playerIds: nextIds,
          playerCount: nextCount,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          [`players.${user.uid}`]: deleteField(),
        };

        if (data.aiMatch?.enabled && data.aiMatch.aiPlayerId) {
          updates[`players.${data.aiMatch.aiPlayerId}.ready`] = false;
          updates.playAgainVotes = deleteField();
        }

        transaction.update(gameRef, updates);
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
      ensureAIGameAvailability,
    }),
    [createGame, ensureAIGameAvailability, games, joinGame, leaveGame, loading],
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
