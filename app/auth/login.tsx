import { Link, useRouter } from 'expo-router';
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
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const accentColor = Colors.accent;
  const textColor = Colors.text;
  const buttonTextColor = Colors.buttonText;
  const placeholderColor = 'rgba(45, 27, 16, 0.45)';

  const isDisabled = username.trim().length === 0 || password.trim().length === 0;

  const handleLogin = async () => {
    if (submitting || isDisabled) {
      return;
    }

    setSubmitting(true);

    try {
      await login({ username: username.trim(), password });
      router.replace('/');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Unable to sign in. Double-check your details.';
      Alert.alert('Sign in failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.container}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Welcome back
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Sign in to access online lobbies and multiplayer games.
            </ThemedText>
          </View>
          <View style={styles.form}>
          <ThemedText type="defaultSemiBold">Username</ThemedText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="Enter your username"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="next"
            textContentType="username"
            onSubmitEditing={() => {
              if (password.trim().length === 0) {
                return;
              }
              handleLogin();
            }}
          />
          <ThemedText type="defaultSemiBold">Password</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="done"
            textContentType="password"
            onSubmitEditing={handleLogin}
          />
          <Pressable
            onPress={handleLogin}
            disabled={isDisabled || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: accentColor,
                opacity: isDisabled ? 0.5 : pressed || submitting ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: buttonTextColor }]}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </ThemedText>
          </Pressable>

          </View>
        </View>
        <View style={styles.footer}>
          <ThemedText>Need an account? </ThemedText>
          <Link href="/auth/register" style={styles.link}>
            Create one now
          </Link>
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
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, default: 12 }),
    fontSize: 16,
    backgroundColor: Colors.backgroundStrong,
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
    color: Colors.accent,
  },
});
