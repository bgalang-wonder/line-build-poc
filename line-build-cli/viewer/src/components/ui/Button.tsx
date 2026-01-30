import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className = "", disabled, children, ...props }: ButtonProps) {
  const base = "font-medium rounded-lg transition";
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    secondary: "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
  };
  const disabledStyles = disabled
    ? "opacity-50 cursor-not-allowed hover:bg-inherit"
    : "";
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
