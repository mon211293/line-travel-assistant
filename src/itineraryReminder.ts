import * as functions from "@google-cloud/functions-framework";
import { loadConfig, type AppConfig } from "./config";
import { getUpcomingEvents, type CalendarEvent } from "./calendar";
import { hasBeenNotified, markNotified } from "./reminderStore";
import { pushText } from "./line";
import { isAuthorizedTrigger } from "./httpAuth";
import { getTripConfig, isWithinTrip, getTimeZone } from "./tripConfig";
import { getDateKey } from "./timeZoneUtil";
import { mapsUrl } from "./dailyContent";

const REMINDER_WINDOW_MINUTES = Number(process.env.REMINDER_WINDOW_MINUTES ?? 60);

function formatReminderText(event: CalendarEvent, timeZone: string): string {
  const time = event.start.toLocaleTimeString("zh-TW", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const mapUrl = event.location ? mapsUrl(event.location) : null;
  const location = event.location ? `\n📍 ${event.location}${mapUrl ? `\n🗺 ${mapUrl}` : ""}` : "";
  const description = event.description ? `\n📝 ${event.description}` : "";
  return `⏰ 即將開始:${event.title}\n🕐 ${time}${location}${description}`;
}

export async function itineraryReminder(config: AppConfig): Promise<void> {
  const tripConfig = await getTripConfig();
  const timeZone = getTimeZone(tripConfig);
  if (!isWithinTrip(tripConfig, getDateKey(new Date(), timeZone))) return;

  const events = await getUpcomingEvents(config, REMINDER_WINDOW_MINUTES);

  for (const event of events) {
    if (await hasBeenNotified(event.id)) continue;

    await pushText(config, formatReminderText(event, timeZone));
    await markNotified(event.id);
  }
}

functions.http("itineraryReminder", async (req, res) => {
  try {
    const config = await loadConfig();
    if (!isAuthorizedTrigger(req, config)) {
      res.status(401).send("Unauthorized");
      return;
    }

    await itineraryReminder(config);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err instanceof Error ? err.message : "Unknown error");
  }
});
