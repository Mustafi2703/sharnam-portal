import { apiBase } from "../api";

export const HR_FILE_KINDS = [
  "Passport photo",
  "Photo",
  "PAN",
  "Aadhaar",
  "Education",
  "Experience",
  "Salary slips",
  "Address proof",
  "Bank",
  "PF-ESIC",
  "Medical",
  "BGV",
  "Offer",
  "Appointment",
  "Promotion",
  "Payslip",
  "ID-card",
  "Other",
];

export function isHrImage(doc: { category?: string; title?: string; fileUrl?: string | null }) {
  return /passport|photo/i.test(doc.category || "") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(`${doc.title || ""} ${doc.fileUrl || ""}`);
}

export function hrFileContentUrl(id: string, token: string | null | undefined) {
  if (!id || !token) return "";
  return `${apiBase()}/api/hrm/stored-file/${id}?token=${encodeURIComponent(token)}`;
}
