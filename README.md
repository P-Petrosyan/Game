# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Build the Rust WASM module

The Hard difficulty AI runs in Rust and needs to be compiled to WebAssembly before bundling the app. Install [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) and build the module into the expected output directory:

```bash
cd ai-rust
wasm-pack build --target bundler --out-dir ./wasm-ai
```

The build command regenerates the JavaScript glue code (`ai_rust_bg.js`) and the binary payload (`ai_rust_bg.wasm`) that the React Native app loads at runtime.

### Connect Firebase services

This project uses [Firebase Authentication](https://firebase.google.com/docs/auth) and [Cloud Firestore](https://firebase.google.com/docs/firestore) for multiplayer features. Create a Firebase project and add a web app, then provide the configuration values via environment variables (Expo automatically exposes variables prefixed with `EXPO_PUBLIC_`).

Create a `.env` file in the project root that includes:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=app-id
```

Enable Email/Password authentication in the Firebase console and create the following Firestore collections:

- `users` – profile documents created automatically when players register or sign in.
- `games` – lobby/game session metadata. Documents are created when a host sets up a room.
- `items` – optional collection used for the featured item list on the home screen.

Firestore documents are updated through the app, so no additional security rules are required for basic local development. Remember to tighten the rules before deploying to production.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
