import type { Request, Response } from "@google-cloud/functions-framework";
import { getTripConfig, setTripConfig, type TripConfig } from "./tripConfig";
import { findCity } from "./cities";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseTripConfigInput(body: unknown): TripConfig | null {
  const b = body as Record<string, unknown>;
  if (typeof b.country !== "string" || typeof b.city !== "string") return null;
  if (!findCity(b.country, b.city)) return null;
  if (typeof b.startDate !== "string" || !DATE_PATTERN.test(b.startDate)) return null;
  if (typeof b.endDate !== "string" || !DATE_PATTERN.test(b.endDate)) return null;
  if (b.startDate > b.endDate) return null;

  return { country: b.country, city: b.city, startDate: b.startDate, endDate: b.endDate };
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
