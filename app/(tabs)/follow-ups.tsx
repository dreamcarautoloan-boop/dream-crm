import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View, Modal } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type Bucket = "today" | "upcoming" | "overdue" | "completed";
const BUCKETS: Bucket[] = ["today", "overdue", "upcoming", "completed"];

export default function FollowUpsScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [bucket, setBucket] = useState<Bucket>("today");
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [newDate, setNewDate] = useState("");

  const { data, isLoading, refetch, isRefetching } = trpc.followUps.listMine.useQuery({ bucket });

  // Each follow-up row only carries assignedToSalesId/customerId; fetch customer names in a light-weight way
  const customerIds = Array.from(new Set((data ?? []).map((f) => f.customerId)));
  const { data: customers } = trpc.customers.list.useQuery(undefined, { enabled: customerIds.length > 0 });
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const complete = trpc.followUps.complete.useMutation({
    onSuccess: () => utils.followUps.listMine.invalidate(),
  });
  const cancel = trpc.followUps.cancel.useMutation({
    onSuccess: () => utils.followUps.listMine.invalidate(),
  });
  const reschedule = trpc.followUps.reschedule.useMutation({
    onSuccess: () => {
      setRescheduleId(null);
      setNewDate("");
      utils.followUps.listMine.invalidate();
    },
  });

  const emptySubtitleKey = {
    today: "emptySubtitleToday",
    upcoming: "emptySubtitleUpcoming",
    overdue: "emptySubtitleOverdue",
    completed: "emptySubtitleCompleted",
  } as const;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">{t.followUpsScreen.title}</Text>
      </View>

      <View className="pb-2">
        <FlatList
          data={BUCKETS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          inverted={isRTL}
          renderItem={({ item }) => {
            const active = item === bucket;
            return (
              <Pressable
                onPress={() => setBucket(item)}
                className="px-3.5 py-2 rounded-full border"
                style={{
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text className="text-sm font-medium" style={{ color: active ? "#fff" : colors.text }}>
                  {t.followUpsScreen[item]}
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
      ) : (data ?? []).length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <IconSymbol name="calendar" size={40} color={colors.muted} />
          <Text className="text-base font-semibold text-foreground text-center">
            {t.followUpsScreen.empty}
          </Text>
          <Text className="text-sm text-muted text-center">{t.followUpsScreen[emptySubtitleKey[bucket]]}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const customer = customerById.get(item.customerId);
            return (
              <Pressable
                onPress={() => router.push(`/customer/${item.customerId}`)}
                className="bg-surface rounded-2xl p-4 border border-border gap-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                    {customer ? `${customer.firstName} ${customer.lastName}` : `#${item.customerId}`}
                  </Text>
                  <Text className="text-xs text-muted">
                    {new Date(item.scheduledDate).toLocaleString()}
                  </Text>
                </View>
                {customer ? <Text className="text-sm text-muted">{customer.phone}</Text> : null}
                {item.reason ? <Text className="text-sm text-foreground">{item.reason}</Text> : null}

                {bucket !== "completed" ? (
                  <View className="flex-row gap-2 pt-1">
                    <Pressable
                      onPress={() => complete.mutate({ id: item.id })}
                      className="px-3 py-1.5 rounded-full bg-success/15"
                    >
                      <Text className="text-xs font-medium text-success">{t.followUpsScreen.markComplete}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRescheduleId(item.id);
                        setNewDate("");
                      }}
                      className="px-3 py-1.5 rounded-full bg-primary/15"
                    >
                      <Text className="text-xs font-medium text-primary">{t.followUpsScreen.reschedule}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => cancel.mutate({ id: item.id })}
                      className="px-3 py-1.5 rounded-full bg-error/15"
                    >
                      <Text className="text-xs font-medium text-error">{t.followUpsScreen.cancel}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={rescheduleId !== null} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-5 gap-3">
            <Text className="text-lg font-bold text-foreground">{t.followUpsScreen.reschedule}</Text>
            <TextInput
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD HH:MM"
              placeholderTextColor={colors.muted}
              className="border border-border rounded-xl px-4 py-3 text-foreground"
            />
            <View className="flex-row gap-3 pt-2">
              <Pressable
                onPress={() => setRescheduleId(null)}
                className="flex-1 rounded-xl py-3 items-center border border-border"
              >
                <Text className="text-sm font-semibold text-foreground">{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const date = new Date(newDate);
                  if (isNaN(date.getTime()) || rescheduleId === null) return;
                  reschedule.mutate({ id: rescheduleId, scheduledDate: date });
                }}
                disabled={!newDate.trim() || reschedule.isPending}
                className="flex-1 rounded-xl py-3 items-center bg-primary"
                style={{ opacity: !newDate.trim() || reschedule.isPending ? 0.5 : 1 }}
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
