import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

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
        <main className="shell">
            <h1>Weather Verify</h1>
            <p className="sub">{mode === "login" ? "Вход" : "Регистрация"}</p>

            <form className="auth-form" onSubmit={onSubmit}>
                <input
                    type="email" placeholder="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                />
                <input
                    type="password" placeholder="пароль" value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    minLength={mode === "register" ? 8 : undefined}
                />
                <button type="submit" disabled={busy}>
                    {busy ? "…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
                </button>
            </form>

            {error && <div className="card err">{error}</div>}

            <p className="muted">
                {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                <button
                    type="button" className="link"
                    onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                >
                    {mode === "login" ? "Регистрация" : "Вход"}
                </button>
            </p>
        </main>
    );
}