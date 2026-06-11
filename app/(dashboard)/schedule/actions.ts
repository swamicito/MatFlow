"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClassRow = {
  id: string;
  gym_id: string;
  title: string;
  instructor_name: string;
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  capacity: number;
  is_recurring: boolean;
  created_at: string;
  booking_count: number;
};

export type ClassFormData = {
  title: string;
  instructor_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_recurring: boolean;
};

export type BookingRow = {
  id: string;
  class_id: string;
  student_id: string;
  status: string;
  created_at: string;
};

export type ClassWithBooking = ClassRow & { is_booked: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// Owner – list all classes for a gym with live booking counts
// ─────────────────────────────────────────────────────────────────────────────

export async function listClasses(gymId: string): Promise<ClassRow[]> {
  const admin = createAdminClient() as any;

  const { data: rows } = await admin
    .from("classes")
    .select("id, gym_id, title, instructor_name, day_of_week, start_time, end_time, capacity, is_recurring, created_at")
    .eq("gym_id", gymId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!rows || rows.length === 0) return [];

  // Fetch confirmed booking counts per class
  const classIds = rows.map((r: any) => r.id);
  const { data: counts } = await admin
    .from("class_bookings")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "confirmed");

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.class_id] = (countMap[row.class_id] ?? 0) + 1;
  }

  return rows.map((r: any) => ({
    ...r,
    booking_count: countMap[r.id] ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – create a class
// ─────────────────────────────────────────────────────────────────────────────

export async function createClass(
  gymId: string,
  data: ClassFormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!data.title.trim()) return { ok: false, error: "Title is required." };
  if (data.start_time >= data.end_time) return { ok: false, error: "End time must be after start time." };

  const admin = createAdminClient() as any;
  const { data: row, error } = await admin
    .from("classes")
    .insert({
      gym_id: gymId,
      title: data.title.trim(),
      instructor_name: data.instructor_name.trim(),
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      capacity: data.capacity,
      is_recurring: data.is_recurring,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/schedule");
  return { ok: true, id: row.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – update a class
// ─────────────────────────────────────────────────────────────────────────────

export async function updateClass(
  classId: string,
  gymId: string,
  data: ClassFormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!data.title.trim()) return { ok: false, error: "Title is required." };
  if (data.start_time >= data.end_time) return { ok: false, error: "End time must be after start time." };

  const admin = createAdminClient() as any;
  const { error } = await admin
    .from("classes")
    .update({
      title: data.title.trim(),
      instructor_name: data.instructor_name.trim(),
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      capacity: data.capacity,
      is_recurring: data.is_recurring,
    })
    .eq("id", classId)
    .eq("gym_id", gymId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – delete a class
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteClass(
  classId: string,
  gymId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient() as any;
  const { error } = await admin
    .from("classes")
    .delete()
    .eq("id", classId)
    .eq("gym_id", gymId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – list all classes for a gym with booking status
// ─────────────────────────────────────────────────────────────────────────────

export async function listClassesForStudent(
  gymId: string,
  studentId: string,
): Promise<ClassWithBooking[]> {
  const admin = createAdminClient() as any;

  const { data: rows } = await admin
    .from("classes")
    .select("id, gym_id, title, instructor_name, day_of_week, start_time, end_time, capacity, is_recurring, created_at")
    .eq("gym_id", gymId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const classIds = rows.map((r: any) => r.id);

  const [{ data: counts }, { data: myBookings }] = await Promise.all([
    admin
      .from("class_bookings")
      .select("class_id")
      .in("class_id", classIds)
      .eq("status", "confirmed"),
    admin
      .from("class_bookings")
      .select("class_id")
      .in("class_id", classIds)
      .eq("student_id", studentId)
      .eq("status", "confirmed"),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.class_id] = (countMap[row.class_id] ?? 0) + 1;
  }

  const bookedSet = new Set((myBookings ?? []).map((r: any) => r.class_id));

  return rows.map((r: any) => ({
    ...r,
    booking_count: countMap[r.id] ?? 0,
    is_booked: bookedSet.has(r.id),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – get student's own bookings (for "My Bookings" section)
// ─────────────────────────────────────────────────────────────────────────────

export async function listMyBookings(
  studentId: string,
  gymId: string,
): Promise<ClassRow[]> {
  const admin = createAdminClient() as any;

  const { data: bookings } = await admin
    .from("class_bookings")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("status", "confirmed");

  if (!bookings || bookings.length === 0) return [];

  const classIds = bookings.map((b: any) => b.class_id);

  const { data: rows } = await admin
    .from("classes")
    .select("id, gym_id, title, instructor_name, day_of_week, start_time, end_time, capacity, is_recurring, created_at")
    .in("id", classIds)
    .eq("gym_id", gymId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const { data: counts } = await admin
    .from("class_bookings")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "confirmed");

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.class_id] = (countMap[row.class_id] ?? 0) + 1;
  }

  return rows.map((r: any) => ({ ...r, booking_count: countMap[r.id] ?? 0 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – book a class
// ─────────────────────────────────────────────────────────────────────────────

export async function bookClass(
  classId: string,
  studentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient() as any;

  // Check current booking count vs capacity
  const { data: cls } = await admin
    .from("classes")
    .select("capacity")
    .eq("id", classId)
    .maybeSingle();

  if (!cls) return { ok: false, error: "Class not found." };

  const { count } = await admin
    .from("class_bookings")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("status", "confirmed");

  if ((count ?? 0) >= cls.capacity) return { ok: false, error: "This class is full." };

  // Upsert (handles re-booking after cancellation)
  const { error } = await admin
    .from("class_bookings")
    .upsert(
      { class_id: classId, student_id: studentId, status: "confirmed" },
      { onConflict: "class_id,student_id" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/schedule");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – cancel a booking
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelBooking(
  classId: string,
  studentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient() as any;
  const { error } = await admin
    .from("class_bookings")
    .update({ status: "cancelled" })
    .eq("class_id", classId)
    .eq("student_id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/schedule");
  return { ok: true };
}
