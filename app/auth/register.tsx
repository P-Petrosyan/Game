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

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { register } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const accentColor = Colors[colorScheme].tint;
  const textColor = Colors[colorScheme].text;
  const buttonTextColor = colorScheme === 'dark' ? Colors.dark.background : '#fff';
  const placeholderColor = colorScheme === 'dark' ? '#9BA1A6' : '#6B7280';

  const isDisabled = email.trim().length === 0 || password.trim().length === 0;

  const handleRegister = async () => {
    if (submitting || isDisabled) {
      return;
    }

    setSubmitting(true);

    try {
      await register({ email: email.trim(), password, displayName: displayName.trim() || undefined });
      router.replace('/');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Unable to create the account right now.';
      Alert.alert('Registration failed', message);
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
            Create an account
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Store your progress online and manage multiplayer games from any device.
          </ThemedText>
        </View>
        <View style={styles.form}>
          <ThemedText type="defaultSemiBold">Display name</ThemedText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Arcade Champion"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="next"
            textContentType="name"
          />
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
          />
          <ThemedText type="defaultSemiBold">Password</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Choose a strong password"
            placeholderTextColor={placeholderColor}
            style={[styles.input, { borderColor: accentColor, color: textColor }]}
            returnKeyType="done"
            textContentType="newPassword"
            onSubmitEditing={handleRegister}
          />
          <Pressable
            onPress={handleRegister}
            disabled={isDisabled || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: accentColor,
                opacity: isDisabled ? 0.5 : pressed || submitting ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: buttonTextColor }]}>
              {submitting ? 'Creating account…' : 'Create account'}
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <ThemedText>Already have an account? </ThemedText>
          <Link href="/auth/login" style={styles.link}>
            Sign in instead
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
