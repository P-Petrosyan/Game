const { withInfoPlist, withAndroidManifest } = require("@expo/config-plugins");

module.exports = (config, props = {}) => {
    const { iosAppId, androidAppId } = props;

    //
    // ✅ Inject GADApplicationIdentifier into Info.plist (iOS)
    //
    config = withInfoPlist(config, (config) => {
        if (iosAppId) {
            config.modResults.GADApplicationIdentifier = iosAppId;
        }
        return config;
    });

    //
    // ✅ Inject com.google.android.gms.ads.APPLICATION_ID into AndroidManifest.xml
    //
    config = withAndroidManifest(config, (config) => {
        const app = config.modResults.manifest.application?.[0];
        if (app && androidAppId) {
            // Remove duplicates if exist
            app["meta-data"] =
                app["meta-data"]?.filter(
                    (item) =>
                        item.$["android:name"] !==
                        "com.google.android.gms.ads.APPLICATION_ID"
                ) || [];

            // Push our AdMob entry
            app["meta-data"].push({
                $: {
                    "android:name": "com.google.android.gms.ads.APPLICATION_ID",
                    "android:value": androidAppId,
                    "tools:replace": "android:value",
                },
            });

            // Ensure xmlns:tools is declared in the manifest root
            const manifestAttrs = config.modResults.manifest.$;
            if (!manifestAttrs["xmlns:tools"]) {
                manifestAttrs["xmlns:tools"] = "http://schemas.android.com/tools";
            }
        }
        return config;
    });

    return config;
};
