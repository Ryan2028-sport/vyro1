import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VyroLogo } from "./VyroLogo";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type SignupData = z.infer<typeof signupSchema>;
type LoginData = z.infer<typeof loginSchema>;

export function AuthScreen({
  mode,
  onToggleMode,
  onSuccess,
  onBack,
}: {
  mode: "signup" | "login";
  onToggleMode: () => void;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signupForm = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (err) setError(err.message);
  };

  const handleSignup = async (data: SignupData) => {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name } },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      onSuccess();
    }
  };

  const handleLogin = async (data: LoginData) => {
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f2f2f2] px-6 pb-10 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-full transition-colors active:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-900" />
        </button>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-sm flex-1 flex-col">
        <VyroLogo className="mb-2 w-[120px] self-center" />
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-[14px] text-gray-500">
          {mode === "signup"
            ? "Start tracking your performance"
            : "Log in to continue"}
        </p>

        {/* Social buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => handleOAuth("google")}
            className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-[15px] font-medium text-gray-900 transition-colors active:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuth("apple")}
            className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-[15px] font-medium text-gray-900 transition-colors active:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[13px] text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Email form */}
        {mode === "signup" ? (
          <form
            onSubmit={signupForm.handleSubmit(handleSignup)}
            className="flex flex-col gap-3"
          >
            <div>
              <input
                {...signupForm.register("name")}
                placeholder="Full name"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
              {signupForm.formState.errors.name && (
                <p className="mt-1 text-[12px] text-red-500">
                  {signupForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <input
                {...signupForm.register("email")}
                type="email"
                placeholder="Email"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
              {signupForm.formState.errors.email && (
                <p className="mt-1 text-[12px] text-red-500">
                  {signupForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="relative">
              <input
                {...signupForm.register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
              {signupForm.formState.errors.password && (
                <p className="mt-1 text-[12px] text-red-500">
                  {signupForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <p className="text-center text-[13px] text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors disabled:opacity-50 active:bg-gray-800"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="flex flex-col gap-3"
          >
            <div>
              <input
                {...loginForm.register("email")}
                type="email"
                placeholder="Email"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-[12px] text-red-500">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="relative">
              <input
                {...loginForm.register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-[12px] text-red-500">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <p className="text-center text-[13px] text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors disabled:opacity-50 active:bg-gray-800"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        )}

        {/* Toggle mode */}
        <p className="mt-6 text-center text-[14px] text-gray-500">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={onToggleMode}
            className="font-semibold text-gray-900"
          >
            {mode === "signup" ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
