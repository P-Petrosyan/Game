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
import { NaturePalette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { register } = useAuth();
  const palette = NaturePalette;
  const placeholderColor = palette.placeholder;

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
    <ThemedView style={styles.screen} lightColor={palette.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.container}>
        <View
          style={[
            styles.panel,
            {
              borderColor: palette.border,
              backgroundColor: palette.surfaceGlass,
              shadowColor: palette.focus,
            },
          ]}>
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
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surfaceGlassAlt,
              },
            ]}
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
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surfaceGlassAlt,
              },
            ]}
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
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surfaceGlassAlt,
              },
            ]}
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
                backgroundColor: palette.buttonColor,
                borderColor: palette.buttonColor,
                opacity: isDisabled ? 0.6 : pressed || submitting ? 0.92 : 1,
                shadowColor: palette.focus,
              },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: palette.buttonText }]}>
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
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  panel: {
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
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
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
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
