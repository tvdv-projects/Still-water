// Anonymous usage counting with GoatCounter (no cookies, no personal data, no consent banner needed).
// The page view is counted by GoatCounter's own script in index.html; this module adds a few events
// so you can see whether people actually play: which profile, test mode or a real heart-rate monitor,
// and whether the session was finished.
//
// Never send heart rate, HRV or anything else about the person's body: only these counts.

export function track(path, title = path) {
  try {
    window.goatcounter?.count?.({ path, title, event: true });
  } catch {
    /* counting must never break the app */
  }
}
