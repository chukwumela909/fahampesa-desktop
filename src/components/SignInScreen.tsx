import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export type LoginMode = "email" | "phone";

interface SignInScreenProps {
  mode: LoginMode;
  email: string;
  phone: string;
  password: string;
  error: string;
  onModeChange: (mode: LoginMode) => void;
  onEmailChange: (email: string) => void;
  onPhoneChange: (phone: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function SignInScreen({
  mode,
  email,
  phone,
  password,
  error,
  onModeChange,
  onEmailChange,
  onPhoneChange,
  onPasswordChange,
  onSubmit,
}: SignInScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="min-h-screen bg-[#f6f6f9] relative flex flex-col items-center justify-center overflow-x-hidden"
      style={{ fontFamily: "var(--font-dm-sans)" }}
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[80px] bg-white px-4 md:px-[100px] flex items-center justify-between border-b border-gray-100 z-10">
        <div className="flex items-center gap-[7px]">
          <div className="w-[32px] h-[32px] relative shrink-0">
            <img src="/assets/figma/landing/logo-icon.svg" alt="FahamPesa" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[20px] text-[#001223] leading-none" style={{ fontFamily: "var(--font-roboto)" }}>
              Fahampesa
            </span>
            <span className="font-light text-[10px] text-[#001223]" style={{ fontFamily: "var(--font-inter)" }}>
              Smart Business Tools
            </span>
          </div>
        </div>
      </header>

      {/* Main Card */}
      <div className="bg-white rounded-[16px] p-[30px] w-full max-w-[600px] mx-4 mt-[100px] flex flex-col gap-[29px] animate-fade-in">
        {/* Title */}
        <div>
          <h1 className="font-bold text-[24px] text-[#191d23]">Welcome Back!</h1>
          <p className="text-[16px] text-[#64748b] mt-1">Login with Email or Phone Number</p>
        </div>

        {/* Segmented toggle */}
        <div className="bg-[#f4f4f5] p-[5px] rounded-[8px] flex gap-[16px] h-[50px] relative">
          <span
            className="absolute top-[5px] bottom-[5px] bg-white rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.05)] transition-all duration-200"
            style={{ left: mode === "email" ? "5px" : "calc(50% + 8px)", width: "calc(50% - 13px)" }}
          />
          <button
            type="button"
            onClick={() => onModeChange("email")}
            className={`flex-1 rounded-[8px] text-[16px] font-semibold z-10 transition-colors duration-200 ${
              mode === "email" ? "text-black" : "text-[#717171] hover:text-black"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => onModeChange("phone")}
            className={`flex-1 rounded-[8px] text-[16px] font-semibold z-10 transition-colors duration-200 ${
              mode === "phone" ? "text-black" : "text-[#717171] hover:text-black"
            }`}
          >
            Phone Number
          </button>
        </div>

        <form className="flex flex-col gap-[20px]" onSubmit={onSubmit}>
          {/* Identity field */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[16px] text-black">{mode === "email" ? "Email Address" : "Phone Number"}</label>
            <div className="border border-[#bfc4cb] rounded-[8px] p-[16px] flex items-center bg-white">
              {mode === "email" ? (
                <input
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  className="flex-1 text-[#191d23] text-[16px] placeholder:text-[#64748b] bg-transparent border-0 p-0 m-0 outline-none"
                />
              ) : (
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => onPhoneChange(event.target.value)}
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                  className="flex-1 text-[#191d23] text-[16px] placeholder:text-[#64748b] bg-transparent border-0 p-0 m-0 outline-none"
                />
              )}
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[16px] text-black">Password</label>
            <div className="border border-[#bfc4cb] rounded-[8px] p-[16px] flex items-center gap-[10px] bg-white">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="flex-1 text-[#191d23] text-[16px] placeholder:text-[#64748b] bg-transparent border-0 p-0 m-0 outline-none"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="w-5 h-5 text-[#64748b]" /> : <Eye className="w-5 h-5 text-[#64748b]" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-[8px] bg-[#fff1ee] px-3 py-2 text-[14px] font-medium text-[#d92d20]" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-[16px] p-[16px] text-[16px] font-semibold transition-colors duration-200 flex items-center justify-center gap-2 bg-[#004aad] text-white hover:bg-[#003a8c] shadow-md"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export function SessionLoadingScreen({ email }: { email: string }) {
  return (
    <div
      className="min-h-screen bg-[#f6f6f9] flex items-center justify-center p-4"
      style={{ fontFamily: "var(--font-dm-sans)" }}
    >
      <section className="bg-white rounded-[18px] border border-[#e6ebf2] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 max-w-[460px] w-full flex flex-col items-center gap-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#eef5ff] text-[#004aad]">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#64748b]">Resolving account</p>
          <h1 className="text-[22px] font-bold text-[#0f172a]">Preparing your workspace</h1>
          <p className="text-[14px] text-[#64748b]">
            Checking business membership, branch access, and role visibility for {email}.
          </p>
        </div>
      </section>
    </div>
  );
}

export function AccessBlockedScreen({ email, reason, onBackToSignIn }: { email: string; reason?: string; onBackToSignIn: () => void }) {
  return (
    <div
      className="min-h-screen bg-[#f6f6f9] flex items-center justify-center p-4"
      style={{ fontFamily: "var(--font-dm-sans)" }}
    >
      <section className="bg-white rounded-[18px] border border-[#e6ebf2] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 max-w-[480px] w-full flex flex-col gap-5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#fff1ee] px-2.5 py-1 text-xs font-semibold text-[#d92d20]">
          Access blocked
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-bold text-[#0f172a]">We couldn't open your workspace</h1>
          <p className="text-[14px] text-[#64748b]">
            {email ? `${email} signed in successfully, but ` : ""}
            {reason ?? "this account is not attached to an active Fahampesa business workspace."}
          </p>
        </div>
        <div className="rounded-[12px] border border-[#fed7aa] bg-[#fff7ed] p-3 text-[13px] text-[#9a3412]">
          Business data stays hidden until membership and access checks pass.
        </div>
        <button
          type="button"
          onClick={onBackToSignIn}
          className="dashboard-action-secondary self-start"
        >
          Back to sign in
        </button>
      </section>
    </div>
  );
}
