import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CreateGameScreen() {
  const [gameName, setGameName] = useState('');
  const router = useRouter();
  const { createGame } = useGameLobby();
  const colorScheme = useColorScheme() ?? 'light';
  const accentColor = Colors[colorScheme].tint;
  const textColor = Colors[colorScheme].text;
  const buttonTextColor = colorScheme === 'dark' ? Colors.dark.background : '#fff';
  const placeholderColor = colorScheme === 'dark' ? '#9BA1A6' : '#6B7280';

  const isDisabled = gameName.trim().length === 0;

  const handleCreate = () => {
    try {
      const newGame = createGame(gameName);
      setGameName('');
      Alert.alert('Game created', `"${newGame.name}" is now visible in the online lobby.`, [
        {
          text: 'View games',
          onPress: () => router.replace('/online'),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please enter a valid name.';
      Alert.alert('Cannot create game', message);
    }
  };

  return (
    <ThemedView style={styles.flex}>
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
          <ThemedText type="defaultSemiBold">Game name</ThemedText>
          <TextInput
            value={gameName}
            onChangeText={setGameName}
            placeholder="e.g. Saturday Showdown"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable
            onPress={handleCreate}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: accentColor,
                opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: buttonTextColor }]}>
              Create game
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  header: {
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    textAlign: 'center',
  },
});
