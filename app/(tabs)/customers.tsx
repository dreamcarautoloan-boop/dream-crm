import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import type { Customer } from "@/drizzle/schema";

type StatusFilter = "all" | Customer["status"];

const STATUS_ORDER: Customer["status"][] = [
  "new_lead",
  "qualified",
  "in_progress",
  "sales_opportunity",
  "unqualified",
  "closed_won",
  "closed_lost",
  "inactive",
];

const STATUS_BADGE_CLASS: Record<Customer["status"], string> = {
  new_lead: "bg-muted/15",
  qualified: "bg-success/15",
  unqualified: "bg-error/15",
  in_progress: "bg-primary/15",
  sales_opportunity: "bg-primary/15",
  closed_won: "bg-success/15",
  closed_lost: "bg-error/15",
  inactive: "bg-muted/15",
};

const STATUS_TEXT_CLASS: Record<Customer["status"], string> = {
  new_lead: "text-muted",
  qualified: "text-success",
  unqualified: "text-error",
  in_progress: "text-primary",
  sales_opportunity: "text-primary",
  closed_won: "text-success",
  closed_lost: "text-error",
  inactive: "text-muted",
};

export default function CustomersScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const canImport = user?.role === "sales_manager" || user?.role === "team_leader" || user?.role === "moderator";

  const { data, isLoading, refetch, isRefetching } = trpc.customers.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search.trim() || undefined,
  });

  const customers = data ?? [];

  const filterChips = useMemo<StatusFilter[]>(() => ["all", ...STATUS_ORDER], []);

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">{t.customersScreen.title}</Text>
        <View className="flex-row items-center gap-2">
          {canImport ? (
            <Pressable
              onPress={() => router.push("/customer/import")}
              className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
            >
              <IconSymbol name="paperplane.fill" size={18} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push("/customer/new")}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            <IconSymbol name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View className="px-5 pb-3">
        <View
          className="flex-row items-center bg-surface rounded-xl px-3 border border-border"
          style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
        >
          <IconSymbol name="magnifyingglass" size={18} color={colors.icon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.customersScreen.searchPlaceholder}
            placeholderTextColor={colors.muted}
            className="flex-1 py-3 px-2 text-foreground"
            style={{ textAlign: isRTL ? "right" : "left" }}
          />
        </View>
      </View>

      <View className="pb-2">
        <FlatList
          data={filterChips}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          inverted={isRTL}
          renderItem={({ item }) => {
            const active = item === statusFilter;
            const label = item === "all" ? t.customersScreen.filterAll : t.status[item];
            return (
              <Pressable
                onPress={() => setStatusFilter(item)}
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
          }}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <IconSymbol name="person.2.fill" size={40} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground text-center">
            {t.customersScreen.empty}
          </Text>
          <Text className="text-sm text-muted text-center">{t.customersScreen.emptySubtitle}</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/customer/${item.id}`)}
              className="bg-surface rounded-2xl p-4 border border-border gap-2"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                  {item.firstName} {item.lastName}
                </Text>
                <View className={`px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASS[item.status]}`}>
                  <Text className={`text-xs font-medium ${STATUS_TEXT_CLASS[item.status]}`}>
                    {t.status[item.status]}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted" style={{ textAlign: isRTL ? "right" : "left" }}>
                {item.phone}
              </Text>
              {item.isDuplicate ? (
                <View className="flex-row items-center gap-1 self-start bg-warning/15 px-2 py-1 rounded-full">
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.warning} />
                  <Text className="text-xs font-medium text-warning">
                    {t.customersScreen.duplicateBadge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}
