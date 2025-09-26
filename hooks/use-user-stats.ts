import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/context/AuthContext';

export type UserStats = {
  points: number;
  level: number;
  gamesPlayed: number;
  wins: number;
};

export function useUserStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setStats(userData.stats || { points: 0, level: 1, gamesPlayed: 0, wins: 0 });
        } else {
          setStats({ points: 0, level: 1, gamesPlayed: 0, wins: 0 });
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
        setStats({ points: 0, level: 1, gamesPlayed: 0, wins: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  return { stats, loading };
}