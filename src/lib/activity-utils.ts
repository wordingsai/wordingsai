import { db } from "@/db/drizzle";
import { activityLog, notifications } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Log a user activity
 */
export async function logActivity(params: {
  userId: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  metadata?: any;
}) {
  try {
    await db.insert(activityLog).values({
      userId: params.userId,
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("[logActivity] Failed:", error);
  }
}

/**
 * Create a notification
 */
export async function createNotification(params: {
  userId?: string;
  organizationId?: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "error";
  isGlobal?: boolean;
  link?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      organizationId: params.organizationId,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      isGlobal: params.isGlobal || false,
      link: params.link,
    });
  } catch (error) {
    console.error("[createNotification] Failed:", error);
  }
}
