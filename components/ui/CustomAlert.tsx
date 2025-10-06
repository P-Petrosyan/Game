import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type AlertButton = {
  text: string;
  onPress?: (inputValue?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type CustomAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  onDismiss: () => void;
  showInput?: boolean;
  inputValue?: string;
  onInputChange?: (text: string) => void;
  inputPlaceholder?: string;
};

export function CustomAlert({ 
  visible, 
  title, 
  message, 
  buttons, 
  onDismiss, 
  showInput, 
  inputValue, 
  onInputChange, 
  inputPlaceholder 
}: CustomAlertProps) {
  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.(inputValue);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.message}>{message}</ThemedText>
          
          {showInput && (
            <TextInput
              style={styles.textInput}
              value={inputValue}
              onChangeText={onInputChange}
              placeholder={inputPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
          )}
          
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.destructiveButton,
                  button.style === 'cancel' && styles.cancelButton,
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <ThemedText
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.destructiveText,
                    button.style === 'cancel' && styles.cancelText,
                  ]}
                >
                  {button.text}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  destructiveButton: {
    backgroundColor: Colors.danger,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.buttonText,
  },
  cancelText: {
    color: Colors.text,
  },
  destructiveText: {
    color: Colors.buttonText,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
});