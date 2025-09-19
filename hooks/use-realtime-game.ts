import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, type DocumentData, type DocumentReference } from 'firebase/firestore';

import { db } from '@/services/firebase';

export type GamePlayer = {
  displayName?: string | null;
  joinedAt?: Date | null;
};

export type GameState = {
  id: string;
  name: string;
  hostId?: string;
  hostName?: string | null;
  status?: string;
  maxPlayers?: number;
  playerIds?: string[];
  players?: Record<string, GamePlayer>;
  state?: Record<string, unknown>;
};

export type UseRealtimeGameResult = {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
};

function convertTimestamps(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if ('toDate' in value && typeof value.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  if (Array.isArray(value)) {
    return value.map(convertTimestamps);
  }

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, convertTimestamps(nested)]));
}

function mapSnapshot(snapshot: DocumentData | undefined, id: string): GameState | null {
  if (!snapshot) {
    return null;
  }

  const data = convertTimestamps(snapshot) as Record<string, unknown>;

  return {
    id,
    ...(data as Record<string, unknown>),
  } as GameState;
}

export function useRealtimeGame(gameId: string | null | undefined): UseRealtimeGameResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(gameId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      setGameState(null);
      setLoading(false);
      return;
    }

    let reference: DocumentReference<DocumentData>;

    try {
      reference = doc(db, 'games', gameId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create document reference');
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      reference,
      (snapshot) => {
        setGameState(mapSnapshot(snapshot.data(), snapshot.id));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setGameState(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [gameId]);

  return useMemo(
    () => ({
      gameState,
      loading,
      error,
    }),
    [error, gameState, loading],
  );
}
