import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLanguage } from "@/lib/i18n/language-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Row = {
  salesRepUsername: string;
  firstName: string;
  lastName: string;
  phone: string;
  sourceKey: "existing_customer" | "facebook_leads" | "referral" | "external_call";
  status:
    | "new_lead"
    | "qualified"
    | "unqualified"
    | "in_progress"
    | "sales_opportunity"
    | "closed_won"
    | "closed_lost"
    | "inactive";
  isQualified?: boolean | null;
  interestLevel?: "interested" | "thinking" | "not_interested" | null;
  note?: string;
  nextFollowUp?: string | null;
  isLost?: boolean;
};

const BATCH_SIZE = 50;

export default function LegacyImportScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number; skipped: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const isManager = user?.role === "sales_manager";
  const legacyImport = trpc.customers.legacyImport.useMutation();

  const handlePickFile = async () => {
    setError(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      base64: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setFileName(asset.name);
    setParsing(true);
    try {
      let text: string;
      if (Platform.OS === "web" && asset.file) {
        text = await asset.file.text();
      } else {
        const FileSystem = await import("expo-file-system/legacy");
        text = await FileSystem.readAsStringAsync(asset.uri);
      }
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      setRows(parsed);
    } catch {
      setError(t.legacyImportScreen.invalidFile);
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    let imported = 0;
    let duplicates = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const res = await legacyImport.mutateAsync({ rows: batch });
        imported += res.imported;
        duplicates += res.duplicates;
        skipped += batch.length - res.imported - res.duplicates;
        setProgress({ done: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
      }
      setResult({ imported, duplicates, skipped });
      utils.customers.list.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!isManager) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="items-center justify-center px-8">
        <Text className="text-base text-muted text-center">{t.teamScreen.accessDenied}</Text>
      </ScreenContainer>
    );
  }

  if (result) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="items-center justify-center px-8">
        <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
        <Text className="text-xl font-bold text-foreground mt-4 text-center">
          {t.legacyImportScreen.resultTitle}
        </Text>
        <Text className="text-base text-foreground mt-3">
          {result.imported} {t.legacyImportScreen.resultImported}
        </Text>
        {result.duplicates > 0 ? (
          <Text className="text-base text-warning mt-1">
            {result.duplicates} {t.legacyImportScreen.resultDuplicates}
          </Text>
        ) : null}
        {result.skipped > 0 ? (
          <Text className="text-base text-error mt-1">
            {result.skipped} {t.legacyImportScreen.resultSkipped}
          </Text>
        ) : null}
        <Pressable
          onPress={() => router.replace("/customers")}
          className="rounded-xl px-6 py-3 items-center bg-primary mt-6"
        >
          <Text className="text-sm font-semibold text-white">{t.legacyImportScreen.done}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const repCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.salesRepUsername] = (acc[r.salesRepUsername] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View
        className="px-5 pt-4 pb-2 flex-row items-center gap-3"
        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <IconSymbol name={isRTL ? "chevron.right" : "chevron.left"} size={22} color={colors.text} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">{t.legacyImportScreen.title}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingVertical: 12 }}>
        <View className="bg-warning/10 rounded-xl p-3">
          <Text className="text-sm text-warning">{t.legacyImportScreen.warning}</Text>
        </View>

        <Pressable
          onPress={handlePickFile}
          className="rounded-xl py-4 items-center border-2 border-dashed border-border gap-2"
        >
          <IconSymbol name="paperplane.fill" size={22} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary">
            {fileName ? t.legacyImportScreen.changeFile : t.legacyImportScreen.pickFile}
          </Text>
          {fileName ? <Text className="text-xs text-muted">{fileName}</Text> : null}
        </Pressable>

        {parsing ? (
          <View className="flex-row items-center gap-2 justify-center py-4">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm text-muted">{t.legacyImportScreen.parsing}</Text>
          </View>
        ) : null}

        {error ? <Text className="text-sm text-error">{error}</Text> : null}

        {rows.length > 0 ? (
          <>
            <Text className="text-sm font-semibold text-foreground">
              {rows.length} {t.legacyImportScreen.rowsFound}
            </Text>

            <View className="bg-surface rounded-xl border border-border p-3 gap-1.5">
              <Text className="text-xs font-semibold text-muted">{t.legacyImportScreen.byRep}</Text>
              {Object.entries(repCounts).map(([rep, count]) => (
                <Text key={rep} className="text-sm text-foreground">
                  {rep}: {count}
                </Text>
              ))}
            </View>

            {importing && progress ? (
              <Text className="text-sm text-muted text-center">
                {t.legacyImportScreen.importing} {progress.done}/{progress.total}
              </Text>
            ) : null}

            <Pressable
              onPress={handleImport}
              disabled={importing}
              className="rounded-xl py-3.5 items-center bg-primary mt-2"
              style={{ opacity: importing ? 0.5 : 1 }}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">{t.legacyImportScreen.import}</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
