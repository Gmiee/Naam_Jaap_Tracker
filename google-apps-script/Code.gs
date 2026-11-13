
const SHEET_NAME = "Sessions";

const HEADERS = [
  "session_id",
  "date",
  "start_time",
  "end_time",
  "mantra",
  "count",
  "mala_count",
  "duration"
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.action !== "append" || !Array.isArray(payload.records)) {
      return json_({ ok: false, error: "Invalid payload" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) ||
                  ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    const existing = sheet.getLastRow() > 1
      ? new Set(
          sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
            .getValues().flat().map(String)
        )
      : new Set();

    const rows = payload.records
      .filter(r => r && r.session_id &&
        !existing.has(String(r.session_id)))
      .map(r => [
        String(r.session_id),
        String(r.date || ""),
        String(r.start_time || ""),
        String(r.end_time || ""),
        String(r.mantra || ""),
        Number(r.count || 0),
        Number(r.mala_count || 0),
        Number(r.duration || 0)
      ]);

    if (rows.length > 0) {
      sheet.getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        HEADERS.length
      ).setValues(rows);
    }

    return json_({
      ok: true,
      inserted: rows.length,
      received: payload.records.length
    });

  } catch (err) {
    return json_({
      ok: false,
      error: String(err)
    });
  }
}

function doGet() {
  return json_({
    ok: true,
    message: "Naam Jaap Sheets API is running."
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
