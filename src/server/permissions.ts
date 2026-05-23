import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { psa, su, u } from "@/lib/auth/permissions";

export { psa, su, u };

export const isAdmin = async () => {
  try {
    const { success, error } = await auth.api.hasPermission({
      headers: await headers(),
      body: {
        permissions: {
          organization: ["update", "delete"],
        },
      },
    });

    if (error) {
      console.error("Permission check error:", error);
      return false;
    }

    return !!success;
  } catch (error) {
    console.error("isAdmin catch error:", error);
    return false;
  }
};
