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
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const accentColor = Colors[colorScheme].tint;
  const textColor = Colors[colorScheme].text;
  const buttonTextColor = colorScheme === 'dark' ? Colors.dark.background : '#fff';
  const placeholderColor = colorScheme === 'dark' ? '#9BA1A6' : '#6B7280';

  const isDisabled = email.trim().length === 0 || password.trim().length === 0;

  const handleLogin = async () => {
    if (submitting || isDisabled) {
      return;
    }

    setSubmitting(true);

    try {
      await login({ email: email.trim(), password });
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
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Welcome back
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to access online lobbies, cloud saves, and synced matches.
          </ThemedText>
        </View>
        <View style={styles.form}>
          <ThemedText type="defaultSemiBold">Email address</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="next"
            textContentType="emailAddress"
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
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: textColor }]} />
            <ThemedText style={styles.dividerText}>or</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: textColor }]} />
          </View>
          <Pressable
            onPress={async () => {
              try {
                await loginWithGoogle();
                router.replace('/');
              } catch (error) {
                Alert.alert('Google Sign-in failed', 'Please try again.');
              }
            }}
            style={({ pressed }) => [
              styles.googleButton,
              { borderColor: accentColor, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.googleButtonText, { color: textColor }]}>
              Continue with Google
            </ThemedText>
          </Pressable>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dividerText: {
    opacity: 0.6,
  },
  googleButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  googleButtonText: {
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
  },
});
