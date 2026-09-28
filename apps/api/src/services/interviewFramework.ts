import { SPDC_HIRING_ROLES } from "@sharnam/shared";

/** Same names as the Framework sheet — do not add roles that are not in the SPDC workbook. */
export const INTERVIEW_ROLES = SPDC_HIRING_ROLES;

export type InterviewParam = {
  code: string;
  category: string;
  parameter: string;
  probe: string;
  weights: Record<string, number>;
};

export const INTERVIEW_PARAMS: InterviewParam[] = [
  {
    "code": "T1",
    "category": "Technical / Functional",
    "parameter": "Core domain knowledge (role-specific)",
    "probe": "Codes & standards (IS/NBC/Factory Act/labour law as per role), drawing reading, fundamentals of the discipline",
    "weights": {
      "Project Manager (Site)": 10,
      "Planning Engineer": 6,
      "Billing / QS Engineer": 8,
      "Project Coordinator": 5,
      "Senior Site Engineer (Civil)": 12,
      "Junior Engineer": 14,
      "QA/QC Engineer": 12,
      "MEP Engineer": 18,
      "Safety Officer": 8,
      "HR & Admin Executive": 20
    }
  },
  {
    "code": "T2",
    "category": "Technical / Functional",
    "parameter": "Planning & scheduling",
    "probe": "WBS, CPM logic, MSP/P6, look-ahead plans, baseline vs actual, S-curve, recovery planning",
    "weights": {
      "Project Manager (Site)": 6,
      "Planning Engineer": 20,
      "Billing / QS Engineer": 2,
      "Project Coordinator": 8,
      "Senior Site Engineer (Civil)": 5,
      "Junior Engineer": 3,
      "QA/QC Engineer": 0,
      "MEP Engineer": 4,
      "Safety Officer": 0,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "T3",
    "category": "Technical / Functional",
    "parameter": "Estimation, measurement & billing",
    "probe": "Quantity take-off, IS 1200 modes of measurement, BBS, RA bill checking, rate analysis",
    "weights": {
      "Project Manager (Site)": 3,
      "Planning Engineer": 4,
      "Billing / QS Engineer": 22,
      "Project Coordinator": 3,
      "Senior Site Engineer (Civil)": 5,
      "Junior Engineer": 6,
      "QA/QC Engineer": 3,
      "MEP Engineer": 5,
      "Safety Officer": 0,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "T4",
    "category": "Technical / Functional",
    "parameter": "Quality assurance & inspection",
    "probe": "ITP, material testing, checklists, NCR closure, method statements, third-party inspection",
    "weights": {
      "Project Manager (Site)": 4,
      "Planning Engineer": 0,
      "Billing / QS Engineer": 2,
      "Project Coordinator": 2,
      "Senior Site Engineer (Civil)": 7,
      "Junior Engineer": 6,
      "QA/QC Engineer": 22,
      "MEP Engineer": 8,
      "Safety Officer": 3,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "T5",
    "category": "Technical / Functional",
    "parameter": "Execution & site management",
    "probe": "Sequencing, method of construction, manpower/material/machinery planning, daily site control",
    "weights": {
      "Project Manager (Site)": 8,
      "Planning Engineer": 6,
      "Billing / QS Engineer": 3,
      "Project Coordinator": 4,
      "Senior Site Engineer (Civil)": 14,
      "Junior Engineer": 12,
      "QA/QC Engineer": 5,
      "MEP Engineer": 10,
      "Safety Officer": 5,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "T6",
    "category": "Technical / Functional",
    "parameter": "Health, safety & environment",
    "probe": "HIRA/JSA, work permits, PPE, BOCW/Factory Act compliance, incident reporting & investigation",
    "weights": {
      "Project Manager (Site)": 4,
      "Planning Engineer": 0,
      "Billing / QS Engineer": 0,
      "Project Coordinator": 2,
      "Senior Site Engineer (Civil)": 6,
      "Junior Engineer": 5,
      "QA/QC Engineer": 3,
      "MEP Engineer": 5,
      "Safety Officer": 25,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "T7",
    "category": "Technical / Functional",
    "parameter": "Software & digital tools",
    "probe": "AutoCAD, MS Project/P6, Excel (advanced), ERP/HRMS, reporting tools as relevant to role",
    "weights": {
      "Project Manager (Site)": 2,
      "Planning Engineer": 10,
      "Billing / QS Engineer": 6,
      "Project Coordinator": 6,
      "Senior Site Engineer (Civil)": 2,
      "Junior Engineer": 4,
      "QA/QC Engineer": 3,
      "MEP Engineer": 3,
      "Safety Officer": 2,
      "HR & Admin Executive": 8
    }
  },
  {
    "code": "C1",
    "category": "Commercial & Contract",
    "parameter": "Contract & commercial awareness",
    "probe": "GCC/SCC clauses, scope, variations, extra items, claims, LDs, EOT, notices",
    "weights": {
      "Project Manager (Site)": 8,
      "Planning Engineer": 5,
      "Billing / QS Engineer": 12,
      "Project Coordinator": 5,
      "Senior Site Engineer (Civil)": 3,
      "Junior Engineer": 0,
      "QA/QC Engineer": 3,
      "MEP Engineer": 4,
      "Safety Officer": 2,
      "HR & Admin Executive": 4
    }
  },
  {
    "code": "C2",
    "category": "Commercial & Contract",
    "parameter": "Cost control & value engineering",
    "probe": "Budget vs actual, cost-to-complete, wastage control, alternatives that save cost without loss of quality",
    "weights": {
      "Project Manager (Site)": 6,
      "Planning Engineer": 6,
      "Billing / QS Engineer": 8,
      "Project Coordinator": 3,
      "Senior Site Engineer (Civil)": 3,
      "Junior Engineer": 0,
      "QA/QC Engineer": 0,
      "MEP Engineer": 3,
      "Safety Officer": 0,
      "HR & Admin Executive": 3
    }
  },
  {
    "code": "C3",
    "category": "Commercial & Contract",
    "parameter": "Documentation & reporting",
    "probe": "DPR/WPR/MPR, MOM, RFI, submittal logs, registers, record-keeping discipline",
    "weights": {
      "Project Manager (Site)": 3,
      "Planning Engineer": 8,
      "Billing / QS Engineer": 6,
      "Project Coordinator": 12,
      "Senior Site Engineer (Civil)": 4,
      "Junior Engineer": 5,
      "QA/QC Engineer": 8,
      "MEP Engineer": 4,
      "Safety Officer": 8,
      "HR & Admin Executive": 10
    }
  },
  {
    "code": "C4",
    "category": "Commercial & Contract",
    "parameter": "Contractor & vendor management",
    "probe": "Contractor coordination, follow-up, submittal/approval chasing, performance review",
    "weights": {
      "Project Manager (Site)": 5,
      "Planning Engineer": 2,
      "Billing / QS Engineer": 4,
      "Project Coordinator": 6,
      "Senior Site Engineer (Civil)": 6,
      "Junior Engineer": 2,
      "QA/QC Engineer": 5,
      "MEP Engineer": 6,
      "Safety Officer": 5,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "B1",
    "category": "Behavioural",
    "parameter": "Problem solving & decision making",
    "probe": "Case-based: structured approach, root cause, options, decision under incomplete data",
    "weights": {
      "Project Manager (Site)": 5,
      "Planning Engineer": 7,
      "Billing / QS Engineer": 5,
      "Project Coordinator": 5,
      "Senior Site Engineer (Civil)": 5,
      "Junior Engineer": 6,
      "QA/QC Engineer": 6,
      "MEP Engineer": 6,
      "Safety Officer": 6,
      "HR & Admin Executive": 6
    }
  },
  {
    "code": "B2",
    "category": "Behavioural",
    "parameter": "Communication",
    "probe": "Clarity, listening, written English/Gujarati/Hindi, presentation to client",
    "weights": {
      "Project Manager (Site)": 4,
      "Planning Engineer": 5,
      "Billing / QS Engineer": 3,
      "Project Coordinator": 10,
      "Senior Site Engineer (Civil)": 3,
      "Junior Engineer": 4,
      "QA/QC Engineer": 4,
      "MEP Engineer": 4,
      "Safety Officer": 6,
      "HR & Admin Executive": 10
    }
  },
  {
    "code": "B3",
    "category": "Behavioural",
    "parameter": "Client & stakeholder handling",
    "probe": "Managing client expectations, conflicts, escalations, professional conduct",
    "weights": {
      "Project Manager (Site)": 6,
      "Planning Engineer": 3,
      "Billing / QS Engineer": 3,
      "Project Coordinator": 8,
      "Senior Site Engineer (Civil)": 3,
      "Junior Engineer": 0,
      "QA/QC Engineer": 4,
      "MEP Engineer": 4,
      "Safety Officer": 3,
      "HR & Admin Executive": 6
    }
  },
  {
    "code": "B4",
    "category": "Behavioural",
    "parameter": "Ownership & accountability",
    "probe": "Examples of owning outcomes, follow-through, admitting mistakes",
    "weights": {
      "Project Manager (Site)": 4,
      "Planning Engineer": 4,
      "Billing / QS Engineer": 4,
      "Project Coordinator": 5,
      "Senior Site Engineer (Civil)": 4,
      "Junior Engineer": 6,
      "QA/QC Engineer": 5,
      "MEP Engineer": 4,
      "Safety Officer": 5,
      "HR & Admin Executive": 6
    }
  },
  {
    "code": "B5",
    "category": "Behavioural",
    "parameter": "Teamwork & collaboration",
    "probe": "Working with other disciplines, sharing information, supporting colleagues",
    "weights": {
      "Project Manager (Site)": 1,
      "Planning Engineer": 3,
      "Billing / QS Engineer": 2,
      "Project Coordinator": 4,
      "Senior Site Engineer (Civil)": 2,
      "Junior Engineer": 4,
      "QA/QC Engineer": 2,
      "MEP Engineer": 2,
      "Safety Officer": 2,
      "HR & Admin Executive": 5
    }
  },
  {
    "code": "B6",
    "category": "Behavioural",
    "parameter": "Integrity & ethics",
    "probe": "Honesty in examples, stance on vendor favours, measurement/quality compromise scenarios",
    "weights": {
      "Project Manager (Site)": 5,
      "Planning Engineer": 5,
      "Billing / QS Engineer": 6,
      "Project Coordinator": 5,
      "Senior Site Engineer (Civil)": 5,
      "Junior Engineer": 6,
      "QA/QC Engineer": 7,
      "MEP Engineer": 5,
      "Safety Officer": 7,
      "HR & Admin Executive": 10
    }
  },
  {
    "code": "B7",
    "category": "Behavioural",
    "parameter": "Pressure handling & adaptability",
    "probe": "Deadlines, changing priorities, site crises, night work, learning new systems",
    "weights": {
      "Project Manager (Site)": 3,
      "Planning Engineer": 2,
      "Billing / QS Engineer": 2,
      "Project Coordinator": 3,
      "Senior Site Engineer (Civil)": 3,
      "Junior Engineer": 4,
      "QA/QC Engineer": 2,
      "MEP Engineer": 2,
      "Safety Officer": 3,
      "HR & Admin Executive": 3
    }
  },
  {
    "code": "L1",
    "category": "Leadership",
    "parameter": "Team leadership & people management",
    "probe": "Leading engineers/supervisors, delegation, mentoring, performance feedback",
    "weights": {
      "Project Manager (Site)": 6,
      "Planning Engineer": 0,
      "Billing / QS Engineer": 0,
      "Project Coordinator": 0,
      "Senior Site Engineer (Civil)": 4,
      "Junior Engineer": 0,
      "QA/QC Engineer": 0,
      "MEP Engineer": 0,
      "Safety Officer": 3,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "L2",
    "category": "Leadership",
    "parameter": "Strategic thinking & foresight",
    "probe": "Project-level view, risk anticipation, planning ahead of client needs",
    "weights": {
      "Project Manager (Site)": 4,
      "Planning Engineer": 2,
      "Billing / QS Engineer": 0,
      "Project Coordinator": 0,
      "Senior Site Engineer (Civil)": 0,
      "Junior Engineer": 0,
      "QA/QC Engineer": 0,
      "MEP Engineer": 0,
      "Safety Officer": 0,
      "HR & Admin Executive": 0
    }
  },
  {
    "code": "F1",
    "category": "Fit & Motivation",
    "parameter": "Career stability & motivation",
    "probe": "Tenure pattern, reasons for change, genuine interest in PMC career",
    "weights": {
      "Project Manager (Site)": 2,
      "Planning Engineer": 1,
      "Billing / QS Engineer": 1,
      "Project Coordinator": 2,
      "Senior Site Engineer (Civil)": 1,
      "Junior Engineer": 5,
      "QA/QC Engineer": 2,
      "MEP Engineer": 1,
      "Safety Officer": 2,
      "HR & Admin Executive": 4
    }
  },
  {
    "code": "F2",
    "category": "Fit & Motivation",
    "parameter": "Culture fit (SPDC values)",
    "probe": "Discipline, client-first attitude, learning mindset, alignment with SPDC way of working",
    "weights": {
      "Project Manager (Site)": 1,
      "Planning Engineer": 1,
      "Billing / QS Engineer": 1,
      "Project Coordinator": 2,
      "Senior Site Engineer (Civil)": 1,
      "Junior Engineer": 3,
      "QA/QC Engineer": 2,
      "MEP Engineer": 1,
      "Safety Officer": 2,
      "HR & Admin Executive": 5
    }
  },
  {
    "code": "F3",
    "category": "Fit & Motivation",
    "parameter": "Site / travel readiness",
    "probe": "Willingness to relocate, site posting, travel, availability",
    "weights": {
      "Project Manager (Site)": 0,
      "Planning Engineer": 0,
      "Billing / QS Engineer": 0,
      "Project Coordinator": 0,
      "Senior Site Engineer (Civil)": 2,
      "Junior Engineer": 5,
      "QA/QC Engineer": 2,
      "MEP Engineer": 1,
      "Safety Officer": 3,
      "HR & Admin Executive": 0
    }
  }
];
