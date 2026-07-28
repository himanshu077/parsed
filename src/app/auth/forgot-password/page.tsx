"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { MailQuestion } from "lucide-react";
import { z } from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardHeader } from "@/components/auth/AuthCardHeader";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ControlledInput } from "@/components/form/ControlledInput";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  // Password reset is delivered by email in production. During the demo no mail
  // service is configured, so we show guidance instead of attempting to send.
  const onSubmit = async () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthCardHeader
            title="Password reset"
            description="Reset links are sent by email in the full version."
          />
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <MailQuestion className="size-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                For this demo, email delivery isn&apos;t enabled. Please contact
                the administrator to reset your password.
              </p>
              <a
                href="/auth/sign-in"
                className="text-sm underline underline-offset-4"
              >
                Back to sign in
              </a>
            </div>
          </CardContent>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthCardHeader
          title="Forgot password"
          description="Enter your email and we'll send you a reset link"
        />
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <ControlledInput
              name="email"
              label="Email"
              control={control}
              placeholder="you@example.com"
              type="email"
              error={errors.email}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <a href="/auth/sign-in" className="underline underline-offset-4">
              Back to sign in
            </a>
          </div>
        </CardContent>
      </AuthCard>
    </AuthLayout>
  );
}
