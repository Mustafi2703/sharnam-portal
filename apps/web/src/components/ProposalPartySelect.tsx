import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { SearchableSelect } from "./SearchableSelect";

type ClientRow = {
  id: string;
  name: string;
  email?: string | null;
  primaryContactName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

type LeadRow = {
  id: string;
  title: string;
  contactName?: string | null;
  email?: string | null;
  landmark?: string | null;
  district?: string | null;
  state?: string | null;
  pinCode?: string | null;
  description?: string | null;
};

export type ProposalPartyChange = {
  clientName: string;
  source: "client" | "lead" | "typed";
  clientAddress?: string | null;
  leadId?: string | null;
  scopeHint?: string | null;
};

type Option = {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  kind: "client" | "lead";
  id: string;
  clientName: string;
  address: string;
  scope: string;
};

function joinBits(parts: Array<string | null | undefined>) {
  return parts.map((p) => (p || "").trim()).filter(Boolean).join(", ");
}

/** Searchable client name: directory clients (partyType Client) and CRM leads, or a typed name. */
export function ProposalPartySelect({
  token,
  clientName,
  leadId,
  prefillLead = false,
  onChange,
}: {
  token: string | null;
  clientName: string;
  leadId?: string | null;
  /** When opening from a lead, copy that lead's address and scope once. */
  prefillLead?: boolean;
  onChange: (next: ProposalPartyChange) => void;
}) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [value, setValue] = useState(clientName);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prefilled = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    Promise.all([
      api<ClientRow[]>("/api/vendors?partyType=Client", { token }).catch(() => []),
      api<LeadRow[]>("/api/crm/leads", { token }).catch(() => []),
    ]).then(([clientRows, leadRows]) => {
      if (cancel) return;
      setClients(Array.isArray(clientRows) ? clientRows : []);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
    });
    return () => {
      cancel = true;
    };
  }, [token]);

  const options = useMemo<Option[]>(() => {
    const clientOpts: Option[] = clients
      .filter((c) => c.name?.trim())
      .map((c) => ({
        value: `client:${c.id}`,
        label: c.name.trim(),
        sublabel: ["Client", c.primaryContactName, c.email].filter(Boolean).join(" · "),
        keywords: `${c.name} ${c.primaryContactName || ""} ${c.email || ""} ${c.city || ""}`,
        kind: "client" as const,
        id: c.id,
        clientName: c.name.trim(),
        address: joinBits([c.address, c.city, c.state]),
        scope: "",
      }));
    const leadOpts = leads.flatMap((l) => {
      const name = (l.contactName || l.title || "").trim();
      if (!name) return [];
      const opt: Option = {
        value: `lead:${l.id}`,
        label: name,
        sublabel: ["Lead", l.title && l.title !== name ? l.title : "", l.district, l.state].filter(Boolean).join(" · "),
        keywords: `${name} ${l.title || ""} ${l.contactName || ""} ${l.email || ""} ${l.district || ""}`,
        kind: "lead",
        id: l.id,
        clientName: name,
        address: joinBits([l.landmark, l.district, l.state, l.pinCode]),
        scope: (l.description || "").trim(),
      };
      return [opt];
    });
    return [...clientOpts, ...leadOpts];
  }, [clients, leads]);

  useEffect(() => {
    setValue((cur) => {
      const selected = options.find((o) => o.value === cur);
      if (selected && selected.clientName === clientName) return cur;
      const match =
        (leadId && options.find((o) => o.kind === "lead" && o.id === leadId && o.clientName === clientName)) ||
        options.find((o) => o.clientName === clientName);
      return match?.value || clientName;
    });
  }, [clientName, leadId, options]);

  useEffect(() => {
    if (!prefillLead || !leadId || prefilled.current === leadId) return;
    const lead = options.find((o) => o.kind === "lead" && o.id === leadId);
    if (!lead) return;
    prefilled.current = leadId;
    onChangeRef.current({
      clientName: clientName.trim() || lead.clientName,
      source: "lead",
      clientAddress: lead.address,
      leadId,
      scopeHint: lead.scope || null,
    });
  }, [prefillLead, leadId, options, clientName]);

  return (
    <SearchableSelect
      allowCustom
      options={options}
      value={value}
      placeholder="Client name"
      searchPlaceholder="Search clients and leads…"
      onChange={(next) => {
        const opt = options.find((o) => o.value === next);
        if (!opt) {
          setValue(next);
          onChange({ clientName: next, source: "typed" });
          return;
        }
        setValue(opt.value);
        onChange({
          clientName: opt.clientName,
          source: opt.kind,
          clientAddress: opt.address,
          leadId: opt.kind === "lead" ? opt.id : undefined,
          scopeHint: opt.kind === "lead" ? opt.scope || null : null,
        });
      }}
    />
  );
}
