import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { DateTimeField } from "@/components/date-time-field";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import type { TranslationShape } from "@/lib/i18n/translations";

type NoteType = "call" | "whatsapp" | "email" | "meeting" | "follow_up";
type Outcome = "interested" | "thinking" | "not_interested" | "qualified" | "unqualified";
type ReasonCategory =
  | "customer_not_interested"
  | "financing_rejected"
  | "found_competitor"
  | "price_issue"
  | "timing_issue"
  | "other";

const NOTE_TYPES: NoteType[] = ["call", "whatsapp", "email", "meeting", "follow_up"];
const OUTCOMES: Outcome[] = ["interested", "thinking", "not_interested", "qualified", "unqualified"];
const REASON_CATEGORIES: ReasonCategory[] = [
  "customer_not_interested",
  "financing_rejected",
  "found_competitor",
  "price_issue",
  "timing_issue",
  "other",
];

function outcomeLabel(t: TranslationShape, outcome: Outcome): string {
  if (outcome === "qualified") return t.customerDetail.qualified;
  if (outcome === "unqualified") return t.customerDetail.unqualified;
  return t.interest[outcome];
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<"notes" | "followups" | "financing">("notes");
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("call");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [followUpReason, setFollowUpReason] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeCategory, setCloseCategory] = useState<ReasonCategory>("customer_not_interested");
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [duration, setDuration] = useState("");

  const { data: customer, isLoading } = trpc.customers.getById.useQuery({ id: customerId });
  const { data: notes } = trpc.salesNotes.listByCustomer.useQuery({ customerId });
  const { data: followUps } = trpc.followUps.listMine.useQuery(
    { bucket: "today", salesId: customer?.assignedToSalesId },
    { enabled: tab === "followups" && !!customer },
  );
  const { data: upcomingFollowUps } = trpc.followUps.listMine.useQuery(
    { bucket: "upcoming", salesId: customer?.assignedToSalesId },
    { enabled: tab === "followups" && !!customer },
  );
  const { data: partners } = trpc.installments.listPartners.useQuery(undefined, { enabled: tab === "financing" });
  const { data: applications } = trpc.installments.listByCustomer.useQuery(
    { customerId },
    { enabled: tab === "financing" },
  );

  const invalidateAll = () => {
    utils.customers.getById.invalidate({ id: customerId });
    utils.customers.list.invalidate();
    utils.salesNotes.listByCustomer.invalidate({ customerId });
    utils.followUps.listMine.invalidate();
    utils.installments.listByCustomer.invalidate({ customerId });
  };

  const addNote = trpc.salesNotes.create.useMutation({
    onSuccess: () => {
      setNoteText("");
      setOutcome(null);
      invalidateAll();
    },
  });

  const scheduleFollowUp = trpc.followUps.create.useMutation({
    onSuccess: () => {
      setShowFollowUpModal(false);
      setFollowUpDate(null);
      setFollowUpReason("");
      invalidateAll();
    },
  });

  const completeFollowUp = trpc.followUps.complete.useMutation({ onSuccess: invalidateAll });

  const closeDeal = trpc.lostDeals.create.useMutation({
    onSuccess: () => {
      setShowCloseModal(false);
      invalidateAll();
      router.back();
    },
  });

  const submitApplication = trpc.installments.create.useMutation({
    onSuccess: () => {
      setSelectedPartnerId(null);
      setLoanAmount("");
      setMonthlyPayment("");
      setDuration("");
      invalidateAll();
    },
  });

  const updateApplicationStatus = trpc.installments.updateStatus.useMutation({ onSuccess: invalidateAll });

  const allFollowUps = useMemo(
    () => [...(followUps ?? []), ...(upcomingFollowUps ?? [])],
    [followUps, upcomingFollowUps],
  );

  if (isLoading || !customer) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View
        className="px-5 pt-4 pb-3 flex-row items-center gap-3"
        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <IconSymbol name={isRTL ? "chevron.right" : "chevron.left"} size={22} color={colors.text} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
            {customer.firstName} {customer.lastName}
          </Text>
          <Text className="text-sm text-muted">{customer.phone}</Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Status row */}
        <View className="px-5 flex-row flex-wrap gap-2 pb-4">
          <Badge label={t.status[customer.status]} tone="primary" />
          {customer.isQualified !== null ? (
            <Badge
              label={customer.isQualified ? t.customerDetail.qualified : t.customerDetail.unqualified}
              tone={customer.isQualified ? "success" : "error"}
            />
          ) : null}
          {customer.interestLevel ? <Badge label={t.interest[customer.interestLevel]} tone="warning" /> : null}
        </View>

        {/* Tabs */}
        <View className="flex-row px-5 gap-6 border-b border-border">
          <TabButton active={tab === "notes"} label={t.customerDetail.notesTab} onPress={() => setTab("notes")} />
          <TabButton
            active={tab === "followups"}
            label={t.customerDetail.followUpsTab}
            onPress={() => setTab("followups")}
          />
          <TabButton
            active={tab === "financing"}
            label={t.financing.tab}
            onPress={() => setTab("financing")}
          />
        </View>

        {tab === "notes" ? (
          <View className="px-5 pt-4 gap-4">
            {/* Add note form */}
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row flex-wrap gap-2">
                {NOTE_TYPES.map((nt) => {
                  const active = nt === noteType;
                  return (
                    <Pressable
                      key={nt}
                      onPress={() => setNoteType(nt)}
                      className="px-3 py-1.5 rounded-full border"
                      style={{
                        backgroundColor: active ? colors.primary : "transparent",
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: active ? "#fff" : colors.text }}
                      >
                        {t.noteType[nt]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t.customerDetail.notePlaceholder}
                placeholderTextColor={colors.muted}
                multiline
                className="border border-border rounded-xl px-3 py-2.5 text-foreground min-h-20"
                style={{ textAlign: isRTL ? "right" : "left", textAlignVertical: "top" }}
              />

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted">{t.customerDetail.outcome}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {OUTCOMES.map((o) => {
                    const active = outcome === o;
                    return (
                      <Pressable
                        key={o}
                        onPress={() => setOutcome(active ? null : o)}
                        className="px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: active ? colors.success : "transparent",
                          borderColor: active ? colors.success : colors.border,
                        }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: active ? "#fff" : colors.text }}
                        >
                          {outcomeLabel(t, o)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() =>
                  noteText.trim() &&
                  addNote.mutate({
                    customerId,
                    note: noteText.trim(),
                    noteType,
                    outcome: outcome ?? undefined,
                  })
                }
                disabled={!noteText.trim() || addNote.isPending}
                className="rounded-xl py-2.5 items-center bg-primary"
                style={{ opacity: !noteText.trim() || addNote.isPending ? 0.5 : 1 }}
              >
                {addNote.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-white">{t.customerDetail.addNote}</Text>
                )}
              </Pressable>
            </View>

            {/* Notes timeline */}
            {(notes ?? []).length === 0 ? (
              <Text className="text-sm text-muted text-center py-6">{t.customerDetail.noNotes}</Text>
            ) : (
              <View className="gap-2 pb-4">
                {[...(notes ?? [])].reverse().map((note) => (
                  <View key={note.id} className="bg-surface rounded-xl p-3.5 border border-border gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-primary">{t.noteType[note.noteType]}</Text>
                      <Text className="text-xs text-muted">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground" style={{ textAlign: isRTL ? "right" : "left" }}>
                      {note.note}
                    </Text>
                    {note.outcome ? (
                      <Text className="text-xs text-muted">{outcomeLabel(t, note.outcome)}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : tab === "followups" ? (
          <View className="px-5 pt-4 gap-3 pb-4">
            <Pressable
              onPress={() => setShowFollowUpModal(true)}
              className="rounded-xl py-3 items-center bg-primary flex-row justify-center gap-2"
            >
              <IconSymbol name="calendar" size={16} color="#fff" />
              <Text className="text-sm font-semibold text-white">{t.customerDetail.scheduleFollowUp}</Text>
            </Pressable>

            {allFollowUps.length === 0 ? (
              <Text className="text-sm text-muted text-center py-6">{t.followUpsScreen.empty}</Text>
            ) : (
              allFollowUps.map((f) => (
                <View key={f.id} className="bg-surface rounded-xl p-3.5 border border-border gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-foreground">
                      {new Date(f.scheduledDate).toLocaleString()}
                    </Text>
                  </View>
                  {f.reason ? <Text className="text-sm text-muted">{f.reason}</Text> : null}
                  <Pressable
                    onPress={() => completeFollowUp.mutate({ id: f.id })}
                    className="self-start px-3 py-1.5 rounded-full bg-success/15"
                  >
                    <Text className="text-xs font-medium text-success">{t.followUpsScreen.markComplete}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="px-5 pt-4 gap-4 pb-4">
            {/* Submit financing application */}
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <Text className="text-sm font-semibold text-foreground">{t.financing.submit}</Text>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted">{t.financing.partner}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(partners ?? []).map((partner) => {
                    const active = selectedPartnerId === partner.id;
                    return (
                      <Pressable
                        key={partner.id}
                        onPress={() => setSelectedPartnerId(partner.id)}
                        className="px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: active ? colors.primary : "transparent",
                          borderColor: active ? colors.primary : colors.border,
                        }}
                      >
                        <Text className="text-xs font-medium" style={{ color: active ? "#fff" : colors.text }}>
                          {partner.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <TextInput
                value={loanAmount}
                onChangeText={setLoanAmount}
                placeholder={t.financing.loanAmount}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="border border-border rounded-xl px-3 py-2.5 text-foreground"
                style={{ textAlign: isRTL ? "right" : "left" }}
              />
              <TextInput
                value={monthlyPayment}
                onChangeText={setMonthlyPayment}
                placeholder={t.financing.monthlyPayment}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="border border-border rounded-xl px-3 py-2.5 text-foreground"
                style={{ textAlign: isRTL ? "right" : "left" }}
              />
              <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder={t.financing.duration}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="border border-border rounded-xl px-3 py-2.5 text-foreground"
                style={{ textAlign: isRTL ? "right" : "left" }}
              />

              <Pressable
                onPress={() =>
                  selectedPartnerId &&
                  submitApplication.mutate({
                    customerId,
                    partnerId: selectedPartnerId,
                    loanAmount: loanAmount ? Number(loanAmount) : undefined,
                    monthlyPayment: monthlyPayment ? Number(monthlyPayment) : undefined,
                    duration: duration ? Number(duration) : undefined,
                  })
                }
                disabled={!selectedPartnerId || submitApplication.isPending}
                className="rounded-xl py-2.5 items-center bg-primary"
                style={{ opacity: !selectedPartnerId || submitApplication.isPending ? 0.5 : 1 }}
              >
                {submitApplication.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-white">{t.financing.submitButton}</Text>
                )}
              </Pressable>
            </View>

            {/* Existing applications */}
            {(applications ?? []).length === 0 ? (
              <Text className="text-sm text-muted text-center py-4">{t.financing.noApplications}</Text>
            ) : (
              [...(applications ?? [])].reverse().map((app) => {
                const partner = (partners ?? []).find((p) => p.id === app.partnerId);
                return (
                  <View key={app.id} className="bg-surface rounded-xl p-3.5 border border-border gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">
                        {partner?.displayName ?? `#${app.partnerId}`}
                      </Text>
                      <Badge
                        label={t.financing.status[app.status]}
                        tone={
                          app.status === "approved"
                            ? "success"
                            : app.status === "rejected" || app.status === "customer_rejected"
                              ? "error"
                              : "warning"
                        }
                      />
                    </View>
                    {app.loanAmount ? (
                      <Text className="text-sm text-muted">{app.loanAmount}</Text>
                    ) : null}
                    <View className="flex-row flex-wrap gap-2 pt-1">
                      {(["pending", "approved", "rejected", "customer_rejected"] as const)
                        .filter((s) => s !== app.status)
                        .map((s) => (
                          <Pressable
                            key={s}
                            onPress={() => updateApplicationStatus.mutate({ id: app.id, status: s })}
                            className="px-3 py-1.5 rounded-full bg-primary/15"
                          >
                            <Text className="text-xs font-medium text-primary">{t.financing.status[s]}</Text>
                          </Pressable>
                        ))}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Close deal action */}
      <View className="px-5 py-3 border-t border-border">
        <Pressable
          onPress={() => setShowCloseModal(true)}
          className="rounded-xl py-3 items-center bg-error/10"
        >
          <Text className="text-sm font-semibold text-error">{t.customerDetail.closeDeal}</Text>
        </Pressable>
      </View>

      {/* Schedule follow-up modal */}
      <Modal visible={showFollowUpModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-5 gap-3">
            <Text className="text-lg font-bold text-foreground">{t.customerDetail.scheduleFollowUp}</Text>
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">{t.customerDetail.followUpDate}</Text>
              <DateTimeField
                value={followUpDate}
                onChange={setFollowUpDate}
                placeholder={t.customerDetail.followUpDate}
                minimumDate={new Date()}
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">{t.customerDetail.followUpReason}</Text>
              <TextInput
                value={followUpReason}
                onChangeText={setFollowUpReason}
                className="border border-border rounded-xl px-4 py-3 text-foreground"
                style={{ textAlign: isRTL ? "right" : "left" }}
              />
            </View>
            <View className="flex-row gap-3 pt-2">
              <Pressable
                onPress={() => setShowFollowUpModal(false)}
                className="flex-1 rounded-xl py-3 items-center border border-border"
              >
                <Text className="text-sm font-semibold text-foreground">{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!followUpDate) return;
                  scheduleFollowUp.mutate({
                    customerId,
                    scheduledDate: followUpDate,
                    reason: followUpReason.trim() || undefined,
                  });
                }}
                disabled={!followUpDate || scheduleFollowUp.isPending}
                className="flex-1 rounded-xl py-3 items-center bg-primary"
                style={{ opacity: !followUpDate || scheduleFollowUp.isPending ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close deal modal */}
      <Modal visible={showCloseModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-5 gap-3">
            <Text className="text-lg font-bold text-foreground">{t.customerDetail.closeDeal}</Text>
            <View className="flex-row flex-wrap gap-2">
              {REASON_CATEGORIES.map((cat) => {
                const active = closeCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCloseCategory(cat)}
                    className="px-3 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: active ? colors.error : "transparent",
                      borderColor: active ? colors.error : colors.border,
                    }}
                  >
                    <Text className="text-xs font-medium" style={{ color: active ? "#fff" : colors.text }}>
                      {t.reasonCategory[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder={t.customerDetail.closeDealReason}
              placeholderTextColor={colors.muted}
              multiline
              className="border border-border rounded-xl px-4 py-3 text-foreground min-h-16"
              style={{ textAlign: isRTL ? "right" : "left", textAlignVertical: "top" }}
            />
            <View className="flex-row gap-3 pt-2">
              <Pressable
                onPress={() => setShowCloseModal(false)}
                className="flex-1 rounded-xl py-3 items-center border border-border"
              >
                <Text className="text-sm font-semibold text-foreground">{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  closeReason.trim() &&
                  closeDeal.mutate({ customerId, reason: closeReason.trim(), reasonCategory: closeCategory })
                }
                disabled={!closeReason.trim() || closeDeal.isPending}
                className="flex-1 rounded-xl py-3 items-center bg-error"
                style={{ opacity: !closeReason.trim() || closeDeal.isPending ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">{t.customerDetail.closeDeal}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const BADGE_BG: Record<"primary" | "success" | "error" | "warning", string> = {
  primary: "bg-primary/15",
  success: "bg-success/15",
  error: "bg-error/15",
  warning: "bg-warning/15",
};
const BADGE_TEXT: Record<"primary" | "success" | "error" | "warning", string> = {
  primary: "text-primary",
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
};

function Badge({ label, tone }: { label: string; tone: "primary" | "success" | "error" | "warning" }) {
  return (
    <View className={`px-2.5 py-1 rounded-full ${BADGE_BG[tone]}`}>
      <Text className={`text-xs font-medium ${BADGE_TEXT[tone]}`}>{label}</Text>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} className="pb-3" style={{ borderBottomWidth: active ? 2 : 0, borderBottomColor: colors.primary }}>
      <Text className="text-sm font-semibold" style={{ color: active ? colors.primary : colors.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}
