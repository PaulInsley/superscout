import type { ReportCardData } from "@/components/ReportCard";

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

export async function fetchReportCard(
  gameweek: number,
  managerId: number,
): Promise<ReportCardData | null> {
  try {
    const resp = await fetch(`${getApiBaseUrl()}/report-card/${gameweek}?manager_id=${managerId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.report ?? null;
  } catch (err) {
    console.warn("[reportCard] fetchExistingReportCard failed:", err);
    return null;
  }
}

export async function generateReportCard(
  gameweek: number,
  managerId: number,
  vibe: string = "expert",
): Promise<ReportCardData | null> {
  try {
    const resp = await fetch(`${getApiBaseUrl()}/report-card/generate/${gameweek}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: managerId, vibe }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.report ?? null;
  } catch (err) {
    console.warn("[reportCard] generateReportCard failed:", err);
    return null;
  }
}
