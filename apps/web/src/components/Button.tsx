import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
};

const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
    return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
