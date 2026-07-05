import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface User {
    id: string;
    email: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // На старте спрашиваем сервер «кто я» — если cookie валидна, вернёт юзера.
    useEffect(() => {
        api("/api/auth/me")
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    async function login(email: string, password: string) {
        const res = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Не удалось войти");
        }
        const data = await res.json();
        setUser(data.user);
    }

    async function register(email: string, password: string) {
        const res = await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Не удалось зарегистрироваться");
        }
        // register не выдаёт cookie — сразу логинимся тем же паролем.
        await login(email, password);
    }

    async function logout() {
        await api("/api/auth/logout", { method: "POST" });
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}