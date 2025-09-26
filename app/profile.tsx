import { useState, useEffect } from 'react';
import { ScrollView, Pressable, StyleSheet, View, TextInput, Alert, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/firebase';
import { useUserStats } from '@/hooks/use-user-stats';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { stats } = useUserStats();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleUpdateProfile = async () => {
    if (!user || !displayName.trim()) return;
    
    setUpdating(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() });
      Alert.alert('Success', 'Display name updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update display name');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Please fill in both current and new password');
      return;
    }
    
    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Success', 'Password updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update password. Check your current password.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/');
  };

  if (!user) {
    return null;
  }

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/onlineScreen.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.card}>
        <ThemedText type="title" style={styles.title}>Profile</ThemedText>
        
        <View style={styles.section}>
          <ThemedText style={styles.label}>Display Name</ThemedText>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter display name"
          />
          <Pressable style={styles.button} onPress={handleUpdateProfile} disabled={updating}>
            <ThemedText style={styles.buttonText}>Update Name</ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{user.email}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Change Password</ThemedText>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showOldPassword}
            />
            <Pressable style={styles.showButton} onPress={() => setShowOldPassword(!showOldPassword)}>
              <ThemedText style={styles.showButtonText}>{showOldPassword ? 'Hide' : 'Show'}</ThemedText>
            </Pressable>
          </View>
          <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showCurrentPassword}
          />
          <Pressable style={styles.showButton} onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
            <ThemedText style={styles.showButtonText}>{showCurrentPassword ? 'Hide' : 'Show'}</ThemedText>
          </Pressable>
          </View>
          <Pressable style={styles.button} onPress={handleChangePassword} disabled={updating}>
            <ThemedText style={styles.buttonText}>Update Password</ThemedText>
          </Pressable>
        </View>

        {stats && (
          <View style={styles.section}>
            <ThemedText style={styles.label}>Stats</ThemedText>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{stats.level}</ThemedText>
                <ThemedText style={styles.statLabel}>Level</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{stats.points}</ThemedText>
                <ThemedText style={styles.statLabel}>Points</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{stats.gamesPlayed}</ThemedText>
                <ThemedText style={styles.statLabel}>Games</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{stats.wins}</ThemedText>
                <ThemedText style={styles.statLabel}>Wins</ThemedText>
              </View>
            </View>
          </View>
        )}

        <Pressable style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
          <ThemedText style={styles.buttonText}>Sign Out</ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingTop: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  title: {
    textAlign: 'center',
    color: Colors.heading,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heading,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
    padding: 12,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 8,
  },
  input: {
    fontSize: 16,
    padding: 12,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.buttonText,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: Colors.danger,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: 8,
  },
  passwordInput: {
    flex: 1,
  },
  showButton: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
    justifyContent: 'center',
  },
  showButtonText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});