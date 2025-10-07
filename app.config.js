import withAdmobID from "./plugins/with-admob-id";

export default {
    expo: {
        name: "Path Blocker Online",
        slug: "path-blocker",
        version: "1.0.0", // App Store / Play Store visible version
        orientation: "portrait",
        icon: "./assets/images/icon1.png",
        scheme: "pathblocker",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,

        extra: {
            eas: {
                projectId: "8cc79ff7-348b-4fd6-a054-a627a95f87a3",
            },
            admob: {
                androidAppId: "ca-app-pub-4468002211413891~1278388928",
                iosAppId: "ca-app-pub-4468002211413891~5060585795",
            },
        },

        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.anonymous.pathblocker",
            deploymentTarget: "18.0",
            buildNumber: "1.0.0",
            googleServicesFile: "./GoogleService-Info.plist",
            infoPlist: {
                NSUserTrackingUsageDescription:
                    "This identifier will be used to deliver personalized ads to you.",
            },
        },

        android: {
            package: "com.anonymous.pathblocker",
            versionCode: 1,
            adaptiveIcon: {
                foregroundImage: "./assets/images/icon1.png",
                backgroundColor: "#E6F4FE",
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
        },

        plugins: [
            "expo-router",
            [
                "react-native-google-mobile-ads",
                {
                    android_app_id: "ca-app-pub-4468002211413891~1278388928",
                    ios_app_id: "ca-app-pub-4468002211413891~5060585795",
                },
            ],
            [
                withAdmobID,
                {
                    androidAppId: "ca-app-pub-4468002211413891~1278388928",
                    iosAppId: "ca-app-pub-4468002211413891~5060585795",
                },
            ],
        ],

        experiments: {
            typedRoutes: true,
            reactCompiler: true,
        },
    },
};
