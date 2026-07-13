// Mesh WebRTC for live rooms — voice + camera + screen share, peer-to-peer. The
// room WebSocket only relays signaling (offer/answer/ICE); media never touches a
// server. Free Google STUN for NAT discovery; no TURN (LAN/tunnel works P2P).
// MDN "perfect negotiation" (polite = higher id) so adding/removing camera or
// screen tracks renegotiates cleanly without glare.
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
  speaking: boolean;
}
export interface RemoteVideo {
  key: string;
  peerId: string;
  name: string;
  stream: MediaStream;
}

export class CallManager {
  private conns = new Map<string, PeerConn>();
  private audioEls = new Map<string, HTMLAudioElement>();
  private remoteVids = new Map<string, { peerId: string; stream: MediaStream }>(); // key: stream id
  private names = new Map<string, string>();
  private mic: MediaStream | null = null;
  private camera: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private myId = "";
  private audioCtx: AudioContext | null = null;
  private analysers = new Map<string, AnalyserNode>();
  private speaking = new Set<string>();
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  inCall = false;
  muted = false;
  cameraOn = false;
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
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      this.error = "Microphone permission denied.";
      this.onChange();
      return;
    }
    this.error = null;
    this.inCall = true;
    this.muted = false;
    this.setupAnalyser("self", this.mic);
    this.startLevelLoop();
    for (const [id] of this.names) if (id !== this.myId) this.ensure(id);
    this.onChange();
  }

  private setupAnalyser(key: string, stream: MediaStream | null): void {
    if (!stream || !stream.getAudioTracks().length) return;
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.analysers.set(key, analyser);
    } catch (e) {
      void e;
    }
  }

  private startLevelLoop(): void {
    if (this.levelTimer) return;
    this.levelTimer = setInterval(() => {
      let changed = false;
      for (const [key, analyser] of this.analysers) {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const b of data) {
          const v = (b - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const loud = key === "self" ? rms > 0.05 && !this.muted : rms > 0.05;
        const was = this.speaking.has(key);
        if (loud && !was) {
          this.speaking.add(key);
          changed = true;
        } else if (!loud && was) {
          this.speaking.delete(key);
          changed = true;
        }
      }
      if (changed) this.onChange();
    }, 250);
  }

  private ensure(peerId: string): PeerConn {
    const existing = this.conns.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const conn: PeerConn = { pc, makingOffer: false };
    this.conns.set(peerId, conn);
    for (const media of [this.mic, this.camera, this.screen]) {
      if (media) for (const t of media.getTracks()) pc.addTrack(t, media);
    }
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
        /* transient; retries on next change */
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
    const polite = this.myId > from;
    try {
      if (data.kind === "offer" && data.sdp) {
        const collision = conn.makingOffer || pc.signalingState !== "stable";
        if (collision && !polite) return;
        await pc.setRemoteDescription(data.sdp);
        await pc.setLocalDescription();
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
      if (stream) {
        el.srcObject = stream;
        this.setupAnalyser(peerId, stream);
      }
    } else if (e.track.kind === "video" && stream) {
      this.remoteVids.set(stream.id, { peerId, stream });
      const cleanup = () => {
        if (!stream.getVideoTracks().some((t) => t.readyState === "live")) {
          this.remoteVids.delete(stream.id);
        }
        this.onChange();
      };
      e.track.addEventListener("ended", cleanup);
      stream.addEventListener("removetrack", cleanup);
    }
    this.onChange();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.mic) for (const t of this.mic.getAudioTracks()) t.enabled = !this.muted;
    this.onChange();
  }

  async toggleCamera(): Promise<void> {
    if (!this.inCall) return;
    if (this.cameraOn) {
      this.removeLocalVideo(this.camera);
      if (this.camera) for (const t of this.camera.getTracks()) t.stop();
      this.camera = null;
      this.cameraOn = false;
    } else {
      try {
        this.camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e) {
        this.error = "Camera permission denied.";
        this.onChange();
        return;
      }
      this.error = null;
      this.cameraOn = true;
      this.addLocalVideo(this.camera);
    }
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
    if (track) track.addEventListener("ended", () => this.stopShare());
    this.addLocalVideo(this.screen);
    this.onChange();
  }

  stopShare(): void {
    if (!this.sharing) return;
    this.removeLocalVideo(this.screen);
    if (this.screen) for (const t of this.screen.getTracks()) t.stop();
    this.screen = null;
    this.sharing = false;
    this.onChange();
  }

  // Add a local media's tracks to every peer (triggers renegotiation per pc).
  private addLocalVideo(media: MediaStream | null): void {
    if (!media) return;
    for (const [, conn] of this.conns) {
      for (const t of media.getTracks()) conn.pc.addTrack(t, media);
    }
  }
  // Remove exactly the senders whose track belongs to this media, nothing else.
  private removeLocalVideo(media: MediaStream | null): void {
    if (!media) return;
    const tracks = media.getTracks();
    for (const [, conn] of this.conns) {
      for (const sender of conn.pc.getSenders()) {
        if (sender.track && tracks.includes(sender.track)) {
          try {
            conn.pc.removeTrack(sender);
          } catch {
          }
        }
      }
    }
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
    for (const [key, v] of this.remoteVids) if (v.peerId === peerId) this.remoteVids.delete(key);
    this.analysers.delete(peerId);
    this.speaking.delete(peerId);
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
    this.remoteVids.clear();
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
    this.analysers.clear();
    this.speaking.clear();
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
    for (const media of [this.mic, this.camera, this.screen]) {
      if (media) for (const t of media.getTracks()) t.stop();
    }
    this.mic = null;
    this.camera = null;
    this.screen = null;
    this.inCall = false;
    this.muted = false;
    this.cameraOn = false;
    this.sharing = false;
    this.onChange();
  }

  callPeers(): CallPeerView[] {
    const out: CallPeerView[] = [];
    for (const [id, name] of this.names) {
      if (id === this.myId) continue;
      out.push({
        id,
        name,
        connected: this.conns.get(id)?.pc.connectionState === "connected",
        speaking: this.speaking.has(id),
      });
    }
    return out;
  }

  selfSpeaking(): boolean {
    return this.speaking.has("self");
  }

  // Local self-view: whichever of camera / screen you are sending.
  localVideo(): MediaStream | null {
    return this.camera ?? this.screen ?? null;
  }

  remoteVideos(): RemoteVideo[] {
    const out: RemoteVideo[] = [];
    for (const [key, v] of this.remoteVids) {
      out.push({ key, peerId: v.peerId, name: this.names.get(v.peerId) ?? "", stream: v.stream });
    }
    return out;
  }
}
