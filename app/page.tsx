"use client";

import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileDown, FileUp, PenLine, Printer, RotateCcw, ShieldCheck, Users } from "lucide-react";
import Image from "next/image";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CertificateData = {
  names: string; course: string; workload: string; validity: string; startDate: string; endDate: string;
  city: string; issueDate: string; commander: string; commanderRole: string; signatureImage: string;
};

type Participant = {
  name: string;
  cpf: string;
  registration: string;
  category: string;
};

const INITIAL_DATA: CertificateData = {
  names: "", course: "Curso Especializado para Condutores de Veículos de Transporte de Emergência", workload: "80", validity: "5",
  startDate: "2026-08-03", endDate: "2026-08-26", city: "Brasília-DF", issueDate: "2026-08-26",
  commander: "Cel. Ex. Nome do Comandante", commanderRole: "Comandante da Base Administrativa do QGEx", signatureImage: "",
};

const cleanCell = (value = "") => value.replace(/^\s*["']|["']\s*$/g, "").trim();

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value.trim();
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const parseParticipantLine = (line: string): Participant => {
  const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  const [name = "", cpf = "", registration = "", category = ""] = line.split(delimiter).map(cleanCell);
  return { name, cpf: formatCpf(cpf), registration, category };
};

const parseParticipants = (value: string) => value
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map(parseParticipantLine)
  .filter((participant) => participant.name);

const normalizeHeader = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const HEADER_ALIASES = {
  name: ["nome", "nome completo", "name", "participante"],
  cpf: ["cpf"],
  registration: ["registro", "n registro", "numero registro", "registro cnh", "registro da cnh", "n registro cnh", "n registro da cnh", "numero registro cnh", "numero registro da cnh", "numero da cnh"],
  category: ["categoria", "cat", "categoria cnh", "categoria da cnh"],
} as const;

const findHeaderIndex = (headers: unknown[], aliases: readonly string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => {
    const normalizedHeader = normalizeHeader(header);
    return normalizedAliases.some((alias) => normalizedHeader === alias || normalizedHeader.includes(alias));
  });
};

const rowsToParticipants = (rows: unknown[][]): Participant[] => {
  const populatedRows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!populatedRows.length) return [];

  const indexesFor = (row: unknown[]) => ({
    name: findHeaderIndex(row, HEADER_ALIASES.name),
    cpf: findHeaderIndex(row, HEADER_ALIASES.cpf),
    registration: findHeaderIndex(row, HEADER_ALIASES.registration),
    category: findHeaderIndex(row, HEADER_ALIASES.category),
  });
  const headerRowIndex = populatedRows.findIndex((row) => {
    const candidate = indexesFor(row);
    const recognizedColumns = Object.values(candidate).filter((index) => index >= 0).length;
    return candidate.name >= 0 && recognizedColumns >= 2;
  });
  const hasHeader = headerRowIndex >= 0;
  const indexes = hasHeader ? indexesFor(populatedRows[headerRowIndex]) : {
    name: -1,
    cpf: -1,
    registration: -1,
    category: -1,
  };
  const dataRows = hasHeader ? populatedRows.slice(headerRowIndex + 1) : populatedRows;

  return dataRows.map((row) => {
    const read = (index: number, fallback: number) => cleanCell(String(row[index >= 0 ? index : hasHeader ? -1 : fallback] ?? ""));
    return {
      name: read(indexes.name, 0),
      cpf: formatCpf(read(indexes.cpf, 1)),
      registration: read(indexes.registration, 2),
      category: read(indexes.category, 3),
    };
  }).filter((participant) => participant.name && Boolean(participant.cpf || participant.registration || participant.category));
};

const recordsToParticipants = (records: Record<string, unknown>[]): Participant[] => records.map((record) => {
  const entries = Object.entries(record);
  const read = (aliases: readonly string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    const match = entries.find(([key]) => normalizedAliases.includes(normalizeHeader(key)));
    return cleanCell(String(match?.[1] ?? ""));
  };
  return {
    name: read(HEADER_ALIASES.name),
    cpf: formatCpf(read(HEADER_ALIASES.cpf)),
    registration: read(HEADER_ALIASES.registration),
    category: read(HEADER_ALIASES.category),
  };
}).filter((participant) => participant.name && Boolean(participant.cpf || participant.registration || participant.category));

