/**
 * Re-exported from contexts/auth-context.tsx so existing imports
 * (`@/hooks/use-auth`) keep working. The actual implementation now lives in
 * a shared context mounted once at the app root — see that file for why.
 */
export { useAuth } from "@/contexts/auth-context";
