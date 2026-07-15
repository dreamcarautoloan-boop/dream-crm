import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { LanguageToggle } from "@/components/language-toggle";

export default function ProfileScreen() {
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const { user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = trpc.users.changeOwnPassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = () => {
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError(t.profileScreen.mismatch);
      return;
    }
    setError(null);
    changePassword.mutate({ currentPassword, newPassword });
  };

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm(t.profileScreen.logoutConfirm)) logout();
      return;
    }
    Alert.alert(t.profileScreen.logout, t.profileScreen.logoutConfirm, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.profileScreen.logout, style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">{t.profileScreen.title}</Text>
        <LanguageToggle />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 20, paddingVertical: 12 }}>
        <View className="bg-surface rounded-2xl p-4 border border-border gap-1">
          <Text className="text-base font-semibold text-foreground">{user?.name}</Text>
          <Text className="text-sm text-muted">{user?.role ? t.role[user.role] : ""}</Text>
          <Text className="text-sm text-muted">{user?.email}</Text>
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-foreground">{t.profileScreen.changePassword}</Text>

          <Field
            label={t.profileScreen.currentPassword}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            isRTL={isRTL}
            secure
          />
          <Field
            label={t.profileScreen.newPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            isRTL={isRTL}
            secure
          />
          <Field
            label={t.profileScreen.confirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isRTL={isRTL}
            secure
          />

          {error ? <Text className="text-sm text-error">{error}</Text> : null}
          {success ? <Text className="text-sm text-success">{t.profileScreen.success}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
            className="rounded-xl py-3 items-center bg-primary"
            style={{
              opacity: !currentPassword || !newPassword || !confirmPassword || changePassword.isPending ? 0.5 : 1,
            }}
          >
            {changePassword.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-sm font-semibold text-white">{t.profileScreen.save}</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={handleLogout}
          className="rounded-xl py-3 items-center bg-error/10 flex-row justify-center gap-2"
        >
          <IconSymbol name="arrow.uturn.left" size={16} color={colors.error} />
          <Text className="text-sm font-semibold text-error">{t.profileScreen.logout}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChangeText,
  isRTL,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isRTL: boolean;
  secure?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize="none"
        className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-background"
        style={{ textAlign: isRTL ? "right" : "left" }}
      />
    </View>
  );
}
