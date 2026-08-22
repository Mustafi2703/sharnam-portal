# 09 — End-to-End Flows

**Version:** 0.1 · 2026-08-03  
Mermaid flows for implementers and client walkthroughs. Domain field detail: HRMS / CRM / Audit LLDs.

---

## 1. Recruit → Onboard → Directory

```mermaid
flowchart TD
  Req[Manpower Requisition] --> HrAppr{HR Approve?}
  HrAppr -->|No| Rejected[Rejected]
  HrAppr -->|Yes| Post[Job posting metadata]
  Post --> Resume[Resume DB / Candidate]
  Resume --> Screen[Screening / Shortlist]
  Screen --> Sched[Interview schedule Teams]
  Sched --> Fb[Feedback and scorecard]
  Fb --> Sel{Selected?}
  Sel -->|No| CandReject[Rejected / Hold]
  Sel -->|Yes| Sal[Salary discussion]
  Sal --> OfferAppr[Offer approval]
  OfferAppr --> Letter[Offer letter generate]
  Letter --> Accept{Candidate accepts?}
  Accept -->|No| Declined[Declined]
  Accept -->|Yes| PreJoin[Pre-joining checklist]
  PreJoin --> EmpCode[Employee code + User]
  EmpCode --> Onboard[Onboarding forms and KYC]
  Onboard --> Policy[Policy acknowledgement]
  Policy --> Assign[Assign to project Directory]
```

---

## 2. Geo attendance punch

```mermaid
sequenceDiagram
  participant Emp as Employee App
  participant API as HRM API
  participant DB as DB
  participant Store as File Store

  Emp->>API: GET assigned geofences
  API-->>Emp: sites lat lng radius
  Emp->>Emp: Capture GPS + selfie
  Emp->>API: POST attendance/punch multipart
  API->>API: Haversine distance vs GeofenceSite
  alt inside fence
    API->>Store: Store selfie
    API->>DB: Upsert Attendance + AttendancePunch Verified
    API-->>Emp: Present OK
  else outside fence
    API->>DB: Optional Failed punch log
    API-->>Emp: 409 OutOfFence
  end
```

HR override path: `POST /attendance/override` → AuditEvent (no selfie required).

---

## 3. Leave request

```mermaid
flowchart LR
  Emp[Employee submits LeaveRequest + LeaveType] --> Pend[Pending]
  Pend --> Mgr{Approver decide}
  Mgr -->|Approve| OK[Approved]
  Mgr -->|Reject| NO[Rejected]
  OK --> Cal[Reflect on attendance calendar]
```

Holiday master blocks / informs day count calculation.

---

## 4. Lead → Quotation → Compare → Project

```mermaid
flowchart TD
  Lead[Create / qualify Lead] --> Org[Linked search ClientOrganisation]
  Org --> Quote[Draft Quotation from SPDC template]
  Quote --> Edit[Edit sections and commercial]
  Edit --> Gen[Generate DOCX / PDF]
  Gen --> Send[Send via Outbox / Graph]
  Lead --> Bid[BidPackage + import BOQ]
  Bid --> Comp[ComparativeStatement multi-vendor rates]
  Comp --> Award[Award vendor]
  Send --> Neg[Negotiation stage]
  Award --> Neg
  Neg --> Conv{Convert}
  Conv --> Proj[Create Project + client card]
  Proj --> PV[ProjectVendor from award]
  Proj --> DMS[Attach quotation PDF to DMS]
```

---

## 5. Drawing publish gate

```mermaid
flowchart TD
  Unlock[Complete Drawing Check Master] --> Upload[Upload revision modal]
  Upload --> Pub{Publish?}
  Pub -->|Yes| File[Store file mock or SharePoint]
  File --> Notify[EmailOutbox notify matrix]
  Pub -->|No| Draft[Remain draft revision]
```

---

## 6. Request for Information vs Inspection

```mermaid
flowchart TD
  subgraph drawings [Drawings / Comms]
    RFI[Request for Information]
    RFI --> Matrix1[Matrix parties respond]
    Matrix1 --> Close1[Close RFI]
  end

  subgraph quality [Quality / Safety]
    RInsp[Request for Inspection]
    RInsp --> Assign[Checklist / QI assignment]
    Assign --> Fill[Contractor or site fill]
    Fill --> Close2[Close inspection request]
  end
```

---

## 7. Meeting with Teams + Sheet Maker

```mermaid
sequenceDiagram
  participant Off as Office
  participant API as Comms API
  participant SM as Sheet Maker
  participant G as Microsoft Graph

  Off->>SM: Pick published SheetTemplate
  Off->>API: Create Meeting + templateId
  API->>G: createTeamsMeeting
  G-->>API: joinUrl
  API->>API: Create SheetInstance
  API-->>Off: Meeting with Teams link
  Off->>API: Agenda / MoM / finalize sheet
  API->>API: EmailOutbox MoM PDF
```

---

## 8. Site audit cycle

```mermaid
flowchart TD
  Plan[Create SiteAudit + Plan] --> DC[DC Interview checklist]
  Plan --> Walk[Site Walk checklist]
  Plan --> Folder[Folder Sample]
  DC --> Find[Log Findings]
  Walk --> Find
  Folder --> Find
  Find --> Capa[CAPA owners and due dates]
  Capa --> Dash[Audit Dashboard]
  Find --> KPI[Update linked KpiSubject overdue / RAG]
  Dash --> Close[Close audit report]
```

---

## 9. KPI refresh

```mermaid
flowchart LR
  Import[Import Master KPI pack] --> Subjects[KpiSubject rows]
  Subjects --> Refresh[Refresh job]
  Refresh --> Live[Pull live counts from registers / findings]
  Live --> RAG[Compute RAG and KRA scores]
  RAG --> Dash[KPI Dashboard + ISO rollup]
  RAG --> HR[Evidence for Employee KRA]
```

---

## 10. Graph mail send

```mermaid
sequenceDiagram
  participant Dom as Domain route
  participant OB as EmailOutbox
  participant GS as GraphService
  participant OL as Outlook

  Dom->>OB: Insert Queued
  Dom->>GS: flush if configured
  alt Graph live
    GS->>OL: Mail.Send as shared mailbox
    GS->>OB: Mark Sent
  else Mock
    OB->>OB: Remain Queued for UI
  end
```

---

## 11. Personal diary vs Field day log

```mermaid
flowchart TB
  Emp[Employee] --> PD[PersonalDiaryEntry HRMS]
  Site[Site engineer] --> DL[DailyLog Field project-scoped]
  PD -. optional future .-> DL
```

Keep separate storage and permissions in v1.

Next: [10-Client-SRS-Delta.md](./10-Client-SRS-Delta.md).
