import { useEffect, useMemo, useRef, useState } from "react";
import { CallManager } from "../webrtc";
import { inviteLinks } from "./invite";

export interface RoomChatMessage {
  from: string;
  text: string;
  kind: "chat" | "prompt";
}

export interface RoomStageTile {
  key: string;
  peerId: string;
  name: string;
  connected: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}

export interface RoomEvent {
  type: string;
  [key: string]: unknown;
}

export interface UseRoomOptions {
  port: number;
  secure: boolean;
  active: boolean;
  sendSignal: (to: string, data: unknown) => void;
  sendChat: (text: string) => void;
}

export interface UseRoomResult {
  self: { id: string; name: string };
  participants: string[];
  chat: RoomChatMessage[];
  links: string[];
  call: {
    inCall: boolean;
    muted: boolean;
    cameraOn: boolean;
    sharing: boolean;
    error: string | null;
    selfSpeaking: boolean;
    selfVideo: MediaStream | null;
    remotes: RoomStageTile[];
  };
  actions: {
    join: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    toggleScreen: () => void;
    leave: () => void;
    sendChat: (text: string) => void;
  };
  handleEvent: (e: RoomEvent) => boolean;
}

export function useRoom(opts: UseRoomOptions): UseRoomResult {
  const callRef = useRef<CallManager | null>(null);
  const [, forceTick] = useState(0);
  const [selfId, setSelfId] = useState("");
  const [selfName, setSelfName] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [chat, setChat] = useState<RoomChatMessage[]>([]);
  const [joinToken, setJoinToken] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [addrPort, setAddrPort] = useState(opts.port);

  function call(): CallManager {
    if (!callRef.current) {
      callRef.current = new CallManager(opts.sendSignal, () => forceTick((n) => n + 1));
    }
    return callRef.current;
  }

  useEffect(() => {
    const scheme = opts.secure ? "https" : "http";
    fetch(`${scheme}://localhost:${opts.port}/room/addresses`)
      .then((r) => r.json())
      .then((d: { addresses?: string[]; port?: string | number }) => {
        setAddresses(Array.isArray(d.addresses) ? d.addresses : []);
        const p = Number(d.port);
        if (p) setAddrPort(p);
      })
      .catch(() => {});
  }, [opts.port, opts.secure]);

  useEffect(() => {
    if (!opts.active && callRef.current?.inCall) {
      callRef.current.leave();
    }
  }, [opts.active]);

  useEffect(() => {
    return () => {
      callRef.current?.leave();
    };
  }, []);

  function handleEvent(e: RoomEvent): boolean {
    switch (e.type) {
      case "room-welcome": {
        const peerId = String(e.peerId ?? "");
        setSelfId(peerId);
        setSelfName(String(e.you ?? ""));
        setParticipants(Array.isArray(e.participants) ? (e.participants as string[]) : []);
        setJoinToken(String(e.joinToken ?? ""));
        call().setSelf(peerId);
        call().setPeers(Array.isArray(e.peers) ? (e.peers as Array<{ id: string; name: string }>) : []);
        return true;
      }
      case "room-presence":
        setParticipants(Array.isArray(e.participants) ? (e.participants as string[]) : []);
        call().setPeers(Array.isArray(e.peers) ? (e.peers as Array<{ id: string; name: string }>) : []);
        return true;
      case "signal":
        void call().onSignal(String(e.from ?? ""), e.data as never);
        return true;
      case "peer-left":
        call().onPeerLeft(String(e.peerId ?? ""));
        return true;
      case "room-chat":
        setChat((prev) => [...prev, { from: String(e.from ?? "?"), text: String(e.text ?? ""), kind: "chat" }]);
        return true;
      case "room-prompt":
        setChat((prev) => [...prev, { from: String(e.from ?? "?"), text: String(e.text ?? ""), kind: "prompt" }]);
        return true;
      default:
        return false;
    }
  }

  const links = useMemo(
    () => inviteLinks({ addresses, port: addrPort, joinToken, secure: opts.secure }),
    [addresses, addrPort, joinToken, opts.secure],
  );

  const cm = callRef.current;
  const remotes: RoomStageTile[] = [];
  if (cm) {
    const peers = cm.callPeers();
    const videos = cm.remoteVideos();
    for (const p of peers) {
      const vids = videos.filter((v) => v.peerId === p.id);
      if (vids.length === 0) {
        remotes.push({ key: p.id, peerId: p.id, name: p.name, connected: p.connected, speaking: p.speaking, stream: null });
      } else {
        for (const v of vids) {
          remotes.push({ key: v.key, peerId: p.id, name: p.name, connected: p.connected, speaking: p.speaking, stream: v.stream });
        }
      }
    }
  }

  return {
    self: { id: selfId, name: selfName },
    participants,
    chat,
    links,
    call: {
      inCall: cm?.inCall ?? false,
      muted: cm?.muted ?? false,
      cameraOn: cm?.cameraOn ?? false,
      sharing: cm?.sharing ?? false,
      error: cm?.error ?? null,
      selfSpeaking: cm?.selfSpeaking() ?? false,
      selfVideo: cm?.localVideo() ?? null,
      remotes,
    },
    actions: {
      join: () => void call().joinVoice(),
      toggleMute: () => call().toggleMute(),
      toggleCamera: () => void call().toggleCamera(),
      toggleScreen: () => {
        const c = call();
        if (c.sharing) c.stopShare();
        else void c.shareScreen();
      },
      leave: () => call().leave(),
      sendChat: opts.sendChat,
    },
    handleEvent,
  };
}
