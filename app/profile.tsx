import React, { useState, useEffect } from 'react';
import { ScrollView, Pressable, StyleSheet, View, TextInput, Alert, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile, deleteUser } from 'firebase/auth';
import { doc, updateDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/firebase';
import { useUserStats } from '@/hooks/use-user-stats';
import { useCustomAlert } from '@/hooks/use-custom-alert';
import {CustomAlert} from "@/components/ui/CustomAlert";

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { stats } = useUserStats();
  const [username, setUsername] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [user, router]);



  const handleUpdateUsername = async () => {
    if (!user || !username.trim() || username.trim() === user.displayName) return;
    
    setUpdating(true);
    try {
      const usernameQuery = query(collection(db, 'users'), where('username', '==', username.trim()));
      const usernameSnapshot = await getDocs(usernameQuery);
      
      if (!usernameSnapshot.empty) {
        showAlert({
          title: 'Error',
          message: 'Username already exists',
          buttons: [{ text: 'OK', onPress: hideAlert }],
        });
        return;
      }

      await updateProfile(user, { displayName: username.trim() });
      await updateDoc(doc(db, 'users', user.uid), { 
        displayName: username.trim(),
        username: username.trim()
      });
      showAlert({
        title: 'Success',
        message: 'Username updated',
        buttons: [{ text: 'OK', onPress: hideAlert }],
      });
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to update username',
        buttons: [{ text: 'OK', onPress: hideAlert }],
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword.trim() || !newPassword.trim()) {
      showAlert({
        title: 'Error',
        message: 'Please fill in both current and new password',
        buttons: [{ text: 'OK', onPress: hideAlert }],
      });
      return;
    }
    
    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showAlert({
        title: 'Success',
        message: 'Password updated',
        buttons: [{ text: 'OK', onPress: hideAlert }],
      });
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to update password. Check your current password.',
        buttons: [{ text: 'OK', onPress: hideAlert }],
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    showAlert({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: hideAlert,
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            hideAlert();
            try {
              await logout();
              router.replace('/');
            } catch (error) {
              showAlert({
                title: 'Error',
                message: 'Failed to sign out',
                buttons: [{ text: 'OK', onPress: hideAlert }],
              });
            }
          },
        },
      ],
    });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    showAlert({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: hideAlert,
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hideAlert();
            try {
              await deleteDoc(doc(db, 'users', user.uid));
              await deleteUser(user);
              router.replace('/auth/login');
            } catch (error) {
              showAlert({
                title: 'Error',
                message: 'Failed to delete account',
                buttons: [{ text: 'OK', onPress: hideAlert }],
              });
            }
          },
        },
      ],
    });
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
          <ThemedText style={styles.label}>Username</ThemedText>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
          />
          <Pressable style={styles.button} onPress={handleUpdateUsername} disabled={updating}>
            <ThemedText style={styles.buttonText}>Update Username</ThemedText>
          </Pressable>
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
                <ThemedText style={styles.statValue}>{formatNumber(stats.points)}</ThemedText>
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

        <View style={styles.actionButtons}>
          <Pressable style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
            <ThemedText style={styles.buttonText}>Sign Out</ThemedText>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
            <ThemedText style={styles.deleteButtonText}>Delete Account</ThemedText>
          </Pressable>
        </View>
        <CustomAlert
          visible={alertState.visible}
          title={alertState.options?.title || ''}
          message={alertState.options?.message || ''}
          buttons={alertState.options?.buttons || []}
          onDismiss={hideAlert}
          showInput={alertState.options?.title === 'Private Game'}
          inputPlaceholder="Enter numbers only"
        />
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
    // flex: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
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
  actionButtons: {
    // flexDirection: 'row',
    gap: 10,
    // marginTop: 10,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});