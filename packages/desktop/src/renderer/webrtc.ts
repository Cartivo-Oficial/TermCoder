// Mesh WebRTC voice for live rooms. Audio streams peer-to-peer (P2P) — the room
// WebSocket only relays signaling (offer/answer/ICE). Free Google STUN handles
// NAT discovery; no media server, no hosted infra. Screen share is layered on
// later. Glare is avoided by a deterministic rule: the peer with the lower id
// creates the offer.
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface Signal {
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit;
}

export interface CallPeerView {
  id: string;
  name: string;
  connected: boolean;
}

export class CallManager {
  private pcs = new Map<string, RTCPeerConnection>();
  private audioEls = new Map<string, HTMLAudioElement>();
  private names = new Map<string, string>();
  private local: MediaStream | null = null;
  private myId = "";
  inCall = false;
  muted = false;
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
        if (p.id && p.id !== this.myId && !this.pcs.has(p.id) && this.shouldInitiate(p.id)) {
          this.connect(p.id, true);
        }
      }
    }
    this.onChange();
  }

  private shouldInitiate(peerId: string): boolean {
    return this.myId < peerId; // lower id offers → no glare
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
    for (const [id] of this.names) {
      if (id !== this.myId && this.shouldInitiate(id)) this.connect(id, true);
    }
    this.onChange();
  }

  private connect(peerId: string, initiator: boolean): RTCPeerConnection {
    const existing = this.pcs.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pcs.set(peerId, pc);
    if (this.local) for (const t of this.local.getTracks()) pc.addTrack(t, this.local);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => this.attachRemote(peerId, e.streams[0]);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "closed") this.drop(peerId);
      this.onChange();
    };
    if (initiator) {
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => this.send(peerId, { kind: "offer", sdp: pc.localDescription }))
        .catch(() => this.drop(peerId));
    }
    return pc;
  }

  async onSignal(from: string, data: Signal | undefined): Promise<void> {
    if (!from || !data) return;
    try {
      if (data.kind === "offer" && data.sdp) {
        const pc = this.connect(from, false);
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send(from, { kind: "answer", sdp: pc.localDescription });
      } else if (data.kind === "answer" && data.sdp) {
        const pc = this.pcs.get(from);
        if (pc) await pc.setRemoteDescription(data.sdp);
      } else if (data.kind === "ice" && data.candidate) {
        const pc = this.pcs.get(from);
        if (pc) await pc.addIceCandidate(data.candidate).catch(() => undefined);
      }
    } catch (e) {
      /* a malformed/late signal shouldn't crash the call */
    }
  }

  private attachRemote(peerId: string, stream?: MediaStream): void {
    if (!stream) return;
    let el = this.audioEls.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.style.display = "none";
      document.body.appendChild(el);
      this.audioEls.set(peerId, el);
    }
    el.srcObject = stream;
    this.onChange();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.local) for (const t of this.local.getAudioTracks()) t.enabled = !this.muted;
    this.onChange();
  }

  onPeerLeft(peerId: string): void {
    this.drop(peerId);
  }

  private drop(peerId: string): void {
    const pc = this.pcs.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {
      }
      this.pcs.delete(peerId);
    }
    const el = this.audioEls.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      this.audioEls.delete(peerId);
    }
    this.onChange();
  }

  leave(): void {
    for (const [, pc] of this.pcs) {
      try {
        pc.close();
      } catch {
      }
    }
    this.pcs.clear();
    for (const [, el] of this.audioEls) {
      el.srcObject = null;
      el.remove();
    }
    this.audioEls.clear();
    if (this.local) {
      for (const t of this.local.getTracks()) t.stop();
      this.local = null;
    }
    this.inCall = false;
    this.muted = false;
    this.onChange();
  }

  callPeers(): CallPeerView[] {
    const out: CallPeerView[] = [];
    for (const [id, name] of this.names) {
      if (id === this.myId) continue;
      out.push({ id, name, connected: this.pcs.get(id)?.connectionState === "connected" });
    }
    return out;
  }
}
