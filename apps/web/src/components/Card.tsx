import type { ReactNode } from "react";

type CardProps = {
    title?: string;
    description?: string;
    children: ReactNode;
    className?: string;
};

export function Card({ title, description, children, className = "" }: CardProps) {
    return (
        <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            <div className={title || description ? "mt-4" : ""}>{children}</div>
        </div>
    );
}
