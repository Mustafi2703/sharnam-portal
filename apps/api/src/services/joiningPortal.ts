/**
 * HR pre-joining helpers — appointment-letter gates and offer access for HR staff.
 * Candidate self-service / new-joiner portal login has been removed.
 */
import type { PreJoiningChecklist } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { AuthUser } from "@sharnam/shared";

/** Steps 1–4 + IT / email / ID before HR generates the appointment letter. */
export function isPreJoinReadyForAppointmentLetter(preJoin: PreJoiningChecklist | null | undefined) {
  if (!preJoin) return false;
  return [
    preJoin.docCollectionDone,
    preJoin.bgvStatus === "Cleared",
    preJoin.medicalStatus === "Cleared" || preJoin.medicalStatus === "Not-Applicable",
    !!preJoin.empCodeGenerated,
    preJoin.itAssetRequested,
    preJoin.emailCreated,
    preJoin.idCardRequested,
  ].every(Boolean);
}

/** Full section 2 complete — opens Day 1 onboarding (section 3). Welcome kit follows appointment letter. */
export function isPreJoinComplete(preJoin: PreJoiningChecklist | null | undefined) {
  if (!preJoin) return false;
  return (
    isPreJoinReadyForAppointmentLetter(preJoin) &&
    !!preJoin.appointmentLetterUrl &&
    preJoin.welcomeKitPrepared
  );
}

export async function findActiveJoiningForUser(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const offer = await prisma.offer.findFirst({
    where: {
      status: { in: ["Accepted", "Joined"] },
      OR: [{ onboard: { userId } }, { candidate: { email: normalized } }],
    },
    include: { preJoin: true, onboard: true, candidate: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!offer) return null;
  if (offer.status === "Joined" && isPreJoinComplete(offer.preJoin) && offer.onboard?.hrPolicyAcknowledged) {
    return null;
  }
  return offer;
}

export async function joiningOfferIdForUser(userId: string, email: string) {
  const row = await findActiveJoiningForUser(userId, email);
  return row?.id ?? null;
}

export function isHrOfferManager(user: Pick<AuthUser, "role">) {
  return user.role === "admin" || user.role === "office" || user.role === "hr";
}

export async function canAccessOffer(user: Pick<AuthUser, "id" | "email" | "role">, offerId: string) {
  if (isHrOfferManager(user)) return true;
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { candidate: true, onboard: true },
  });
  if (!offer) return false;
  if (offer.onboard?.userId === user.id) return true;
  return offer.candidate.email?.trim().toLowerCase() === user.email.trim().toLowerCase();
}

/** Retired — HR desk runs pre-joining; no candidate portal login is provisioned. */
export async function provisionJoiningPortalLogin(_offerId: string) {
  return null;
}

const HR_PREJOIN_KEYS = new Set([
  "bgvStatus",
  "medicalStatus",
  "empCodeGenerated",
  "appointmentLetterUrl",
  "emailCreated",
  "emailAddress",
  "welcomeKitPrepared",
  "notes",
]);

const CANDIDATE_PREJOIN_KEYS = new Set(["docCollectionDone", "itAssetRequested", "idCardRequested"]);

export function splitPreJoinPatch(body: Record<string, unknown>, asHr: boolean) {
  const allowed = asHr ? null : CANDIDATE_PREJOIN_KEYS;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    if (allowed && !allowed.has(k)) continue;
    if (!asHr && HR_PREJOIN_KEYS.has(k)) continue;
    patch[k] = v;
  }
  return patch;
}
