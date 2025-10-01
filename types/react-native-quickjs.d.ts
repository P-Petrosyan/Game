declare module 'react-native-quickjs' {
  export function multiply(a: number, b: number): Promise<number>;
  export function getQuickJS(): Promise<unknown>;
}
