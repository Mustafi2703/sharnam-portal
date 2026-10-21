import { resultCode, type QualityResultCode } from "./qualityIr.js";

export type QapIrSnap = {
  id: string;
  previousIrId?: string | null;
  result?: string | null;
  status?: string | null;
  createdAt?: string | null;
  source?: string | null;
  final?: boolean;
};

export type QapStatusName =
  | "Not started"
  | "In progress"
  | "Completed"
  | "Rejected - re-offer"
  | "Overdue"
  | "Awaiting client";

function rootId(ir: QapIrSnap, byId: Map<string, QapIrSnap>, seen = new Set<string>()): string {
  if (seen.has(ir.id)) return ir.id;
  seen.add(ir.id);
  const prev = ir.previousIrId ? byId.get(ir.previousIrId) : undefined;
  if (prev) return rootId(prev, byId, seen);
  return ir.id;
}

/** Re-offer chains count as one occurrence. Each chain is ordered oldest to newest. */
export function irChains(irs: QapIrSnap[]): QapIrSnap[][] {
  const byId = new Map(irs.map((ir) => [ir.id, ir]));
  const groups = new Map<string, QapIrSnap[]>();
  for (const ir of irs) {
    const key = rootId(ir, byId);
    const list = groups.get(key) || [];
    list.push(ir);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) =>
    list.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
  );
}

function codeOf(ir: QapIrSnap): QualityResultCode | null {
  return resultCode(ir.result);
}

function chainClosedOk(chain: QapIrSnap[]): boolean {
  const tail = chain[chain.length - 1];
  if (!tail) return false;
  const code = codeOf(tail);
  if (code === "A" && tail.final !== false && !/awaiting/i.test(tail.status || "")) return true;
  if (code === "B" && /approved$/i.test(tail.status || "") && !/observation/i.test(tail.status || "")) return true;
  if (tail.final === true) return true;
  return false;
}

function chainOpenReject(chain: QapIrSnap[]): boolean {
  const tail = chain[chain.length - 1];
  return codeOf(tail) === "C";
}

/**
 * Status of one QAP line from its IRs.
 * due null = manual / per element (no automatic count).
 * weekEnded + raised < due => Overdue.
 */
export function qapLineStatus(input: {
  isHeader?: boolean;
  due: number | null;
  weekEnded?: boolean;
  irs: QapIrSnap[];
}): QapStatusName | "" {
  if (input.isHeader) return "";
  const chains = irChains(input.irs);
  if (chains.some(chainOpenReject)) return "Rejected - re-offer";
  const raised = chains.length;
  if (input.due != null && input.weekEnded && raised < input.due) return "Overdue";
  if (chains.some((c) => /awaiting client/i.test(c[c.length - 1]?.status || ""))) {
    if (!chains.some(chainClosedOk) || (input.due != null && chains.filter(chainClosedOk).length < input.due)) {
      return "Awaiting client";
    }
  }
  const approved = chains.filter(chainClosedOk).length;
  const target = input.due == null ? (raised > 0 ? raised : 0) : input.due;
  if (raised === 0 && (input.due == null || input.due === 0)) return "Not started";
  if (raised === 0) return "Not started";
  if (target > 0 && approved >= target && chains.every((c) => chainClosedOk(c) || codeOf(c[c.length - 1]) === "D")) {
    return "Completed";
  }
  if (input.due == null && chains.length > 0 && chains.every(chainClosedOk)) return "Completed";
  if (approved > 0 && input.due != null && approved >= input.due) return "Completed";
  return "In progress";
}

export function signoffFlags(latest: { verified?: boolean; result?: string | null; clientSigned?: boolean } | null): {
  contractorOk: boolean;
  pmcOk: boolean;
  clientOk: boolean;
} {
  if (!latest) return { contractorOk: false, pmcOk: false, clientOk: false };
  return {
    contractorOk: !!latest.verified,
    pmcOk: !!resultCode(latest.result),
    clientOk: !!latest.clientSigned,
  };
}
