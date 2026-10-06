export default function SsidGuide() {
  return (
    <details className="guide" style={{ marginTop: 14 }}>
      <summary style={{ fontSize: 13, color: "var(--dim)" }}>
        how to get your ssid (30 sec, pc needed)
      </summary>
      <ol className="guide-list">
        <li>
          log in at <b>account.riotgames.com</b>
        </li>
        <li>
          go to <b>playvalorant.com</b>
        </li>
        <li>
          open devtools (<b>f12</b> or <b>ctrl+shift+i</b>), go to the{" "}
          <b>application</b> tab
        </li>
        <li>
          expand <b>cookies</b>, select <b>https://auth.riotgames.com</b>
        </li>
        <li>
          find <b>ssid</b>, double-click its value to copy it
        </li>
        <li>paste it here and hit connect</li>
      </ol>
      <p className="dim" style={{ marginTop: 10 }}>
        riot blocks password logins from websites, so we use your riot session
        cookie instead. your password never touches this site.
      </p>
    </details>
  );
}
