import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const SOURCE_LABELS: Record<string, { en: string; ar: string }> = {
  external_call: { en: "External call", ar: "مكالمة خارجية" },
  facebook_leads: { en: "Facebook leads", ar: "ليدز فيسبوك" },
  referral: { en: "Referral", ar: "ترشيح" },
  existing_customer: { en: "Existing customer", ar: "عميل قديم" },
};

export default function NewCustomerScreen() {
  const router = useRouter();
  const { t, isRTL, language } = useLanguage();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: sources } = trpc.leadSources.list.useQuery();

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: (result) => {
      utils.customers.list.invalidate();
      if (result.isDuplicate) {
        Alert.alert(t.customersScreen.duplicateBadge, t.addCustomer.duplicateWarning, [
          { text: t.common.save, onPress: () => router.replace(`/customer/${result.id}`) },
        ]);
      } else {
        router.replace(`/customer/${result.id}`);
      }
    },
    onError: (err) => setError(err.message),
  });

  const canSubmit = firstName.trim() && lastName.trim() && phone.trim() && sourceId;

  const handleSubmit = () => {
    if (!canSubmit || !sourceId) return;
    setError(null);
    createCustomer.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      sourceId,
    });
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View
        className="px-5 pt-4 pb-2 flex-row items-center gap-3"
        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <IconSymbol name={isRTL ? "chevron.right" : "chevron.left"} size={22} color={colors.text} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t.addCustomer.title}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingVertical: 12 }}>
        <Field label={t.addCustomer.firstName} value={firstName} onChangeText={setFirstName} isRTL={isRTL} />
        <Field label={t.addCustomer.lastName} value={lastName} onChangeText={setLastName} isRTL={isRTL} />
        <Field
          label={t.addCustomer.phone}
          value={phone}
          onChangeText={setPhone}
          isRTL={isRTL}
          keyboardType="phone-pad"
        />
        <Field
          label={t.addCustomer.email}
          value={email}
          onChangeText={setEmail}
          isRTL={isRTL}
          keyboardType="email-address"
        />

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">{t.addCustomer.source}</Text>
          <View className="flex-row flex-wrap gap-2">
            {(sources ?? []).map((source) => {
              const active = sourceId === source.id;
              const label = SOURCE_LABELS[source.name]?.[language] ?? source.name;
              return (
                <Pressable
                  key={source.id}
                  onPress={() => setSourceId(source.id)}
                  className="px-3.5 py-2 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.primary : "transparent",
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: active ? "#fff" : colors.text }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text className="text-sm text-error">{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || createCustomer.isPending}
          className="rounded-xl py-3.5 items-center bg-primary mt-2"
          style={{ opacity: !canSubmit || createCustomer.isPending ? 0.5 : 1 }}
        >
          {createCustomer.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">{t.addCustomer.save}</Text>
          )}
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
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isRTL: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-background"
        style={{ textAlign: isRTL ? "right" : "left" }}
      />
    </View>
  );
}
