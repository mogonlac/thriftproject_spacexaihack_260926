import type { Metadata } from "next";
import { StaffApp } from "@/components/staff/StaffApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff — till" };

export default function StaffPage() {
  return <StaffApp pinRequired={Boolean(process.env.STAFF_PIN)} />;
}
