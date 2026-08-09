import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { Button } from "./components/Button";

const inputClasses =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function AuthScreen() {
    const { login, register } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (mode === "login") await login(email, password);
            else await register(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Что-то пошло не так");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">Weather Verify</h1>
                <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Вход" : "Регистрация"}</p>

                <form className="mt-6 space-y-3" onSubmit={onSubmit}>
                    <div>
                        <label htmlFor="email" className="sr-only">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email" placeholder="email" value={email}
                            onChange={(e) => setEmail(e.target.value)} required
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password" placeholder="пароль" value={password}
                            onChange={(e) => setPassword(e.target.value)} required
                            minLength={mode === "register" ? 8 : undefined}
                            className={inputClasses}
                        />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full">
                        {busy ? "…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
                    </Button>
                </form>

                {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

                <p className="mt-4 text-xs text-slate-500">
                    {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                    <button
                        type="button"
                        className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                    >
                        {mode === "login" ? "Регистрация" : "Вход"}
                    </button>
                </p>
            </div>
        </main>
    );
}