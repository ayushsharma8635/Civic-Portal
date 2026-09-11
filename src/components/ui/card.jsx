import * as React from "react"

import { cn } from "@/lib/utils"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const Card = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-2xl bg-card text-card-foreground shadow-sm border border-transparent", className)}
    {...props}
  >
    {children}
  </div>
))
Card.displayName = "Card"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const CardHeader = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  >
    {children}
  </div>
))
CardHeader.displayName = "CardHeader"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const CardTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-heading font-bold leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </div>
))
CardTitle.displayName = "CardTitle"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const CardDescription = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  >
    {children}
  </div>
))
CardDescription.displayName = "CardDescription"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const CardContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
))
CardContent.displayName = "CardContent"

/** @type {React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement>>} */
const CardFooter = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  >
    {children}
  </div>
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }