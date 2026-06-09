"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  buildWizardScript,
  COMPARE_OPS,
  ELEMENT_DIRECT_ACTIONS,
  THEN_ACTIONS,
  wizardModeOptions,
  type ElementDirectAction,
  type GlobalMode,
  type LeftSource,
  type ThenAction,
  type ValueSource,
  type WizardMode,
} from "@/lib/hub-script-wizard-data";

interface ScriptWizardProps {
  availableRefs: { refId: string; label: string }[];
  constants: Record<string, string | number | boolean>;
  currentRefId?: string;
  onInsert: (code: string) => void;
}

const VALUE_SOURCE_OPTS: { value: ValueSource; label: string }[] = [
  { value: "const", label: "Constante @" },
  { value: "number", label: "Número fijo" },
  { value: "ref", label: "Otro ref $" },
  { value: "global", label: "Variable global ~" },
  { value: "text", label: "Texto" },
  { value: "bool", label: "Sí / No" },
];

const LEFT_SOURCE_OPTS: { value: LeftSource; label: string }[] = [
  { value: "ref", label: "Valor de ref $" },
  { value: "global", label: "Variable global ~" },
  { value: "visible", label: "¿Este elemento visible?" },
];

function RefSelect({
  label,
  value,
  onChange,
  refs,
  fallback,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  refs: { refId: string; label: string }[];
  fallback: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={
        refs.length
          ? refs.map((r) => ({
              value: r.refId,
              label: r.label ? `$${r.refId} — ${r.label}` : `$${r.refId}`,
            }))
          : [{ value: fallback, label: `$${fallback}` }]
      }
    />
  );
}

function ActionFields({
  action,
  targetRef,
  setTargetRef,
  message,
  setMessage,
  globalKey,
  setGlobalKey,
  screenId,
  setScreenId,
  refs,
  fallbackRef,
  prefix,
}: {
  action: ThenAction;
  targetRef: string;
  setTargetRef: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  globalKey: string;
  setGlobalKey: (v: string) => void;
  screenId: string;
  setScreenId: (v: string) => void;
  refs: { refId: string; label: string }[];
  fallbackRef: string;
  prefix: string;
}) {
  const meta = THEN_ACTIONS.find((a) => a.value === action);
  if (!meta || action === "nada") return null;

  return (
    <div className="space-y-2 rounded border border-[var(--color-border-subtle)]/60 bg-[var(--color-bg)]/40 p-2">
      <p className="text-[9px] font-medium text-[var(--color-accent)]">{prefix}: {meta.label}</p>
      {meta.needsRef && (
        <RefSelect label="Elemento" value={targetRef} onChange={setTargetRef} refs={refs} fallback={fallbackRef} />
      )}
      {meta.needsGlobal && (
        <input
          value={globalKey}
          onChange={(e) => setGlobalKey(e.target.value)}
          placeholder="Nombre global (ej. visitas)"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
        />
      )}
      {action === "pantalla" && (
        <input
          value={screenId}
          onChange={(e) => setScreenId(e.target.value)}
          placeholder="ID pantalla (ej. screen-play)"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
        />
      )}
      {meta.needsText && action !== "pantalla" && (
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            action === "valor" || action === "global"
              ? "Valor numérico"
              : action === "texto"
                ? "Texto nuevo"
                : "Mensaje del aviso"
          }
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
        />
      )}
      {action === "avisa" && (
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensaje del aviso"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
        />
      )}
    </div>
  );
}

function ConditionBuilder({
  leftSource,
  setLeftSource,
  refA,
  setRefA,
  leftGlobal,
  setLeftGlobal,
  op,
  setOp,
  rightSource,
  setRightSource,
  constKey,
  setConstKey,
  numVal,
  setNumVal,
  refB,
  setRefB,
  rightGlobal,
  setRightGlobal,
  textVal,
  setTextVal,
  boolVal,
  setBoolVal,
  refs,
  constKeys,
  fallbackRef,
}: {
  leftSource: LeftSource;
  setLeftSource: (v: LeftSource) => void;
  refA: string;
  setRefA: (v: string) => void;
  leftGlobal: string;
  setLeftGlobal: (v: string) => void;
  op: string;
  setOp: (v: string) => void;
  rightSource: ValueSource;
  setRightSource: (v: ValueSource) => void;
  constKey: string;
  setConstKey: (v: string) => void;
  numVal: string;
  setNumVal: (v: string) => void;
  refB: string;
  setRefB: (v: string) => void;
  rightGlobal: string;
  setRightGlobal: (v: string) => void;
  textVal: string;
  setTextVal: (v: string) => void;
  boolVal: boolean;
  setBoolVal: (v: boolean) => void;
  refs: { refId: string; label: string }[];
  constKeys: string[];
  fallbackRef: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
      <p className="text-[9px] text-[var(--color-muted)]">Define la condición en lenguaje simple.</p>
      <div className={leftSource === "visible" ? "" : "grid grid-cols-2 gap-2"}>
        <Select
          label="Comparar"
          value={leftSource}
          onChange={(e) => setLeftSource(e.target.value as LeftSource)}
          options={LEFT_SOURCE_OPTS}
        />
        {leftSource !== "visible" && (
          <Select label="Operador" value={op} onChange={(e) => setOp(e.target.value)} options={[...COMPARE_OPS]} />
        )}
      </div>
      {leftSource === "ref" && (
        <RefSelect label="Ref izquierdo" value={refA} onChange={setRefA} refs={refs} fallback={fallbackRef} />
      )}
      {leftSource === "global" && (
        <input
          value={leftGlobal}
          onChange={(e) => setLeftGlobal(e.target.value)}
          placeholder="Global izquierda (ej. premium)"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
        />
      )}
      {leftSource !== "visible" && (
        <>
          <Select
            label="Con"
            value={rightSource}
            onChange={(e) => setRightSource(e.target.value as ValueSource)}
            options={VALUE_SOURCE_OPTS}
          />
          {rightSource === "const" && (
            <Select
              label="Constante"
              value={constKey}
              onChange={(e) => setConstKey(e.target.value)}
              options={
                constKeys.length
                  ? constKeys.map((k) => ({ value: k, label: `@${k}` }))
                  : [{ value: "GOAL", label: "@GOAL" }]
              }
            />
          )}
          {rightSource === "number" && (
            <input
              type="number"
              value={numVal}
              onChange={(e) => setNumVal(e.target.value)}
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              placeholder="10"
            />
          )}
          {rightSource === "ref" && (
            <RefSelect label="Otro ref" value={refB} onChange={setRefB} refs={refs} fallback={fallbackRef} />
          )}
          {rightSource === "global" && (
            <input
              value={rightGlobal}
              onChange={(e) => setRightGlobal(e.target.value)}
              placeholder="Global derecha"
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
            />
          )}
          {rightSource === "text" && (
            <input
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              placeholder='Texto (ej. "activo")'
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
            />
          )}
          {rightSource === "bool" && (
            <Select
              label="Valor"
              value={boolVal ? "true" : "false"}
              onChange={(e) => setBoolVal(e.target.value === "true")}
              options={[
                { value: "true", label: "Sí (true)" },
                { value: "false", label: "No (false)" },
              ]}
            />
          )}
        </>
      )}
      {leftSource === "visible" && (
        <Select
          label="¿Visible?"
          value={boolVal ? "true" : "false"}
          onChange={(e) => setBoolVal(e.target.value === "true")}
          options={[
            { value: "true", label: "Sí, está visible" },
            { value: "false", label: "No, está oculto" },
          ]}
        />
      )}
    </div>
  );
}

