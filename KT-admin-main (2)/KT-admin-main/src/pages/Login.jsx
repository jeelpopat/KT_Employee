import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";

function Login({ setIsAuthenticated }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const response = await fetch(
        "https://kt-backend-1.onrender.com/api/users/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("isAuthenticated", "true");

      setIsAuthenticated(true);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.log(error);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 antialiased">
      <div className="w-full max-w-sm rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs animate-fade-in">
        <div className="mb-5 text-center flex flex-col items-center">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            Welcome Back
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Sign in to access your admin workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@kevalon.com"
            leftIcon={Mail}
            required
          />

          <div>
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={Lock}
              required
            />
            <div className="flex justify-end mt-1.5">
              <Link
                to="/forgot-password"
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/60 text-xs font-medium text-rose-600 text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            isLoading={loading}
            className="w-full py-2 text-xs font-semibold"
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Kevalon Technology © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;