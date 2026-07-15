import { unstable_createElement } from "react-native-web";
import { useColors } from "@/hooks/use-colors";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  minimumDate?: Date;
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimeField({ value, onChange, placeholder, minimumDate }: Props) {
  const colors = useColors();

  return unstable_createElement("input", {
    type: "datetime-local",
    value: value ? toLocalInputValue(value) : "",
    placeholder,
    min: minimumDate ? toLocalInputValue(minimumDate) : undefined,
    onChange: (e: { target: { value: string } }) => {
      if (!e.target.value) return;
      const parsed = new Date(e.target.value);
      if (!isNaN(parsed.getTime())) onChange(parsed);
    },
    style: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingInline: 16,
      paddingBlock: 12,
      backgroundColor: colors.background,
      color: colors.text,
      fontSize: 15,
      fontFamily: "inherit",
      width: "100%",
    },
  });
}
