import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Microphone, Speaker } from "@/lib/audio"
import { BACKEND_WS_URL } from "@/lib/config";
import { toast } from "sonner";
import { Bot, User, PhoneOff, Loader2 } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
import { Button } from "./ui/button";

type Status = "connecting" | "live" | "ending";

export function Interview() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [ status, setStatus ] = useState<Status>("connecting");
  const [ aiLevel, setAiLevel ] = useState(0);
  const [ userLevel, setUserLevel ] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    const mic = new Microphone();
    const speaker = new Speaker();

    const socket = new WebSocket(`${BACKEND_WS_URL}/ws/interview/${interviewId}`);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    socket.onopen = async () => {
      try {
        await speaker.resume();
        await mic.start((pcm) => {
          if(socket.readyState === WebSocket.OPEN) socket.send(pcm);
        });
        if(!cancelled) socket.send(JSON.stringify({ type: "start" }));
      } catch {
        toast("Mic access required for interview.");
        navigate("/");
      }
    };
    socket.onmessage = (event) => {
      if(event.data instanceof ArrayBuffer) {
        speaker.play(event.data);
        return;
      }

      const message = JSON.parse(event.data);
      if(message.type === "ready") setStatus("live");
      else if(message.type === "interrupted") speaker.interrupt();
      else if(message.type === "ended") navigate(`/result/${interviewId}`);
      else if(message.type === "error"){
        toast(message.message);
        navigate("/");
      }
    };

    let ended = false;

    socket.onclose = (event) => {
      if(cancelled || ended) return;
      if(socketRef.current !== socket) return;
      toast("Connection to the interviewer was lost.");
      navigate(`/result/${interviewId}`);
    };

    const tick = () => {
      setAiLevel(speaker.level());
      setUserLevel(mic.level());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      socket.close();
      mic.stop();
      speaker.stop();
    };
  }, [interviewId, navigate]);

  function endInterview() {
    setStatus("ending");
    socketRef.current?.send(JSON.stringify({ type: "end" }));
  }

  const aiSpeaking = aiLevel > 0.06 && aiLevel >= userLevel;
  const userSpeaking = userLevel > 0.06 && userLevel >= aiLevel;

  return(
    <main className = "flex h-screen w-screen flex-col items-center justify-center gap-12 px-6">
      <p className="text-sm font-medium text-muted-foreground">
        {status === "connecting" && "Connecting..."}
        {status === "live" && "Interview live"}
        {status === "ending" && "Wrapping up..."}
      </p>

      { status === "connecting" ? (
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex items-center justify-center gap-12 sm:gap-24">
          <VoiceOrb
            level={aiLevel}
            speaking={aiSpeaking}
            label="Interviewer"
            sublabel="Listening"
            icon={Bot}
            accent="pink"
          />
          <VoiceOrb
            level={userLevel}
            speaking={userSpeaking}
            label="You"
            sublabel="Mic on"
            icon={User}
            accent="emerald"
          />
        </div>
      )}

      <Button
        variant="destructive"
        size="lg"
        onClick={endInterview}
        disabled={status !== "live"}
        className="gap-2 rounded-full px-6"
      >
        {status === "ending" ? (
          <Loader2 className="size-4 animate-spin"/>
        ): (
          <PhoneOff className="size-4"/>
        )}
        End Interview
      </Button>
    </main>
  );
}