export function ScriptWizard({ availableRefs, constants, currentRefId, onInsert }: ScriptWizardProps) {
  const fallbackRef = currentRefId ?? availableRefs[0]?.refId ?? "contador1";
  const [mode, setMode] = useState<WizardMode>("si_entonces");

  const [leftSource, setLeftSource] = useState<LeftSource>("ref");
  const [refA, setRefA] = useState(fallbackRef);
  const [leftGlobal, setLeftGlobal] = useState("premium");
  const [op, setOp] = useState(">=");
  const [rightSource, setRightSource] = useState<ValueSource>("const");
  const [constKey, setConstKey] = useState(() => Object.keys(constants)[0] ?? "GOAL");
  const [numVal, setNumVal] = useState("10");
  const [refB, setRefB] = useState(fallbackRef);
  const [rightGlobal, setRightGlobal] = useState("visitas");
  const [textVal, setTextVal] = useState("");
  const [boolVal, setBoolVal] = useState(true);

  const [thenAction, setThenAction] = useState<ThenAction>("avisa");
  const [elseAction, setElseAction] = useState<ThenAction>("avisa");
  const [targetRef, setTargetRef] = useState(availableRefs[0]?.refId ?? "banner1");
  const [message, setMessage] = useState("Meta alcanzada");
  const [globalKey, setGlobalKey] = useState("visitas");
  const [screenId, setScreenId] = useState("screen-play");
  const [step, setStep] = useState("1");
  const [waitMs, setWaitMs] = useState("500");
  const [randomMin, setRandomMin] = useState("1");
  const [randomMax, setRandomMax] = useState("6");
  const [elementAction, setElementAction] = useState<ElementDirectAction>("mostrar");
  const [elementValue, setElementValue] = useState("0");
  const [globalMode, setGlobalMode] = useState<GlobalMode>("sumar");
  const [globalDelta, setGlobalDelta] = useState("1");

  const constKeys = useMemo(() => Object.keys(constants), [constants]);

  const preview = useMemo(
    () =>
      buildWizardScript({
        mode,
        leftSource,
        refA,
        leftGlobal,
        op: op as typeof COMPARE_OPS[number]["value"],
        rightSource,
        constKey,
        numVal,
        refB,
        rightGlobal,
        textVal,
        boolVal,
        thenAction,
        elseAction,
        targetRef,
        message,
        globalKey,
        screenId,
        step,
        waitMs,
        randomMin,
        randomMax,
        elementAction,
        elementValue,
        globalMode,
        globalDelta,
      }),
    [
      mode,
      leftSource,
      refA,
      leftGlobal,
      op,
      rightSource,
      constKey,
      numVal,
      refB,
      rightGlobal,
      textVal,
      boolVal,
      thenAction,
      elseAction,
      targetRef,
      message,
      globalKey,
      screenId,
      step,
      waitMs,
      randomMin,
      randomMax,
      elementAction,
      elementValue,
      globalMode,
      globalDelta,
    ]
  );

  const needsCondition = mode === "si_entonces" || mode === "si_sino" || mode === "validar";
  const needsThen = mode === "si_entonces" || mode === "si_sino" || mode === "esperar";

  return (
    <details className="rounded-lg border border-[var(--color-accent-muted)]/40 bg-[var(--color-accent-soft)]/20 px-3 py-2">
      <summary className="cursor-pointer text-[10px] font-medium text-[var(--color-accent)]">
        Asistente — combina condiciones y acciones sin código
      </summary>

      <div className="mt-3 space-y-3">
        <Select
          label="Receta"
          value={mode}
          onChange={(e) => setMode(e.target.value as WizardMode)}
          options={wizardModeOptions()}
        />

        {needsCondition && (
          <ConditionBuilder
            leftSource={leftSource}
            setLeftSource={setLeftSource}
            refA={refA}
            setRefA={setRefA}
            leftGlobal={leftGlobal}
            setLeftGlobal={setLeftGlobal}
            op={op}
            setOp={setOp}
            rightSource={rightSource}
            setRightSource={setRightSource}
            constKey={constKey}
            setConstKey={setConstKey}
            numVal={numVal}
            setNumVal={setNumVal}
            refB={refB}
            setRefB={setRefB}
            rightGlobal={rightGlobal}
            setRightGlobal={setRightGlobal}
            textVal={textVal}
            setTextVal={setTextVal}
            boolVal={boolVal}
            setBoolVal={setBoolVal}
            refs={availableRefs}
            constKeys={constKeys}
            fallbackRef={fallbackRef}
          />
        )}

        {needsThen && (
          <>
            <Select
              label="Entonces"
              value={thenAction}
              onChange={(e) => setThenAction(e.target.value as ThenAction)}
              options={THEN_ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
            />
            <ActionFields
              action={thenAction}
              targetRef={targetRef}
              setTargetRef={setTargetRef}
              message={message}
              setMessage={setMessage}
              globalKey={globalKey}
              setGlobalKey={setGlobalKey}
              screenId={screenId}
              setScreenId={setScreenId}
              refs={availableRefs}
              fallbackRef={fallbackRef}
              prefix="Entonces"
            />
          </>
        )}

        {mode === "si_sino" && (
          <>
            <Select
              label="Si no se cumple"
              value={elseAction}
              onChange={(e) => setElseAction(e.target.value as ThenAction)}
              options={THEN_ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
            />
            <ActionFields
              action={elseAction}
              targetRef={targetRef}
              setTargetRef={setTargetRef}
              message={message}
              setMessage={setMessage}
              globalKey={globalKey}
              setGlobalKey={setGlobalKey}
              screenId={screenId}
              setScreenId={setScreenId}
              refs={availableRefs}
              fallbackRef={fallbackRef}
              prefix="Sino"
            />
          </>
        )}

        {mode === "elemento" && (
          <div className="space-y-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
            <RefSelect label="Elemento" value={targetRef} onChange={setTargetRef} refs={availableRefs} fallback={fallbackRef} />
            <Select
              label="Acción"
              value={elementAction}
              onChange={(e) => setElementAction(e.target.value as ElementDirectAction)}
              options={[...ELEMENT_DIRECT_ACTIONS]}
            />
            {(elementAction === "valor" || elementAction === "texto") && (
              <input
                value={elementValue}
                onChange={(e) => setElementValue(e.target.value)}
                placeholder={elementAction === "valor" ? "Valor numérico" : "Texto nuevo"}
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              />
            )}
          </div>
        )}

        {mode === "contador" && (
          <div className="space-y-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
            <input
              type="number"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              placeholder="Cuánto sumar (1)"
            />
            <p className="text-[9px] text-[var(--color-muted)]">Suma al contador interno y actualiza la etiqueta.</p>
          </div>
        )}

        {mode === "global" && (
          <div className="space-y-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
            <Select
              label="Qué hacer"
              value={globalMode}
              onChange={(e) => setGlobalMode(e.target.value as GlobalMode)}
              options={[
                { value: "leer", label: "Leer y avisar valor" },
                { value: "sumar", label: "Sumar a la global" },
                { value: "guardar", label: "Guardar valor fijo" },
              ]}
            />
            <input
              value={globalKey}
              onChange={(e) => setGlobalKey(e.target.value)}
              placeholder="Nombre ~global"
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
            />
            {globalMode === "sumar" && (
              <input
                type="number"
                value={globalDelta}
                onChange={(e) => setGlobalDelta(e.target.value)}
                placeholder="Cuánto sumar"
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              />
            )}
            {globalMode === "guardar" && (
              <input
                value={elementValue}
                onChange={(e) => setElementValue(e.target.value)}
                placeholder="Valor a guardar"
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
              />
            )}
          </div>
        )}

        {mode === "visita" && (
          <p className="text-[9px] text-[var(--color-muted)]">
            Suma 1 a <span className="font-mono">~visitas</span> y muestra un aviso con el total.
          </p>
        )}

        {mode === "esperar" && (
          <input
            type="number"
            value={waitMs}
            onChange={(e) => setWaitMs(e.target.value)}
            placeholder="Milisegundos (500)"
            className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
          />
        )}

        {mode === "aleatorio" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={randomMin}
              onChange={(e) => setRandomMin(e.target.value)}
              placeholder="Mín"
              className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
            />
            <input
              type="number"
              value={randomMax}
              onChange={(e) => setRandomMax(e.target.value)}
              placeholder="Máx"
              className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
            />
          </div>
        )}

        {mode === "pantalla" && (
          <input
            value={screenId}
            onChange={(e) => setScreenId(e.target.value)}
            placeholder="ID pantalla (screen-play)"
            className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px]"
          />
        )}

        {mode === "validar" && (
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mensaje si falla la validación"
            className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
          />
        )}

        <div className="rounded-md border border-[var(--color-border-subtle)] bg-[#0a0c0f] p-2">
          <p className="text-[9px] text-[var(--color-muted)]">Vista previa</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[#a8c4a0]">{preview}</pre>
        </div>

        <Button size="sm" variant="secondary" className="w-full" onClick={() => onInsert(preview)}>
          Insertar en el script
        </Button>
      </div>
    </details>
  );
}
