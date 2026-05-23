import { db } from "@/db/drizzle";
import { user, member } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const targetEmail = "muhammadhamzasheikh02@gmail.com";
  console.log("Finding user...", targetEmail);
  const foundUsers = await db
    .select()
    .from(user)
    .where(eq(user.email, targetEmail));
  if (!foundUsers.length) {
    console.error("User not found");
    process.exit(1);
  }
  const u = foundUsers[0];
  console.log("User found:", u.id);

  await db.update(user).set({ role: "psa" }).where(eq(user.id, u.id));
  console.log("User role updated to psa");

  const members = await db.select().from(member).where(eq(member.userId, u.id));
  for (const m of members) {
    await db.update(member).set({ role: "psa" }).where(eq(member.id, m.id));
    console.log("Member role updated to psa for org:", m.organizationId);
  }
  console.log("Done");
}
main().catch(console.error);
