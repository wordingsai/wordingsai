import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { user, member } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const targetEmail = "muhammadhamzasheikh02@gmail.com";
  console.log("Finding user...", targetEmail);
  const foundUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, targetEmail));
  if (!foundUsers.length) {
    return NextResponse.json({ error: "User not found" });
  }
  const u = foundUsers[0];
  console.log("User found:", u.id);

  await db.update(user).set({ role: "psa" }).where(eq(user.id, u.id));

  const members = await db.select().from(member).where(eq(member.userId, u.id));
  for (const m of members) {
    await db.update(member).set({ role: "psa" }).where(eq(member.id, m.id));
  }

  return NextResponse.json({
    success: true,
    userId: u.id,
    membersUpdated: members.length,
  });
}
