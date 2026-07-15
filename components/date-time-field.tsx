import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  minimumDate?: Date;
};

/**
 * Native picker flow: tapping opens the date picker first, then (on
 * confirming a date) opens the time picker. Android shows these as two
 * separate native dialogs; iOS uses an inline spinner/calendar depending on
 * OS version, both handled by the underlying library.
 */
export function DateTimeField({ value, onChange, placeholder, minimumDate }: Props) {
  const colors = useColors();
  const [stage, setStage] = useState<"idle" | "date" | "time">("idle");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const label = value
    ? value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : placeholder;

  return (
    <View>
      <Pressable
        onPress={() => setStage("date")}
        className="border border-border rounded-xl px-4 py-3 bg-background"
      >
        <Text style={{ color: value ? colors.text : colors.muted }}>{label}</Text>
      </Pressable>

      {stage === "date" ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          minimumDate={minimumDate}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event, selected) => {
            if (event.type === "dismissed" || !selected) {
              setStage("idle");
              return;
            }
            setPendingDate(selected);
            setStage("time");
          }}
        />
      ) : null}

      {stage === "time" ? (
        <DateTimePicker
          value={pendingDate ?? value ?? new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => {
            setStage("idle");
            if (event.type === "dismissed" || !selected || !pendingDate) return;
            const combined = new Date(pendingDate);
            combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            onChange(combined);
          }}
        />
      ) : null}
    </View>
  );
}
