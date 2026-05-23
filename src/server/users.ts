"use server";

import { eq, inArray, not } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/drizzle";
import { member, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

export const uploadAvatar = async (formData: FormData) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  // Get current user to check for old avatar
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  // Delete old avatar if it exists
  if (currentUser?.image && currentUser.image.includes("/avatars/")) {
    const oldPath = currentUser.image.split("/avatars/").pop();
    if (oldPath) {
      await supabaseServer.storage.from("avatars").remove([oldPath]);
    }
  }

  // Upload new avatar
  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `${session.user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = fileName; // Store directly in bucket root

  const { data, error } = await supabaseServer.storage
    .from("avatars")
    .upload(filePath, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("avatars").getPublicUrl(filePath);

  // Update database
  await db
    .update(user)
    .set({ image: publicUrl })
    .where(eq(user.id, session.user.id));

  return publicUrl;
};

export const deleteAvatarAction = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (currentUser?.image && currentUser.image.includes("/avatars/")) {
    const oldPath = currentUser.image.split("/avatars/").pop();
    if (oldPath) {
      await supabaseServer.storage.from("avatars").remove([oldPath]);
    }
  }

  await db
    .update(user)
    .set({ image: null })
    .where(eq(user.id, session.user.id));
  return true;
};

export const getCurrentUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!currentUser) {
    redirect("/login");
  }

  return {
    ...session,
    currentUser,
  };
};

export const signIn = async (email: string, password: string) => {
  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    const e = error as Error;

    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};

export const signUp = async (
  email: string,
  password: string,
  username: string,
) => {
  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: username,
      },
    });

    return {
      success: true,
      message: "Signed up successfully.",
    };
  } catch (error) {
    const e = error as Error;

    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};

export const getUsers = async (organizationId: string) => {
  try {
    const members = await db.query.member.findMany({
      where: eq(member.organizationId, organizationId),
    });

    const users = await db.query.user.findMany({
      where: not(
        inArray(
          user.id,
          members.map((m) => m.userId),
        ),
      ),
    });

    return users;
  } catch (error) {
    console.error(error);
    return [];
  }
};
export const resendVerification = async (email: string) => {
  try {
    await auth.api.sendVerificationEmail({
      body: {
        email,
      },
    });

    return {
      success: true,
      message: "Verification email resent successfully.",
    };
  } catch (error) {
    const e = error as Error;

    return {
      success: false,
      message: e.message || "An unknown error occurred.",
    };
  }
};
