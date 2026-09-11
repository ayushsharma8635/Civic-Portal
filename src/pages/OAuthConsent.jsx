import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

export default function OAuthConsent() {
  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Application Connected"
      subtitle="Smart Complaint Management System"
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Your account is authenticated with the Civic Redressal Portal.
        </p>
        <Link to="/">
          <Button className="w-full">Go to Dashboard</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
