import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, User, Bot } from "lucide-react";
import type { ChatMessage, AiAgent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";

export default function Chat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
  });

  const { data: agents } = useQuery<AiAgent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map(agents?.map(a => [a.id, a]) ?? []);
  const masterAgent = agents?.find(a => a.type === "master");

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", {
        role: "user",
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-activities"] });
      setInput("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input.trim());
  };

  const suggestedQueries = [
    "What's the current security status?",
    "Show me open incidents",
    "Show me the BCP & DRP status",
    "What's our business impact analysis?",
    "Any upcoming drills or exercises?",
    "Give me a system overview",
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight" data-testid="text-chat-title">AI Master Agent</h1>
            <p className="text-xs text-muted-foreground">Coordinating all specialist agents</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-md" />
                ))}
              </div>
            ) : !messages?.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-2" data-testid="text-chat-welcome">Welcome to the AI Master</h2>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  I coordinate all specialized AI agents across your SIEM & ITSM platform.
                  Ask me about security, incidents, service requests, system health,
                  business continuity, disaster recovery, impact analysis, risk register, drills, or reviews.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {suggestedQueries.map((q, i) => (
                    <Card
                      key={i}
                      className="cursor-pointer hover-elevate"
                      onClick={() => {
                        setInput(q);
                      }}
                      data-testid={`button-suggestion-${i}`}
                    >
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{q}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => {
                const isUser = msg.role === "user";
                const agent = msg.agentId ? agentMap.get(msg.agentId) : masterAgent;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    data-testid={`chat-message-${msg.id}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isUser ? "bg-secondary" : "bg-primary"}`}>
                      {isUser ? (
                        <User className="h-4 w-4 text-secondary-foreground" />
                      ) : (
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      )}
                    </div>
                    <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {isUser ? "You" : agent?.name ?? "AI Master"}
                        </span>
                        {msg.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <Card className={isUser ? "bg-primary text-primary-foreground" : ""}>
                        <CardContent className="p-3">
                          <div className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:my-2 [&_th]:px-2 [&_td]:px-2 [&_strong]:font-semibold">
                            {renderMarkdown(msg.content)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })
            )}
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-6 pt-3 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI Master anything..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sendMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("| ") && i + 1 < lines.length && lines[i + 1]?.includes("---")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const headers = tableLines[0].split("|").filter(Boolean).map(s => s.trim());
      const rows = tableLines.slice(2).map(r => r.split("|").filter(Boolean).map(s => s.trim()));

      elements.push(
        <div key={i} className="overflow-x-auto my-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {headers.map((h, hi) => (
                <th key={hi} className="text-xs font-semibold border-b border-border px-2 py-1.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="text-xs border-b border-border/50 px-2 py-1.5">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        listItems.push(lines[i].substring(2));
        i++;
      }
      elements.push(
        <ul key={`list-${i}`} className="list-disc list-inside space-y-0.5 my-1">
          {listItems.map((item, li) => (
            <li key={li} className="text-sm">{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm">{renderInline(line)}</p>
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
