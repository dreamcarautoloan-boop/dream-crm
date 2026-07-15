import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Role = "sales_manager" | "team_leader" | "sales" | "moderator";
const ROLES: Role[] = ["sales", "team_leader", "moderator", "sales_manager"];

export default function TeamScreen() {
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [showAddModal, setShowAddModal] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role === "sales_manager";

  const { data: members, isLoading } = trpc.users.list.useQuery(undefined, { enabled: isManager });

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowAddModal(false);
      setUsername("");
      setPassword("");
      setName("");
      setEmail("");
      setPhone("");
      setRole("sales");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const setActive = trpc.users.setActive.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });

  const doResetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      setResetTargetId(null);
      setResetPassword("");
    },
  });

  if (!isManager) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="items-center justify-center px-8">
        <Text className="text-base text-muted text-center">{t.teamScreen.accessDenied}</Text>
      </ScreenContainer>
    );
  }

  const canSubmit = username.trim().length >= 3 && password.trim().length >= 8 && name.trim() && email.trim();

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">{t.teamScreen.title}</Text>
        <Pressable
          onPress={() => setShowAddModal(true)}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (members ?? []).length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-sm text-muted text-center">{t.teamScreen.empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          {(members ?? []).map((member) => (
            <View key={member.id} className="bg-surface rounded-2xl p-4 border border-border gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{member.name}</Text>
                {!member.isActive ? (
                  <View className="px-2.5 py-1 rounded-full bg-error/15">
                    <Text className="text-xs font-medium text-error">{t.teamScreen.inactive}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-sm text-muted">
                @{member.username} · {t.role[member.role]}
              </Text>
              <Text className="text-sm text-muted">{member.email}</Text>

              <View className="flex-row gap-2 pt-1">
                <Pressable
                  onPress={() => {
                    setResetTargetId(member.id);
                    setResetPassword("");
                  }}
                  className="px-3 py-1.5 rounded-full bg-primary/15"
                >
                  <Text className="text-xs font-medium text-primary">{t.teamScreen.resetPassword}</Text>
                </Pressable>
                {member.id !== user?.id ? (
                  <Pressable
                    onPress={() => setActive.mutate({ userId: member.id, isActive: !member.isActive })}
                    className="px-3 py-1.5 rounded-full bg-error/15"
                  >
                    <Text className="text-xs font-medium text-error">
                      {member.isActive ? t.teamScreen.deactivate : t.teamScreen.activate}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add member modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-5 gap-3" style={{ maxHeight: "85%" }}>
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <Text className="text-lg font-bold text-foreground">{t.teamScreen.addNew}</Text>

              <Field label={t.teamScreen.name} value={name} onChangeText={setName} isRTL={isRTL} />
              <Field
                label={t.teamScreen.username}
                value={username}
                onChangeText={setUsername}
                isRTL={isRTL}
                autoCapitalize="none"
              />
              <Field
                label={t.teamScreen.password}
                value={password}
                onChangeText={setPassword}
                isRTL={isRTL}
                secure
              />
              <Field
                label={t.teamScreen.email}
                value={email}
                onChangeText={setEmail}
                isRTL={isRTL}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label={t.teamScreen.phone}
                value={phone}
                onChangeText={setPhone}
                isRTL={isRTL}
                keyboardType="phone-pad"
              />

              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">{t.teamScreen.role}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const active = role === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setRole(r)}
                        className="px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: active ? colors.primary : "transparent",
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text className="text-xs font-medium" style={{ color: active ? "#fff" : colors.text }}>
                          {t.role[r]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {error ? <Text className="text-sm text-error">{error}</Text> : null}

              <View className="flex-row gap-3 pt-2">
                <Pressable
                  onPress={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl py-3 items-center border border-border"
                >
                  <Text className="text-sm font-semibold text-foreground">{t.common.cancel}</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    canSubmit &&
                    createUser.mutate({
                      username: username.trim(),
                      password,
                      name: name.trim(),
                      email: email.trim(),
                      phone: phone.trim() || undefined,
                      role,
                    })
                  }
                  disabled={!canSubmit || createUser.isPending}
                  className="flex-1 rounded-xl py-3 items-center bg-primary"
                  style={{ opacity: !canSubmit || createUser.isPending ? 0.5 : 1 }}
                >
                  {createUser.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">{t.teamScreen.save}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reset password modal */}
      <Modal visible={resetTargetId !== null} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-5 gap-3">
            <Text className="text-lg font-bold text-foreground">{t.teamScreen.resetPassword}</Text>
            <Field
              label={t.teamScreen.newPassword}
              value={resetPassword}
              onChangeText={setResetPassword}
              isRTL={isRTL}
              secure
            />
            <View className="flex-row gap-3 pt-2">
              <Pressable
                onPress={() => setResetTargetId(null)}
                className="flex-1 rounded-xl py-3 items-center border border-border"
              >
                <Text className="text-sm font-semibold text-foreground">{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  resetTargetId !== null &&
                  resetPassword.length >= 8 &&
                  doResetPassword.mutate({ userId: resetTargetId, newPassword: resetPassword })
                }
                disabled={resetPassword.length < 8 || doResetPassword.isPending}
                className="flex-1 rounded-xl py-3 items-center bg-primary"
                style={{ opacity: resetPassword.length < 8 || doResetPassword.isPending ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChangeText,
  isRTL,
  secure,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isRTL: boolean;
  secure?: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "words";
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
        className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-background"
        style={{ textAlign: isRTL ? "right" : "left" }}
      />
    </View>
  );
}
