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
  const label = `${doc.category || ""} ${doc.title || ""} ${doc.fileUrl || ""}`;
  return /passport|photo/i.test(doc.category || "") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(label) || /\b(png|jpe?g|gif|webp)\b/i.test(doc.title || "");
}

export function hrFileContentUrl(id: string, token: string | null | undefined) {
  if (!id || !token) return "";
  return `${apiBase()}/api/hrm/stored-file/${id}?token=${encodeURIComponent(token)}`;
}
