import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nManager, Platform } from "react-native";

import { LANGUAGES, translations, type Language, type TranslationShape } from "./translations";

const STORAGE_KEY = "dream-crm.language";

type LanguageContextValue = {
  language: Language;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  t: TranslationShape;
  /** Switches the active language. On native, RTL changes require an app reload to fully apply. */
  setLanguage: (lang: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyWebDirection(dir: "ltr" | "rtl") {
  if (Platform.OS !== "web") return;
  if (typeof document === "undefined") return;
  document.documentElement.dir = dir;
  document.documentElement.lang = dir === "rtl" ? "ar" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "ar") {
          setLanguageState(stored);
          const meta = LANGUAGES.find((l) => l.code === stored)!;
          applyWebDirection(meta.dir);
        } else {
          applyWebDirection("ltr");
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    const meta = LANGUAGES.find((l) => l.code === lang)!;
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    applyWebDirection(meta.dir);

    // Native RTL requires I18nManager + a reload to fully mirror layouts.
    if (Platform.OS !== "web") {
      const shouldBeRTL = meta.dir === "rtl";
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
        // Caller (LanguageToggle) is responsible for prompting/triggering a reload,
        // since Updates.reloadAsync is only available in non-Expo-Go builds.
      }
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const meta = LANGUAGES.find((l) => l.code === language)!;
    return {
      language,
      dir: meta.dir,
      isRTL: meta.dir === "rtl",
      t: translations[language],
      setLanguage,
    };
  }, [language, setLanguage]);

  // Avoid a flash of the wrong direction/language on web while loading persisted pref.
  if (!ready && Platform.OS === "web") {
    return null;
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
