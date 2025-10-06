import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useGameLobby } from '@/context/GameLobbyContext';

export default function CreateGameScreen() {
  const [gameName, setGameName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { createGame } = useGameLobby();
  const accentColor = Colors.accent;
  const textColor = Colors.text;
  const buttonTextColor = Colors.buttonText;
  const placeholderColor = 'rgba(45, 27, 16, 0.45)';

  const isDisabled = gameName.trim().length === 0;

  const handleCreate = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const newGame = await createGame(gameName, gameCode);
      setGameName('');
      router.replace({ pathname: '/online/game/[id]', params: { id: newGame.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please enter a valid name.';
      Alert.alert('Cannot create game', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/onlineScreen.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ThemedView style={[styles.flex, styles.overlay]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.container}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create a game
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Choose a name so other players can recognize your room in the lobby.
            </ThemedText>
          </View>
          <View style={styles.form}>
          <ThemedText type="defaultSemiBold" style={styles.inputHeader}>Game name</ThemedText>
          <TextInput
            value={gameName}
            onChangeText={setGameName}
            placeholder="e.g. Saturday Showdown"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <ThemedText type="defaultSemiBold" style={styles.inputHeader}>Private code (optional)</ThemedText>
          <TextInput
            value={gameCode}
            onChangeText={setGameCode}
            placeholder="Leave empty for public game"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            keyboardType="numeric"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable
            onPress={handleCreate}
            disabled={isDisabled || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: accentColor,
                opacity: isDisabled ? 0.7 : pressed || submitting ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: buttonTextColor }]}>
              {submitting ? 'Creating…' : 'Create game'}
            </ThemedText>
          </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      </ThemedView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    backgroundColor: Colors.overlay,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-around',
  },
  panel: {
    gap: 24,
    borderRadius: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  header: {
    gap: 12,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    color: Colors.heading,
  },
  subtitle: {
    textAlign: 'center',
    color: Colors.textMuted,
  },
  form: {
    gap: 10,
  },
  inputHeader: {
    fontSize: 16,
    color: Colors.heading,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    backgroundColor: Colors.backgroundStrong,
    borderWidth: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  submitButtonText: {
    textAlign: 'center',
  },
});
