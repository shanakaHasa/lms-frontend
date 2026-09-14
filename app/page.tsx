"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

/** Nothing lives at the root — it only decides where you belong. */
export default function Home() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(session ? "/students" : "/login");
  }, [session, router]);

  return null;
}
