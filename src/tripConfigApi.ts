import type { Request, Response } from "@google-cloud/functions-framework";
import { getTripConfig, setTripConfig, type TripConfig, type ScheduledMessage } from "./tripConfig";
import { findCity } from "./cities";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function parseTripConfigInput(body: unknown): TripConfig | null {
  const b = body as Record<string, unknown>;
  if (typeof b.startDate !== "string" || !DATE_PATTERN.test(b.startDate)) return null;
  if (typeof b.endDate !== "string" || !DATE_PATTERN.test(b.endDate)) return null;
  if (b.startDate > b.endDate) return null;
  if (b.weatherTime !== undefined && (typeof b.weatherTime !== "string" || !TIME_PATTERN.test(b.weatherTime))) return null;

  const cityByDateRaw = b.cityByDate as Record<string, { country?: unknown; city?: unknown }> | undefined;
  const cityByDate: TripConfig["cityByDate"] = {};
  if (cityByDateRaw && typeof cityByDateRaw === "object") {
    for (const [dateKey, ref] of Object.entries(cityByDateRaw)) {
      if (!DATE_PATTERN.test(dateKey) || dateKey < b.startDate || dateKey > b.endDate) continue;
      if (typeof ref?.country !== "string" || typeof ref?.city !== "string") continue;
      if (!findCity(ref.country, ref.city)) continue;
      cityByDate[dateKey] = { country: ref.country, city: ref.city };
    }
  }

  const scheduledMessagesRaw = Array.isArray(b.scheduledMessages) ? b.scheduledMessages : [];
  const scheduledMessages: ScheduledMessage[] = [];
  for (const item of scheduledMessagesRaw as unknown[]) {
    const m = item as Record<string, unknown>;
    if (typeof m.id !== "string" || m.id.length === 0) continue;
    if (typeof m.date !== "string" || !DATE_PATTERN.test(m.date)) continue;
    if (typeof m.time !== "string" || !TIME_PATTERN.test(m.time)) continue;
    if (typeof m.text !== "string" || m.text.trim().length === 0) continue;
    scheduledMessages.push({ id: m.id, date: m.date, time: m.time, text: m.text.trim() });
  }

  return {
    startDate: b.startDate,
    endDate: b.endDate,
    weatherTime: typeof b.weatherTime === "string" ? b.weatherTime : undefined,
    cityByDate,
    scheduledMessages,
  };
}

export async function handleTripConfigApi(req: Request, res: Response): Promise<void> {
  if (req.method === "GET") {
    res.status(200).json({ config: await getTripConfig() });
    return;
  }

  if (req.method === "PUT") {
    const parsed = parseTripConfigInput(req.body);
    if (!parsed) {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    await setTripConfig(parsed);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