const ptDate = (value: string) => {
  if (!value) return "___/___/______";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const longDate = (value: string) => {
  if (!value) return "____ de __________ de ______";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
};

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    context.strokeStyle = "#172039";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    drawingRef.current = true;
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    event.preventDefault();
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const finishDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  const importSignature = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="signature-tool">
      <div className="signature-tool-heading"><PenLine /><div><strong>Assinatura digital</strong><span>Assine no quadro ou importe uma assinatura escaneada.</span></div></div>
      <canvas ref={canvasRef} width={800} height={220} className="signature-canvas" aria-label="Área para desenhar a assinatura" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
      <div className="signature-actions">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={importSignature} hidden />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp /> Importar assinatura</Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearSignature}><RotateCcw /> Limpar assinatura</Button>
        {value && <span className="signature-ready"><CheckCircle2 /> Assinatura pronta</span>}
      </div>
    </div>
  );
}

function Certificate({ participant, data }: { participant: Participant; data: CertificateData }) {
  const name = participant.name || "Nome do(a) concluinte";
  const validity = data.validity.trim();
  return (
    <article className="certificate-sheet" aria-label={`Certificado de ${name}`}>
      <div className="certificate-frame">
        <span className="corner corner-tl" aria-hidden="true" /><span className="corner corner-tr" aria-hidden="true" />
        <span className="corner corner-bl" aria-hidden="true" /><span className="corner corner-br" aria-hidden="true" />
        <header className="certificate-header">
          <Image src="/segexsf.png" alt="Brasão da SGEx" width={400} height={476} className="coat coat-left" priority unoptimized />
          <div className="certificate-heading">
            <p className="army-label">Exército Brasileiro</p>
            <p className="army-unit">Secretaria-Geral do Exército</p>
            <h2>CERTIFICADO</h2>
            <div className="heading-rule" aria-hidden="true"><span /></div>
          </div>
          <Image src="/badmqgex2.png" alt="Brasão da Base Administrativa do QGEx" width={512} height={512} className="coat coat-right" priority unoptimized />
        </header>
        <section className="certificate-body">
          <p>A <strong>Base Administrativa do Quartel-General do Exército</strong> certifica que</p>
          <h3>{name}</h3>
          <p className="certificate-statement">
            inscrito(a) no CPF nº <strong>{participant.cpf || "Não informado"}</strong> e no Nº REGISTRO{" "}
            <strong>{participant.registration || "Não informado"}</strong>, categoria CAT{" "}
            <strong>{participant.category || "Não informada"}</strong>, concluiu com aproveitamento o curso de{" "}
            <strong>{data.course}</strong>, realizado no período de{" "}
            <strong>{ptDate(data.startDate)}</strong> a <strong>{ptDate(data.endDate)}</strong>, com carga horária total de{" "}
            <strong>{data.workload || "___"} horas</strong>
            {validity && <>, com validade de <strong>{validity} {validity === "1" ? "ano" : "anos"}</strong></>}.
          </p>
          <p className="issue-line">{data.city}, {longDate(data.issueDate)}.</p>
        </section>
        <footer className="certificate-footer">
          <div className="signature">
            <div className="signature-art">{data.signatureImage && <Image src={data.signatureImage} alt="Assinatura digital do responsável" width={500} height={150} className="signature-image" unoptimized />}</div><div className="signature-line" />
            <strong>{data.commander || "Nome do comandante"}</strong><small>{data.commanderRole || "Função"}</small>
          </div>
          <div className="certificate-code"><span>SGEX • BADMQGEX</span></div>
        </footer>
      </div>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<CertificateData>(INITIAL_DATA);
  const [generatedParticipants, setGeneratedParticipants] = useState<Participant[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [message, setMessage] = useState("Preencha os nomes ou importe uma lista.");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [throughput, setThroughput] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const generationStartRef = useRef<number | null>(null);
  const typedParticipants = useMemo(() => parseParticipants(data.names), [data.names]);
  const previewParticipants = generatedParticipants.length ? generatedParticipants : typedParticipants;
  const previewParticipant = previewParticipants[previewIndex] || { name: "Nome do(a) concluinte", cpf: "", registration: "", category: "" };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!generatedParticipants.length || generationStartRef.current === null) return;
    const startedAt = generationStartRef.current;
    const frame = window.requestAnimationFrame(() => {
      const duration = Math.max(1, performance.now() - startedAt);
      const rate = Math.round((generatedParticipants.length * 1000) / duration);
      setElapsed(Math.round(duration));
      setThroughput(rate);
      setMessage(
        `${generatedParticipants.length} certificado${generatedParticipants.length > 1 ? "s" : ""} pronto${generatedParticipants.length > 1 ? "s" : ""}. ` +
        (rate >= 15 ? "Requisito mínimo de 15 certificados/s atendido." : "Desempenho abaixo de 15 certificados/s neste dispositivo."),
      );
      generationStartRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [generatedParticipants]);

  const update = (field: keyof CertificateData, value: string) => {
    setData((current) => ({ ...current, [field]: value }));
    if (field === "names") {
      setGeneratedParticipants([]);
      setPreviewIndex(0);
      setElapsed(null);
      setThroughput(null);
    }
  };

  const generate = () => {
    if (!typedParticipants.length) { setMessage("Adicione pelo menos um participante para gerar os certificados."); setElapsed(null); setThroughput(null); return false; }
    generationStartRef.current = performance.now();
    setMessage("Gerando certificados e medindo o desempenho...");
    setElapsed(null);
    setThroughput(null);
    setGeneratedParticipants(typedParticipants); setPreviewIndex(0);
    return true;
  };

  const printCertificates = () => {
    const ready = generatedParticipants.length > 0 || generate();
    if (ready) window.setTimeout(() => window.print(), 120);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let participants: Participant[] = [];

      if (extension === "json") {
        const json = JSON.parse(await file.text()) as unknown;
        if (Array.isArray(json) && json.every((item) => Array.isArray(item))) {
          participants = rowsToParticipants(json as unknown[][]);
        } else if (Array.isArray(json) && json.every((item) => item && typeof item === "object")) {
          participants = recordsToParticipants(json as Record<string, unknown>[]);
        }
      } else if (["xlsx", "xls", "csv", "txt", "tsv"].includes(extension ?? "")) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "", raw: false });
        participants = rowsToParticipants(rows);
      }

      if (!participants.length) throw new Error("Nenhum participante reconhecido");

      const serialized = participants.map(({ name, cpf, registration, category }) => [name, cpf, registration, category].join(";")).join("\n");
      setData((current) => ({ ...current, names: serialized }));
      setGeneratedParticipants([]); setPreviewIndex(0); setElapsed(null); setThroughput(null);
      setMessage(`${participants.length} participante${participants.length !== 1 ? "s" : ""} importado${participants.length !== 1 ? "s" : ""} de ${file.name}.`);
    } catch {
      setMessage("Não foi possível ler esse arquivo. Use Excel, CSV, TXT, TSV ou JSON com Nome, CPF, Registro da CNH e Categoria da CNH.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><ShieldCheck /></div><div><span>SGEx • BADMQGEX</span><h1>Gerador de Certificados</h1></div></div>
      </header>
      <div className="workspace">
        <section className="editor-panel" aria-labelledby="form-title">
          <div className="panel-heading"><div><span className="eyebrow">Dados do documento</span><h2 id="form-title">Configure uma vez, gere em massa</h2></div></div>
          <div className="form-section participants-section">
            <div className="section-title"><Users /><div><strong>Participantes</strong><span>Nome; CPF; Nº REGISTRO; CAT • sem limite fixo</span></div><span className="counter">{typedParticipants.length} participante{typedParticipants.length !== 1 ? "s" : ""}</span></div>
            <Label htmlFor="names" className="sr-only">Dados dos participantes</Label>
            <Textarea id="names" value={data.names} onChange={(e) => update("names", e.target.value)} placeholder={"Maria da Silva;123.456.789-00;REG-001;A\nJoão dos Santos;987.654.321-00;REG-002;B"} className="names-field" />
            <p className="participant-format"><strong>Formato:</strong> um participante por linha, separando os quatro dados por ponto e vírgula.</p>
            <div className="inline-actions">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv,.json" onChange={importFile} hidden />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp /> Importar arquivo</Button>
            </div>
          </div>
          <div className="form-section">
            <div className="field full-field"><Label htmlFor="course">Nome do curso</Label><Input id="course" value={data.course} onChange={(e) => update("course", e.target.value)} /></div>
            <div className="field-grid four-columns">
              <div className="field"><Label htmlFor="workload">Carga horária</Label><div className="input-suffix"><Input id="workload" inputMode="numeric" value={data.workload} onChange={(e) => update("workload", e.target.value.replace(/\D/g, ""))} /><span>h</span></div></div>
              <div className="field"><Label htmlFor="validity">Validade</Label><div className="input-suffix"><Input id="validity" inputMode="numeric" value={data.validity} onChange={(e) => update("validity", e.target.value.replace(/\D/g, ""))} /><span>anos</span></div></div>
              <div className="field"><Label htmlFor="startDate">Início</Label><Input id="startDate" type="date" value={data.startDate} onChange={(e) => update("startDate", e.target.value)} /></div>
              <div className="field"><Label htmlFor="endDate">Término</Label><Input id="endDate" type="date" value={data.endDate} onChange={(e) => update("endDate", e.target.value)} /></div>
            </div>
            <div className="field-grid two-columns">
              <div className="field"><Label htmlFor="city">Local</Label><Input id="city" value={data.city} onChange={(e) => update("city", e.target.value)} /></div>
              <div className="field"><Label htmlFor="issueDate">Data de emissão</Label><Input id="issueDate" type="date" value={data.issueDate} onChange={(e) => update("issueDate", e.target.value)} /></div>
            </div>
          </div>
          <details className="signature-details"><summary>Assinatura e responsável</summary><div className="field-grid two-columns details-grid"><div className="field"><Label htmlFor="commander">Nome</Label><Input id="commander" value={data.commander} onChange={(e) => update("commander", e.target.value)} /></div><div className="field"><Label htmlFor="commanderRole">Função</Label><Input id="commanderRole" value={data.commanderRole} onChange={(e) => update("commanderRole", e.target.value)} /></div></div><SignaturePad value={data.signatureImage} onChange={(signature) => update("signatureImage", signature)} /></details>
          <div className="status-line" role="status">{throughput !== null && throughput >= 15 ? <CheckCircle2 className="success-icon" /> : <Clock3 />}<span>{message}</span>{elapsed !== null && throughput !== null && <strong>{elapsed} ms • {throughput} cert./s</strong>}</div>
          <div className="primary-actions"><Button variant="outline" onClick={generate}>Atualizar prévia</Button><Button className="generate-button" onClick={printCertificates}><Printer /> Gerar e imprimir todos</Button></div>
          <p className="print-help"><FileDown /> Os dados são processados apenas neste dispositivo. Na impressão, selecione “Salvar como PDF” para obter um único arquivo.</p>
        </section>
        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="preview-toolbar"><div><span className="eyebrow">Prévia em tempo real</span><h2 id="preview-title">Certificado {previewParticipants.length ? `${previewIndex + 1} de ${previewParticipants.length}` : "demonstrativo"}</h2></div><div className="preview-nav"><Button variant="outline" size="icon" aria-label="Certificado anterior" disabled={previewIndex === 0} onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Próximo certificado" disabled={!previewParticipants.length || previewIndex >= previewParticipants.length - 1} onClick={() => setPreviewIndex((index) => Math.min(previewParticipants.length - 1, index + 1))}><ChevronRight /></Button></div></div>
          <div className="certificate-stage"><Certificate participant={previewParticipant} data={data} /></div>
          <div className="preview-note"><ShieldCheck /> Layout A4 horizontal, pronto para impressão em alta qualidade.</div>
        </section>
      </div>
      <section className="print-stack" aria-hidden="true">{(generatedParticipants.length ? generatedParticipants : typedParticipants).map((participant, index) => <Certificate key={`${participant.name}-${participant.registration}-${index}`} participant={participant} data={data} />)}</section>
    </main>
  );
}
