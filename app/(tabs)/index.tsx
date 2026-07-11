import { ScrollView, Text, View, TouchableOpacity } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * Home Screen
 *
 * The language toggle (globe icon) sits in the top-left corner of the screen,
 * on top of everything else via absolute positioning. It automatically flips
 * to the top-right when the active language is RTL (Arabic), since "start"
 * in RTL layouts is visually on the right.
 */
export default function HomeScreen() {
  const { t, isRTL } = useLanguage();

  return (
    <ScreenContainer className="p-6">
      <View
        className="absolute top-4 z-10"
        style={isRTL ? { right: 16 } : { left: 16 }}
      >
        <LanguageToggle />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-8 pt-14">
          {/* Hero Section */}
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground">{t.common.welcome}</Text>
            <Text className="text-base text-muted text-center">{t.home.subtitle}</Text>
          </View>

          {/* Example Card */}
          <View className="w-full max-w-sm self-center bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">{t.home.cardTitle}</Text>
            <Text className="text-sm text-muted leading-relaxed">{t.home.cardBody}</Text>
          </View>

          {/* Example Button */}
          <View className="items-center">
            <TouchableOpacity className="bg-primary px-6 py-3 rounded-full active:opacity-80">
              <Text className="text-background font-semibold">{t.common.getStarted}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
