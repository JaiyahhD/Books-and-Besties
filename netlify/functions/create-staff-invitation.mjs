import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const url = process.env.SUPABASE_URL;
    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Server configuration incomplete." }, 500);
    }

    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return json({ error: "Origin not allowed." }, 403);
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Authentication required." }, 401);
    }

    const accessToken = authorization.slice(7).trim();

    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const {
      data: { user },
      error: authError
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return json({ error: "Invalid session." }, 401);
    }

    // Run authorization using the caller's JWT.
    const callerClient = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: isAdmin, error: adminError } =
      await callerClient.rpc("is_campus_admin");

    if (adminError || isAdmin !== true) {
      return json({ error: "Administrator access required." }, 403);
    }

    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const role = String(body.role || "")
      .trim()
      .toLowerCase();

    if (
      email.length < 3 ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (!["admin", "moderator"].includes(role)) {
      return json({ error: "Invalid staff role." }, 400);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Do not issue another active invitation for this email.
    const { data: existing, error: existingError } =
      await adminClient
        .from("campus_staff_invitations")
        .select("id, expires_at")
        .eq("email", email)
        .eq("status", "pending");

    if (existingError) {
      throw existingError;
    }

    const now = new Date();

    const activeInvitation = (existing || []).find(
      invitation =>
        new Date(invitation.expires_at) > now
    );

    if (activeInvitation) {
      return json(
        { error: "An active invitation already exists for this email." },
        409
      );
    }

    // Expire old pending invitations before creating a new one.
    for (const invitation of existing || []) {
      const { error: expireError } = await adminClient
        .from("campus_staff_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id)
        .eq("status", "pending");

      if (expireError) throw expireError;

      const { error: auditError } = await adminClient
        .from("campus_staff_audit_log")
        .insert({
          actor_user_id: user.id,
          invitation_id: invitation.id,
          action: "invitation_expired",
          details: { email }
        });

      if (auditError) throw auditError;
    }

    // 256-bit cryptographically secure invitation token.
    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 72 * 60 * 60 * 1000
    ).toISOString();

    const { data: invitation, error: inviteError } =
      await adminClient
        .from("campus_staff_invitations")
        .insert({
          email,
          role,
          token_hash: tokenHash,
          status: "pending",
          invited_by: user.id,
          expires_at: expiresAt
        })
        .select("id, email, role, expires_at")
        .single();

    if (inviteError) {
      if (inviteError.code === "23505") {
        return json(
          { error: "An invitation already exists for this email." },
          409
        );
      }

      throw inviteError;
    }

    const { error: auditError } = await adminClient
      .from("campus_staff_audit_log")
      .insert({
        actor_user_id: user.id,
        invitation_id: invitation.id,
        action: "invitation_created",
        details: { email, role }
      });

    if (auditError) {
      // Avoid leaving an unaudited invitation behind.
      await adminClient
        .from("campus_staff_invitations")
        .update({
          status: "revoked",
          revoked_by: user.id,
          revoked_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      throw auditError;
    }

    // Email delivery will be connected in Phase 9.5D.
    // Do not return the raw token to browser clients.
    // Once email delivery is implemented, the token will
    // be passed directly to the email provider server-side.

    return json(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expires_at: invitation.expires_at
        },
        delivery_status: "not_configured",
        message:
          "Invitation record created. Email delivery is not configured yet."
      },
      201
    );

  } catch (error) {
    console.error("Staff invitation error:", error);

    return json(
      { error: "Unable to create staff invitation." },
      500
    );
  }
}