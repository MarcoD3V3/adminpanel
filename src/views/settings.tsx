"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";

export default function SettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(true);
  const [hwid, setHwid] = useState(false);
  const [anticheat, setAnticheat] = useState(true);

  return (
    <>
      <Header title="Configuración" description="API, auth y seguridad" />

      <PageContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>API / WebSocket</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="URL del API" defaultValue="https://api.craftlauncher.com" />
              <Input label="WebSocket" defaultValue="wss://ws.craftlauncher.com" />
              <Input label="Versión mínima" defaultValue="1.2.0" />
              <Button>Guardar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Microsoft OAuth</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Client ID" type="password" defaultValue="••••••••••••••••" />
              <Input label="Redirect URI" defaultValue="http://localhost:3000/auth/callback" />
              <Select
                label="Modo"
                defaultValue="microsoft"
                options={[
                  { value: "microsoft", label: "Microsoft (Premium)" },
                  { value: "offline", label: "Offline" },
                ]}
              />
              <Button variant="outline">Regenerar secret</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Seguridad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Toggle label="Modo mantenimiento" checked={maintenance} onChange={setMaintenance} />
              <Toggle label="Update obligatorio" checked={forceUpdate} onChange={setForceUpdate} />
              <Toggle label="Verificar HWID" checked={hwid} onChange={setHwid} />
              <Toggle label="Anti-cheat" checked={anticheat} onChange={setAnticheat} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Base de datos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Tipo" defaultValue="PostgreSQL" disabled />
              <Input label="Connection string" type="password" defaultValue="postgresql://..." />
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Test</Button>
                <Button variant="outline" size="sm">Backup</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
