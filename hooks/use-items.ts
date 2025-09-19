import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, type QueryDocumentSnapshot } from 'firebase/firestore';

import { db } from '@/services/firebase';

export type Item = {
  id: string;
  name: string;
  rarity?: string;
  description?: string;
};

export type UseItemsResult = {
  items: Item[];
  loading: boolean;
  error: string | null;
};

function mapDocument(doc: QueryDocumentSnapshot<Record<string, unknown>>): Item {
  const data = doc.data();
  return {
    id: doc.id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed item',
    rarity: typeof data.rarity === 'string' ? data.rarity : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
  };
}

export function useItems(): UseItemsResult {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const itemsCollection = collection(db, 'items');
    const itemsQuery = query(itemsCollection, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const documents = snapshot.docs as QueryDocumentSnapshot<Record<string, unknown>>[];
        setItems(documents.map(mapDocument));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setItems([]);
        setLoading(false);
        setError(snapshotError.message);
      },
    );

    return unsubscribe;
  }, []);

  return useMemo(
    () => ({
      items,
      loading,
      error,
    }),
    [error, items, loading],
  );
}
