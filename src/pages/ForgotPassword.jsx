import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const API_BASE =
        process.env.REACT_APP_API_BASE_URL ||
        (window.location.hostname === "localhost"
          ? "http://localhost:5000"
          : "https://kt-backend-1.onrender.com");

      const response = await fetch(`${API_BASE}/api/users/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to send password reset link.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
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
            Forgot Password
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {success
              ? "Check your email for the password reset link."
              : "Enter your registered email to receive a password reset link."}
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-xs font-medium text-emerald-700 text-center">
              We've sent a password reset link to <b>{email}</b>. Please check your inbox (and Spam folder) to reset your password.
            </div>

            <Link to="/login">
              <Button type="button" className="w-full py-2 text-xs font-semibold">
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Registered Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              leftIcon={Mail}
              required
            />

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/60 text-xs font-medium text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              className="w-full py-2 text-xs font-semibold"
            >
              {loading ? "Sending Link..." : "Send Reset Link"}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Back to Login
              </Link>
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

export default ForgotPassword;
