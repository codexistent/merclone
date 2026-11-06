import { cn } from "@/lib/utils";
import { BACKEND_URL } from "@/lib/config";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Bot, User, PhoneOff, Loader2, Sparkles } from "lucide-react";
import axios from "axios";

interface ResultData {
  transcript: { type: "Assistant" | "User"; content: string; createdAt: string }[];
  score: number | null,
  feedback: string | null,
  status: "Pre" | "InProgress" | "Grading" | "Done" | "Failed";
}

const POLL_MS = 2000;

export function Result(){
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [ result, setResult ] = useState<ResultData>({
    score: null,
    feedback: null,
    transcript: [],
    status: "Pre"
  });
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // fetch interview results
    const poll = async() => {
      try {
        const { data } = await axios.get<ResultData>(`${BACKEND_URL}/api/v1/${interviewId}`);
        if(cancelled) return;

        setResult(data);

        if(data.status === "Done" || data.status === "Failed") return;
      } catch(error){
        if(cancelled) return;
        if(axios.isAxiosError(error) && error.response?.status === 404){
          setNotFound(true);
          return;
        }

        console.log("Failed to fetch result:", error);
      }
      timeoutId = setTimeout(poll, POLL_MS);
    };

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [interviewId]);

  const ready = result.status === "Done";
  const failed = result.status === "Failed";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-light">Interview Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your feedback and full conversation transcript.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          New interview
        </Button>
      </header>

      {notFound ? (
        <p className="rounded-xl border border-border bg-card/50 py-24 text-center text-sm">
          Interview could not be found.
        </p>
      ) : failed ? (
        <p className="rounded-xl border border-border bg-card/50 py-24 text-center text-sm">
          Interview could not be graded. Your transcript was saved.
        </p>
      ) : !ready ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/50 py-24 text-center">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
          <div>
            <p className="font-medium">Analysing your interview...</p>
            <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* score + feedback */}
          <section className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="size-4 text-violet-400" />
                Feedback
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">
                {result.score ?? "-"}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {result.feedback ?? "No feedback was generated."}
            </p>
          </section>

          {/* transcript */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Transcript
            </h2>
            <div className="flex flex-col gap-4">
              {result.transcript.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No messages were recorded for this interview.
                </p>
              )}

              {result.transcript.map((m,i) => {
                const isAi = m.type === "Assistant";
                return (
                  <div key={i} className={cn("flex gap-3", isAi ? "justify-start" : "flex-row-reverse")}>
                    <div className={cn("grid size-8 shrink-0 place-items-center rounded-full text-white", 
                      isAi ? "bg-gradient-to-br from-pink-400 to-rose-600"
                        : "bg-gradient-to-br from-emerald-300 to-teal-600"
                    )}>
                      { isAi ? (
                        <Bot className="size-4" />
                      ) : ( 
                        <User className="size-4" />
                      )}
                    </div>
                    <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      isAi ? "rounded-tl-sm bg-card text-foreground"
                        : "rounded-tr-sm bg-card text-primary-foreground"
                    )}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}