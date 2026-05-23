import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  GCP_PROJECT_NUMBER,
  GCP_SERVICE_ACCOUNT_EMAIL,
  gcpAuthClient,
  GCP_WORKLOAD_IDENTITY_POOL_ID,
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
} from "@/lib/gcp/auth";
import { vertex } from "@/lib/gcp/vertex";
import { generateText } from "ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
    },
    config: {
      projectNumberExists: !!GCP_PROJECT_NUMBER,
      projectNumberIsNumeric: GCP_PROJECT_NUMBER
        ? /^\d+$/.test(GCP_PROJECT_NUMBER)
        : false,
      serviceAccountEmail: GCP_SERVICE_ACCOUNT_EMAIL,
      poolId: GCP_WORKLOAD_IDENTITY_POOL_ID,
      providerId: GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
      isAuthClientInitialized: !!gcpAuthClient,
    },
    steps: {},
  };

  try {
    // Step 1: Try to get Vercel OIDC Token
    debugInfo.steps.oidcToken = { status: "pending" };
    try {
      const token = await getVercelOidcToken();
      debugInfo.steps.oidcToken = {
        status: "success",
        tokenPresent: !!token,
        tokenLength: token?.length,
        tokenPrefix: token ? `${token.substring(0, 10)}...` : null,
      };
    } catch (err: any) {
      debugInfo.steps.oidcToken = {
        status: "failed",
        error: err.message || String(err),
      };
    }

    // Step 2: Try to exchange token with GCP (Handshake Check)
    debugInfo.steps.gcpHandshake = { status: "pending" };
    if (gcpAuthClient) {
      try {
        const accessToken = await gcpAuthClient.getAccessToken();
        debugInfo.steps.gcpHandshake = {
          status: "success",
          tokenType: accessToken.res?.data?.token_type || "unknown",
          expiresIn: accessToken.res?.data?.expires_in,
        };
      } catch (err: any) {
        debugInfo.steps.gcpHandshake = {
          status: "failed",
          error: err.message || String(err),
          hint: "If this fails with 403, check IAM roles (Service Account Token Creator) and Audience config.",
        };
      }
    } else {
      debugInfo.steps.gcpHandshake = {
        status: "skipped",
        reason: "Auth client not initialized",
      };
    }

    // Step 3: End-to-End Vertex AI Test
    debugInfo.steps.vertexTest = { status: "pending" };
    try {
      const { text } = await generateText({
        model: vertex("gemini-2.5-flash"),
        prompt: "Say 'OIDC Success' if you can read this.",
      });
      debugInfo.steps.vertexTest = {
        status: "success",
        response: text.trim(),
      };
    } catch (err: any) {
      debugInfo.steps.vertexTest = {
        status: "failed",
        error: err.message || String(err),
      };
    }

    return NextResponse.json(debugInfo);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Unhandled error during debug",
        message: err.message,
        debugInfo,
      },
      { status: 500 },
    );
  }
}
