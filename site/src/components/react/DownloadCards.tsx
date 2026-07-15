import { useEffect, useState } from "react";

const BASE = "https://github.com/Cartivo-Oficial/TermCoder/releases/latest/download/";

function detect(): { os: string; asset: string } {
  const p = navigator.platform || "";
  const mac = /Mac/i.test(p);
  const linux = /Linux/i.test(p) && !/Android/i.test(navigator.userAgent);
  const asset = mac ? "TermCoder-arm64.dmg" : linux ? "TermCoder-x86_64.AppImage" : "TermCoder-Setup.exe";
  const os = mac ? "macOS" : linux ? "Linux" : "Windows";
  return { os, asset };
}

export default function DownloadCards() {
  const [os, setOs] = useState("your system");
  const [asset, setAsset] = useState("TermCoder-Setup.exe");

  useEffect(() => {
    const d = detect();
    setOs(d.os);
    setAsset(d.asset);
  }, []);

  return (
    <>
      <section className="sys-sec2">
        <div className="gutter">//</div>
        <div className="split">
          <div className="t full">
            <div className="mono-eyebrow"><span className="slash">//</span> DOWNLOAD</div>
            <h2>The desktop app.</h2>
            <p>Chat, an editor, and a real terminal in one window — Node bundled, nothing to install. We picked
              the build for <b className="in-word" id="osName">{os}</b>; grab another below if you need it.</p>
            <div className="row-2"><a className="btn-2 go" id="primaryDl" href={BASE + asset}>Download</a></div>
          </div>
        </div>
      </section>

      <section className="sys-sec2">
        <div className="gutter">—</div>
        <div className="split">
          <div className="t full">
            <div className="dlgrid">
              <div className="dlcol">
                <div className="k">WINDOWS</div>
                <a className="dlrow" href={BASE + "TermCoder-Setup.exe"}><span>Installer</span><span className="ext">.exe</span></a>
                <a className="dlrow" href={BASE + "TermCoder-Portable.exe"}><span>Portable</span><span className="ext">.exe</span></a>
              </div>
              <div className="dlcol">
                <div className="k">MACOS</div>
                <a className="dlrow" href={BASE + "TermCoder-arm64.dmg"}><span>Apple silicon</span><span className="ext">.dmg</span></a>
                <a className="dlrow" href={BASE + "TermCoder-x64.dmg"}><span>Intel</span><span className="ext">.dmg</span></a>
              </div>
              <div className="dlcol">
                <div className="k">LINUX</div>
                <a className="dlrow" href={BASE + "TermCoder-x86_64.AppImage"}><span>AppImage</span><span className="ext">.AppImage</span></a>
                <a className="dlrow" href={BASE + "TermCoder-amd64.deb"}><span>Debian / Ubuntu</span><span className="ext">.deb</span></a>
              </div>
            </div>
            <p className="dl-note">Every download is the latest release, built by CI and published on GitHub. Prefer the
              terminal? <a className="link" href="install.html">Install the CLI</a> from npm instead.</p>
          </div>
        </div>
      </section>
    </>
  );
}
