import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/i18n/language-context";
import { LANGUAGES } from "@/lib/i18n/translations";

/**
 * Language selector button — meant to be placed in the top-left corner of a screen.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer>
 *   <View className="absolute top-4 left-4 z-10">
 *     <LanguageToggle />
 *   </View>
 *   ...
 * </ScreenContainer>
 * ```
 */
export function LanguageToggle() {
  const colors = useColors();
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t.common.language}
        className="flex-row items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-2 active:opacity-70"
      >
        <IconSymbol name="globe" size={18} color={colors.text} />
        <Text className="text-sm font-medium text-foreground">
          {language.toUpperCase()}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center px-8"
          onPress={() => setOpen(false)}
        >
          <View className="w-full max-w-xs bg-background rounded-2xl border border-border overflow-hidden">
            <View className="px-4 py-3 border-b border-border">
              <Text className="text-base font-semibold text-foreground">{t.common.language}</Text>
            </View>
            {LANGUAGES.map((lang) => {
              const selected = lang.code === language;
              return (
                <Pressable
                  key={lang.code}
                  onPress={async () => {
                    await setLanguage(lang.code);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
                >
                  <Text className="text-base text-foreground">{lang.nativeLabel}</Text>
                  {selected && <IconSymbol name="chevron.right" size={18} color={colors.tint} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
