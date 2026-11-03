"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { seedSimulatedCircle, startLiveCircle } from "@/services/demo-seed";

export async function loadDemoCircle() {
  let id: string;
  try {
    id = await seedSimulatedCircle(db);
  } catch (err) {
    redirect(`/judge?error=${encodeURIComponent((err as Error).message.slice(0, 200))}`);
  }
  redirect(`/circles/${id}`);
}

export async function startLive() {
  let id: string;
  try {
    id = await startLiveCircle(db);
  } catch (err) {
    redirect(`/judge?error=${encodeURIComponent((err as Error).message.slice(0, 200))}`);
  }
  redirect(`/circles/${id}`);
}
