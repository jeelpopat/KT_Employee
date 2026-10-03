import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, CheckCircle2, AlertCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";

import api from "../api/axios";

function ResetPassword({ onBackToLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || new URLSearchParams(window.location.search).get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please check your email link.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.put("/api/users/reset-password", {
        token,
        newPassword,
      });

      if (response.data?.success !== false) {
        setSuccess(true);
      } else {
        setError(response.data?.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      const msg = err.response?.data?.message || err.response?.data?.error || "Network error. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 antialiased">
      <div className="w-full max-w-sm rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs animate-fade-in">
        
        {/* Header Icon & Title */}
        <div className="mb-5 text-center flex flex-col items-center">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
            {success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <KeyRound className="h-5 w-5" />
            )}
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {success ? "Password Reset Successful" : "Reset Your Password"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {success
              ? "Your password has been updated in the database."
              : "Enter your new password below to reset access."}
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-xs font-medium text-emerald-700 text-center">
              Password has been reset successfully! You can now log in with your new credentials.
            </div>

            <Button
              type="button"
              onClick={() => onBackToLogin ? onBackToLogin() : (window.location.href = "/")}
              className="w-full py-2 text-xs font-semibold cursor-pointer"
            >
              Go to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* New Password */}
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={Lock}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <Eye className="w-3.5 h-3.5 text-indigo-600" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={Lock}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPassword ? <Eye className="w-3.5 h-3.5 text-indigo-600" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/60 text-xs font-medium text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              isDisabled={!token}
              className="w-full py-2 text-xs font-semibold cursor-pointer"
            >
              {loading ? "Updating Password..." : "Submit New Password"}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => onBackToLogin ? onBackToLogin() : (window.location.href = "/")}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Kevalon Technology © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
