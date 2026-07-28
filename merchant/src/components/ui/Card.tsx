import { cn } from "@/lib/utils";
import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white overflow-hidden rounded-2xl border border-border shadow-sm",
        className
      )}
      {...props}
    />
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return <div className={cn("px-5 py-4 sm:px-6", className)} {...props} />;
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3 className={cn("text-lg leading-6 font-semibold text-foreground", className)} {...props} />
  );
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn("px-5 py-5 sm:p-6", className)} {...props} />;
}
