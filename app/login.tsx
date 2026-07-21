import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/i18n/language-context";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { refresh } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError(t.auth.missingFields);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await Api.login(username.trim(), password);

      if (!result.sessionToken) {
        setError(t.auth.genericError);
        return;
      }

      // Native: cookie isn't available, so persist the token/user manually.
      // Web: the server already set an httpOnly cookie; this is just a local cache.
      await Auth.setSessionToken(result.sessionToken);
      if (result.user) {
        await Auth.setUserInfo({
          id: result.user.id,
          openId: result.user.openId,
          name: result.user.name,
          email: result.user.email,
          loginMethod: result.user.loginMethod ?? "password",
          role: result.user.role,
          teamId: result.user.teamId ?? null,
          lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
        });
      }

      await refresh();
      router.replace("/(tabs)");
    } catch (err) {
      console.error("[Login] failed:", err);
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("invalid")) {
        setError(t.auth.invalidCredentials);
      } else if (message.toLowerCase().includes("deactivated")) {
        setError(t.auth.accountDeactivated);
      } else {
        setError(t.auth.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
      <View
        className="absolute top-4 z-10"
        style={isRTL ? { right: 16 } : { left: 16 }}
      >
        <LanguageToggle />
      </View>

      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-foreground">{t.common.appName}</Text>
          <Text className="text-base text-muted text-center">{t.auth.signInSubtitle}</Text>
        </View>

        <View className="w-full max-w-sm gap-4 bg-surface rounded-2xl p-6 border border-border">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">{t.auth.username}</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              placeholder={t.auth.username}
              className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-background"
              style={{ textAlign: isRTL ? "right" : "left" }}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">{t.auth.password}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              placeholder="••••••••"
              onSubmitEditing={handleSubmit}
              className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-background"
              style={{ textAlign: isRTL ? "right" : "left" }}
            />
          </View>

          {error ? (
            <Text className="text-sm text-error text-center">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="rounded-xl py-3 items-center bg-primary"
            style={{ opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">{t.auth.signIn}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}
