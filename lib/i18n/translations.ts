export type Language = "en" | "ar";

export const LANGUAGES: { code: Language; label: string; nativeLabel: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
];

/**
 * Central translation dictionary.
 * Add new keys here as new screens are built (customers, follow-ups, reports, etc.)
 * Keep keys grouped by feature so the CRM screens in design.md map 1:1 to sections below.
 */
export const translations = {
  en: {
    common: {
      appName: "Dream Auto Loan",
      welcome: "Welcome",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      search: "Search",
      loading: "Loading...",
      getStarted: "Get Started",
      language: "Language",
    },
    home: {
      subtitle: "Auto Loan & Financing CRM",
      description: "Edit app/(tabs)/index.tsx to get started",
      cardTitle: "NativeWind Ready",
      cardBody: "Use Tailwind CSS classes directly in your React Native components.",
    },
    nav: {
      home: "Home",
      customers: "Customers",
      followUps: "Follow-ups",
      reports: "Reports",
      settings: "Settings",
    },
    status: {
      new_lead: "New Lead",
      qualified: "Qualified",
      unqualified: "Unqualified",
      in_progress: "In Progress",
      sales_opportunity: "Sales Opportunity",
      closed_won: "Closed Won",
      closed_lost: "Closed Lost",
      inactive: "Inactive",
    },
    auth: {
      signInTitle: "Sign in",
      signInSubtitle: "Enter your username and password to continue",
      username: "Username",
      password: "Password",
      signIn: "Sign in",
      signingIn: "Signing in...",
      invalidCredentials: "Invalid username or password",
      accountDeactivated: "This account has been deactivated",
      genericError: "Something went wrong. Please try again.",
      missingFields: "Please enter both username and password",
    },
  },
  ar: {
    common: {
      appName: "دريم أوتو لون",
      welcome: "أهلاً بيك",
      save: "حفظ",
      cancel: "إلغاء",
      edit: "تعديل",
      delete: "حذف",
      search: "بحث",
      loading: "جاري التحميل...",
      getStarted: "ابدأ الآن",
      language: "اللغة",
    },
    home: {
      subtitle: "نظام إدارة عملاء التمويل والسيارات",
      description: "عدّل app/(tabs)/index.tsx للبدء",
      cardTitle: "جاهز مع NativeWind",
      cardBody: "استخدم كلاسات Tailwind CSS مباشرة داخل مكونات React Native.",
    },
    nav: {
      home: "الرئيسية",
      customers: "العملاء",
      followUps: "المتابعات",
      reports: "التقارير",
      settings: "الإعدادات",
    },
    status: {
      new_lead: "عميل جديد",
      qualified: "مؤهل",
      unqualified: "غير مؤهل",
      in_progress: "قيد المتابعة",
      sales_opportunity: "فرصة بيع",
      closed_won: "تم البيع",
      closed_lost: "صفقة خاسرة",
      inactive: "غير نشط",
    },
    auth: {
      signInTitle: "تسجيل الدخول",
      signInSubtitle: "أدخل اسم المستخدم وكلمة المرور للمتابعة",
      username: "اسم المستخدم",
      password: "كلمة المرور",
      signIn: "دخول",
      signingIn: "جاري تسجيل الدخول...",
      invalidCredentials: "اسم المستخدم أو كلمة المرور غير صحيحة",
      accountDeactivated: "تم إيقاف هذا الحساب",
      genericError: "حدث خطأ ما، برجاء المحاولة مرة أخرى",
      missingFields: "من فضلك أدخل اسم المستخدم وكلمة المرور",
    },
  },
} as const;

type DeepWidenToString<T> = { [K in keyof T]: T[K] extends string ? string : DeepWidenToString<T[K]> };
export type TranslationShape = DeepWidenToString<typeof translations.en>;
