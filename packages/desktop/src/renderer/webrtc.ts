// Mesh WebRTC for live rooms — voice + screen share, peer-to-peer. The room
// WebSocket only relays signaling (offer/answer/ICE); media never touches a
// server. Free Google STUN for NAT discovery; no TURN (LAN/tunnel works P2P).
// Uses the MDN "perfect negotiation" pattern so adding/removing the screen
// track renegotiates cleanly without glare (polite peer = higher id).
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface Signal {
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit;
}

interface PeerConn {
  pc: RTCPeerConnection;
  makingOffer: boolean;
}

export interface CallPeerView {
  id: string;
  name: string;
  connected: boolean;
}
export interface RemoteScreen {
  id: string;
  name: string;
  stream: MediaStream;
}

export class CallManager {
  private conns = new Map<string, PeerConn>();
  private audioEls = new Map<string, HTMLAudioElement>();
  private remoteScreenStreams = new Map<string, MediaStream>();
  private names = new Map<string, string>();
  private local: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private myId = "";
  inCall = false;
  muted = false;
  sharing = false;
  error: string | null = null;

  constructor(
    private send: (to: string, data: unknown) => void,
    private onChange: () => void,
  ) {}

  setSelf(id: string): void {
    this.myId = id;
  }

  setPeers(list: Array<{ id: string; name: string }>): void {
    this.names = new Map(list.filter((p) => p.id).map((p) => [p.id, p.name]));
    if (this.inCall) {
      for (const p of list) {
        if (p.id && p.id !== this.myId && !this.conns.has(p.id)) this.ensure(p.id);
      }
    }
    this.onChange();
  }

  async joinVoice(): Promise<void> {
    if (this.inCall) return;
    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      this.error = "Microphone permission denied.";
      this.onChange();
      return;
    }
    this.error = null;
    this.inCall = true;
    this.muted = false;
    for (const [id] of this.names) if (id !== this.myId) this.ensure(id);
    this.onChange();
  }

  private ensure(peerId: string): PeerConn {
    const existing = this.conns.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const conn: PeerConn = { pc, makingOffer: false };
    this.conns.set(peerId, conn);
    if (this.local) for (const t of this.local.getTracks()) pc.addTrack(t, this.local);
    if (this.screen) for (const t of this.screen.getTracks()) pc.addTrack(t, this.screen);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => this.onTrack(peerId, e);
    pc.onnegotiationneeded = async () => {
      try {
        conn.makingOffer = true;
        await pc.setLocalDescription();
        this.send(peerId, { kind: "offer", sdp: pc.localDescription });
      } catch (err) {
        /* transient; will retry on next change */
      } finally {
        conn.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "closed") this.drop(peerId);
      this.onChange();
    };
    return conn;
  }

  async onSignal(from: string, data: Signal | undefined): Promise<void> {
    if (!from || !data) return;
    const conn = this.ensure(from);
    const pc = conn.pc;
    const polite = this.myId > from; // higher id yields on collisions
    try {
      if (data.kind === "offer" && data.sdp) {
        const collision = conn.makingOffer || pc.signalingState !== "stable";
        if (collision && !polite) return; // impolite peer ignores the offer
        await pc.setRemoteDescription(data.sdp); // implicit rollback if colliding+polite
        await pc.setLocalDescription(); // creates the answer
        this.send(from, { kind: "answer", sdp: pc.localDescription });
      } else if (data.kind === "answer" && data.sdp) {
        if (pc.signalingState === "have-local-offer") await pc.setRemoteDescription(data.sdp);
      } else if (data.kind === "ice" && data.candidate) {
        await pc.addIceCandidate(data.candidate).catch(() => undefined);
      }
    } catch (e) {
      /* a late/duplicate signal shouldn't tear down the call */
    }
  }

  private onTrack(peerId: string, e: RTCTrackEvent): void {
    const stream = e.streams[0];
    if (e.track.kind === "audio") {
      let el = this.audioEls.get(peerId);
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        el.style.display = "none";
        document.body.appendChild(el);
        this.audioEls.set(peerId, el);
      }
      if (stream) el.srcObject = stream;
    } else if (e.track.kind === "video" && stream) {
      this.remoteScreenStreams.set(peerId, stream);
      e.track.addEventListener("ended", () => {
        this.remoteScreenStreams.delete(peerId);
        this.onChange();
      });
    }
    this.onChange();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.local) for (const t of this.local.getAudioTracks()) t.enabled = !this.muted;
    this.onChange();
  }

  async shareScreen(): Promise<void> {
    if (this.sharing || !this.inCall) return;
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      this.error = "Screen share was cancelled.";
      this.onChange();
      return;
    }
    this.error = null;
    this.sharing = true;
    const track = this.screen.getVideoTracks()[0];
    if (track) track.addEventListener("ended", () => this.stopShare()); // OS "Stop sharing"
    for (const [, conn] of this.conns) {
      if (this.screen) for (const t of this.screen.getTracks()) conn.pc.addTrack(t, this.screen);
    }
    this.onChange();
  }

  stopShare(): void {
    if (!this.sharing) return;
    for (const [, conn] of this.conns) {
      for (const sender of conn.pc.getSenders()) {
        if (sender.track && sender.track.kind === "video") {
          try {
            conn.pc.removeTrack(sender);
          } catch {
          }
        }
      }
    }
    if (this.screen) for (const t of this.screen.getTracks()) t.stop();
    this.screen = null;
    this.sharing = false;
    this.onChange();
  }

  onPeerLeft(peerId: string): void {
    this.drop(peerId);
  }

  private drop(peerId: string): void {
    const conn = this.conns.get(peerId);
    if (conn) {
      try {
        conn.pc.close();
      } catch {
      }
      this.conns.delete(peerId);
    }
    const el = this.audioEls.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      this.audioEls.delete(peerId);
    }
    this.remoteScreenStreams.delete(peerId);
    this.onChange();
  }

  leave(): void {
    for (const [, conn] of this.conns) {
      try {
        conn.pc.close();
      } catch {
      }
    }
    this.conns.clear();
    for (const [, el] of this.audioEls) {
      el.srcObject = null;
      el.remove();
    }
    this.audioEls.clear();
    this.remoteScreenStreams.clear();
    if (this.local) {
      for (const t of this.local.getTracks()) t.stop();
      this.local = null;
    }
    if (this.screen) {
      for (const t of this.screen.getTracks()) t.stop();
      this.screen = null;
    }
    this.inCall = false;
    this.muted = false;
    this.sharing = false;
    this.onChange();
  }

  callPeers(): CallPeerView[] {
    const out: CallPeerView[] = [];
    for (const [id, name] of this.names) {
      if (id === this.myId) continue;
      out.push({ id, name, connected: this.conns.get(id)?.pc.connectionState === "connected" });
    }
    return out;
  }

  remoteScreens(): RemoteScreen[] {
    const out: RemoteScreen[] = [];
    for (const [id, stream] of this.remoteScreenStreams) {
      out.push({ id, name: this.names.get(id) ?? "", stream });
    }
    return out;
  }
}
