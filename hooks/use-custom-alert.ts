import { useState } from 'react';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = {
  title: string;
  message: string;
  buttons: AlertButton[];
};

export function useCustomAlert() {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions | null;
  }>({
    visible: false,
    options: null,
  });

  const showAlert = (options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  };

  const hideAlert = () => {
    setAlertState({
      visible: false,
      options: null,
    });
  };

  return {
    alertState,
    showAlert,
    hideAlert,
  };
}