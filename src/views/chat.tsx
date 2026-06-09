"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { FilterPills } from "@/components/ui/FilterPills";
import { IconButton } from "@/components/ui/IconButton";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { mockChatMessages } from "@/lib/mock-data";
import { mockChatReports, mockChatModStats } from "@/lib/feature-data";
import { formatDate } from "@/lib/utils";
import { badgeDanger, badgeDefault, rowItem } from "@/lib/styles";
import { Flag, Trash2, Ban, Shield, MessageSquare, AlertCircle } from "lucide-react";
import type { ChatChannel } from "@/types";

const channels = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Amigos" },
];

const defaultWordList = ["spam", "hack", "cheat", "insulto"];

export default function ChatPage() {
  const [tab, setTab] = useState("messages");
  const [channel, setChannel] = useState<ChatChannel>("global");
  const [messages, setMessages] = useState(mockChatMessages);
  const [reports, setReports] = useState(mockChatReports);
  const [modStats] = useState(mockChatModStats);
  const [wordList, setWordList] = useState(defaultWordList);
  const [newWord, setNewWord] = useState("");
  const [globalChat, setGlobalChat] = useState(true);
  const [wordFilter, setWordFilter] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [autoMod, setAutoMod] = useState(true);
  const [linkBlock, setLinkBlock] = useState(true);

  const filtered = messages.filter((m) => m.channel === channel);
  const flaggedCount = messages.filter((m) => m.flagged).length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;

  const resolveReport = (id: string, action: "reviewed" | "action_taken") => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
  };

  const addWord = () => {
    const w = newWord.trim().toLowerCase();
    if (w && !wordList.includes(w)) {
      setWordList((prev) => [...prev, w]);
      setNewWord("");
    }
  };

  return (
    <>
      <Header title="Chat" description="Moderación inteligente, reportes y reglas automáticas" />

      <PageContent>
        <Tabs
          tabs={[
            { id: "messages", label: "Mensajes" },
            { id: "reports", label: `Reportes${pendingReports > 0 ? ` (${pendingReports})` : ""}` },
            { id: "automod", label: "Auto-mod" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "messages" && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard title="Filtrados hoy" value={modStats.messagesFiltered} icon={Shield} />
              <StatCard title="Spam bloqueado" value={modStats.spamBlocked} icon={AlertCircle} />
              <StatCard title="Usuarios muteados" value={modStats.usersMuted} icon={Ban} />
              <StatCard title="Acciones auto" value={modStats.autoActionsToday} icon={MessageSquare} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <FilterPills
                options={channels}
                active={channel}
                onChange={(id) => setChannel(id as ChatChannel)}
              />
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-soft)]">
                <span>{filtered.length} mensajes</span>
                {flaggedCount > 0 && (
                  <Badge className={badgeDanger}>
                    {flaggedCount} reportados
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{channel === "global" ? "Chat global" : "Chat entre amigos"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--color-muted)]">No hay mensajes</p>
                  ) : (
                    <div className="max-h-[480px] space-y-2 overflow-y-auto">
                      {filtered.map((msg) => (
                        <div
                          key={msg.id}
                          className={`${rowItem} ${msg.flagged ? "border-[var(--color-border)] bg-[var(--color-danger-bg)]" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <Avatar name={msg.senderName} size="sm" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm text-[var(--color-text)]">{msg.senderName}</p>
                                  {msg.flagged && (
                                    <Badge className={badgeDanger}>
                                      <Flag className="mr-1 h-3 w-3" strokeWidth={1.5} /> Reportado
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-[var(--color-text-soft)]">{msg.content}</p>
                                <p className="mt-1 text-[11px] text-[var(--color-muted)]">{formatDate(msg.timestamp)}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                              <IconButton label="Eliminar" onClick={() => setMessages((p) => p.filter((m) => m.id !== msg.id))}>
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </IconButton>
                              <IconButton label="Banear" onClick={() => alert(`Ban: ${msg.senderName}`)}>
                                <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </IconButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>En línea</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {["SteveCraft", "AlexMiner", "DiamondPro", "RedstoneKing"].map((name) => (
                      <div key={name} className={`flex items-center gap-2 ${rowItem} py-2`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                        <span className="text-sm text-[var(--color-text-soft)]">{name}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Configuración</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Toggle label="Chat global activo" checked={globalChat} onChange={setGlobalChat} />
                    <Toggle label="Filtro de palabras" checked={wordFilter} onChange={setWordFilter} />
                    <Toggle label="Slow mode (5s)" checked={slowMode} onChange={setSlowMode} />
                    <Toggle label="Solo premium" checked={premiumOnly} onChange={setPremiumOnly} />
                    <Toggle label="Auto-moderación" checked={autoMod} onChange={setAutoMod} />
                    <Toggle label="Bloquear links" checked={linkBlock} onChange={setLinkBlock} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {tab === "reports" && (
          <div className="space-y-2">
            {reports.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-muted)]">No hay reportes</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className={`${rowItem} ${report.status === "pending" ? "border-[var(--color-border)]" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-[var(--color-text)]">{report.reportedName}</p>
                        <Badge className={badgeDefault}>{report.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                        Reportado por {report.reporterName} · {report.reason}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{formatDate(report.timestamp)}</p>
                    </div>
                    {report.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => resolveReport(report.id, "reviewed")}>Revisar</Button>
                        <Button size="sm" onClick={() => resolveReport(report.id, "action_taken")}>Tomar acción</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "automod" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lista de palabras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva palabra…"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addWord()}
                  />
                  <Button onClick={addWord}>Añadir</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wordList.map((word) => (
                    <Badge key={word} className={badgeDefault}>
                      {word}
                      <button
                        type="button"
                        className="ml-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        onClick={() => setWordList((prev) => prev.filter((w) => w !== word))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reglas automáticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Toggle label="Detectar spam (3+ msgs/10s)" checked={true} onChange={() => {}} />
                <Toggle label="Caps lock excesivo" checked={true} onChange={() => {}} />
                <Toggle label="Menciones repetidas" checked={false} onChange={() => {}} />
                <Toggle label="Auto-mute tras 3 flags" checked={true} onChange={() => {}} />
                <Toggle label="Notificar Discord en críticos" checked={true} onChange={() => {}} />
              </CardContent>
            </Card>
          </div>
        )}
      </PageContent>
    </>
  );
}
