import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { Button } from "./components/Button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, RegisterSchema, type LoginInput } from "@weather-verify/shared";

const inputClasses =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function AuthScreen() {
    const { login, register: signUp } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, isValid},
    } = useForm<LoginInput>({
        resolver: zodResolver(mode === 'register'? RegisterSchema : LoginSchema),
        mode: "onChange",
    })

    async function onSubmit(data: LoginInput) {
        setError(null);
        setBusy(true);
        try {
            if (mode === "login") await login(data.email, data.password);
            else await signUp(data.email, data.password);
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

                <form className="mt-6 space-y-3" onSubmit={handleSubmit(onSubmit)}>
                    <div>
                        <label htmlFor="email" className="sr-only">
                            Email
                        </label>
                        <input
                            id="email"
                            type="text" placeholder="email" 
                            {...register("email")}
                            className={inputClasses}
                        />
                        {errors.email?.message && (
                            <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">
                            Пароль
                        </label>
                        <input
                            id="password"
                            type="password" placeholder="пароль" 
                            {...register("password")}
                            className={inputClasses}
                        />
                        {errors.password?.message && (
                            <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
                        )}
                    </div>
                    <Button type="submit" disabled={busy || !isValid} className="w-full">
                        {busy ? "…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
                    </Button>
                </form>

                {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

                <p className="mt-4 text-xs text-slate-500">
                    {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                    <button
                        type="button"
                        className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                        onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); reset()}}
                    >
                        {mode === "login" ? "Регистрация" : "Вход"}
                    </button>
                </p>
            </div>
        </main>
    );
}