import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type ParsedRow = { firstName: string; lastName: string; phone: string; email?: string };

const SOURCE_LABELS: Record<string, { en: string; ar: string }> = {
  external_call: { en: "External call", ar: "مكالمة خارجية" },
  facebook_leads: { en: "Facebook leads", ar: "ليدز فيسبوك" },
  referral: { en: "Referral", ar: "ترشيح" },
  existing_customer: { en: "Existing customer", ar: "عميل قديم" },
};

function looksLikeHeaderRow(row: unknown[]): boolean {
  const phoneCell = String(row[2] ?? "").replace(/\D/g, "");
  return phoneCell.length < 5; // a real phone number has at least 5 digits
}

function parseWorkbookRows(base64: string): ParsedRow[] {
  const workbook = XLSX.read(base64, { type: "base64" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const dataRows = raw.length > 0 && looksLikeHeaderRow(raw[0]) ? raw.slice(1) : raw;

  return dataRows
    .map((row): ParsedRow | null => {
      const firstName = String(row[0] ?? "").trim();
      const lastName = String(row[1] ?? "").trim();
      const phone = String(row[2] ?? "").trim();
      const email = String(row[3] ?? "").trim();
      if (!firstName || !lastName || phone.replace(/\D/g, "").length < 5) return null;
      return { firstName, lastName, phone, email: email || undefined };
    })
    .filter((r): r is ParsedRow => r !== null);
}

export default function ImportCustomersScreen() {
  const router = useRouter();
  const { t, isRTL, language } = useLanguage();
  const colors = useColors();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [assignedToSalesId, setAssignedToSalesId] = useState<number | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);

  const { data: sources } = trpc.leadSources.list.useQuery();
  const { data: allSalesReps } = trpc.users.list.useQuery({ role: "sales" });
  const salesReps =
    user?.role === "team_leader" ? (allSalesReps ?? []).filter((r) => r.teamId === user.teamId) : allSalesReps;

  const bulkImport = trpc.customers.bulkImport.useMutation({
    onSuccess: (res) => {
      setResult({ imported: res.imported, duplicates: res.duplicates });
      utils.customers.list.invalidate();
    },
    onError: (err) => setParseError(err.message),
  });

  const handlePickFile = async () => {
    setParseError(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ],
      base64: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setFileName(asset.name);
    setParsing(true);
    try {
      let base64: string;
      if (asset.base64) {
        base64 = asset.base64;
      } else if (Platform.OS !== "web") {
        const FileSystem = await import("expo-file-system/legacy");
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
      } else {
        throw new Error("Could not read file");
      }
      const parsed = parseWorkbookRows(base64);
      if (parsed.length === 0) {
        setParseError(t.importScreen.noRows);
      }
      setRows(parsed);
    } catch {
      setParseError(t.importScreen.noRows);
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const canImport = rows.length > 0 && sourceId && assignedToSalesId;

  if (result) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="items-center justify-center px-8">
        <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
        <Text className="text-xl font-bold text-foreground mt-4 text-center">{t.importScreen.resultTitle}</Text>
        <Text className="text-base text-foreground mt-3">
          {result.imported} {t.importScreen.resultImported}
        </Text>
        {result.duplicates > 0 ? (
          <Text className="text-base text-warning mt-1">
            {result.duplicates} {t.importScreen.resultDuplicates}
          </Text>
        ) : null}
        <Pressable
          onPress={() => router.replace("/customers")}
          className="rounded-xl px-6 py-3 items-center bg-primary mt-6"
        >
          <Text className="text-sm font-semibold text-white">{t.importScreen.done}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View
        className="px-5 pt-4 pb-2 flex-row items-center gap-3"
        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <IconSymbol name={isRTL ? "chevron.right" : "chevron.left"} size={22} color={colors.text} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t.importScreen.title}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingVertical: 12 }}>
        <Pressable
          onPress={handlePickFile}
          className="rounded-xl py-4 items-center border-2 border-dashed border-border gap-2"
        >
          <IconSymbol name="paperplane.fill" size={22} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary">
            {fileName ? t.importScreen.changeFile : t.importScreen.pickFile}
          </Text>
          {fileName ? <Text className="text-xs text-muted">{fileName}</Text> : null}
        </Pressable>

        <Text className="text-xs text-muted">{t.importScreen.columnNote}</Text>

        {parsing ? (
          <View className="flex-row items-center gap-2 justify-center py-4">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm text-muted">{t.importScreen.parsing}</Text>
          </View>
        ) : null}

        {parseError ? <Text className="text-sm text-error">{parseError}</Text> : null}

        {rows.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-foreground">
              {rows.length} {t.importScreen.rowsFound}
            </Text>

            <View className="bg-surface rounded-xl border border-border p-3 gap-1.5">
              <Text className="text-xs font-semibold text-muted">{t.importScreen.preview}</Text>
              {rows.slice(0, 5).map((r, i) => (
                <Text key={i} className="text-sm text-foreground">
                  {r.firstName} {r.lastName} · {r.phone}
                </Text>
              ))}
              {rows.length > 5 ? <Text className="text-xs text-muted">+{rows.length - 5}</Text> : null}
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">{t.importScreen.source}</Text>
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
                      <Text className="text-sm font-medium" style={{ color: active ? "#fff" : colors.text }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">{t.importScreen.assignTo}</Text>
              <View className="flex-row flex-wrap gap-2">
                {(salesReps ?? []).length === 0 ? (
                  <Text className="text-sm text-muted">{t.importScreen.pickSalesRep}</Text>
                ) : null}
                {(salesReps ?? []).map((rep) => {
                  const active = assignedToSalesId === rep.id;
                  return (
                    <Pressable
                      key={rep.id}
                      onPress={() => setAssignedToSalesId(rep.id)}
                      className="px-3.5 py-2 rounded-full border"
                      style={{
                        backgroundColor: active ? colors.primary : "transparent",
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text className="text-sm font-medium" style={{ color: active ? "#fff" : colors.text }}>
                        {rep.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() =>
                canImport &&
                bulkImport.mutate({
                  sourceId: sourceId!,
                  assignedToSalesId: assignedToSalesId!,
                  rows,
                })
              }
              disabled={!canImport || bulkImport.isPending}
              className="rounded-xl py-3.5 items-center bg-primary mt-2"
              style={{ opacity: !canImport || bulkImport.isPending ? 0.5 : 1 }}
            >
              {bulkImport.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">{t.importScreen.import}</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
