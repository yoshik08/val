export default function SsidGuide() {
  return (
    <details className="guide" style={{ marginTop: 14 }}>
      <summary style={{ fontSize: 13, color: "var(--dim)" }}>
        how to get your ssid (30 sec, laptop needed)
      </summary>
      <ol className="guide-list">
        <li>
          on your laptop, open chrome and log into <b>playvalorant.com</b>
        </li>
        <li>
          press <b>f12</b> → <b>application</b> tab → <b>cookies</b> →{" "}
          <b>https://auth.riotgames.com</b>
        </li>
        <li>
          find <b>ssid</b>, double-click its value and copy it
        </li>
        <li>paste it below and hit connect</li>
      </ol>
      <p className="dim" style={{ marginTop: 10 }}>
        riot blocks password logins from websites, so we use your riot session
        cookie instead. your password never touches this site.
      </p>
    </details>
  );
}
