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
import { NaturePalette } from '@/constants/theme';
import { useGameLobby } from '@/context/GameLobbyContext';

export default function CreateGameScreen() {
  const [gameName, setGameName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { createGame } = useGameLobby();
  const palette = NaturePalette;
  const placeholderColor = palette.placeholder;

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
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
      <ThemedView
        style={[
          styles.flex,
          styles.card,
          {
            borderColor: palette.border,
            backgroundColor: palette.surfaceGlass,
            shadowColor: palette.focus,
          },
        ]}
        lightColor={palette.surfaceGlass}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.container}>
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
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surfaceGlassAlt,
              },
            ]}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <ThemedText type="defaultSemiBold" style={styles.inputHeader}>Private code (optional)</ThemedText>
          <TextInput
            value={gameCode}
            onChangeText={setGameCode}
            placeholder="Leave empty for public game"
            placeholderTextColor={placeholderColor}
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surfaceGlassAlt,
              },
            ]}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable
            onPress={handleCreate}
            disabled={isDisabled || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: palette.buttonColor,
                borderColor: palette.buttonColor,
                opacity: isDisabled ? 0.6 : pressed || submitting ? 0.92 : 1,
                shadowColor: palette.focus,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: palette.buttonText }]}>
              {submitting ? 'Creating…' : 'Create game'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </ThemedView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    justifyContent: 'space-between',
    gap: 24,
  },
  header: {
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: NaturePalette.mutedText,
  },
  form: {
    gap: 16,
  },
  inputHeader: {
    fontSize: 16,
    color: NaturePalette.heading,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  submitButtonText: {
    textAlign: 'center',
  },
});
