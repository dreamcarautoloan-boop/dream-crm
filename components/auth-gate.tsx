import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter, useSegments } from "expo-router";

import { useAuth } from "@/hooks/use-auth";

/**
 * Wrap the app's screens with this to require a logged-in user everywhere
 * except /login. Renders nothing while the initial auth check is in flight
 * so we don't flash protected content before redirecting.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const onLoginScreen = segments[0] === "login";
  const onOAuthCallback = segments[0] === "oauth";

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated && !onLoginScreen && !onOAuthCallback) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && onLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [loading, isAuthenticated, onLoginScreen, onOAuthCallback, router]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Prevent a flash of protected content while the redirect above kicks in.
  if (!isAuthenticated && !onLoginScreen && !onOAuthCallback) {
    return null;
  }

  return <>{children}</>;
}
