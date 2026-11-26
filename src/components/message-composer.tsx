"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Copy, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, CloseButton, Dialog, inputCls } from "./ui";
import { CHANNEL_LABEL } from "@/lib/labels";
import { OFFERS, detailFrom, fillTemplate, pickTemplate, type OfferId } from "@/lib/message";
import { instagramUrl, telHref } from "@/lib/normalize";
import type { Channel, Prospect, Template, Tone } from "@/lib/types";

const CHANNELS: Channel[] = ["instagram", "email", "linkedin", "phone", "visit", "tiktok"];
const PLACEHOLDER = "[détail à compléter]";

interface Variant { text: string; ai: boolean }

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* repli ci-dessous */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Lien qui ouvre le canal choisi (profil Instagram, e-mail, téléphone, page LinkedIn…). */
function channelLink(p: Prospect, c: Channel): { href: string; label: string } | null {
  const web = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);
  if (c === "instagram") { const h = instagramUrl(p.instagram); return h ? { href: h, label: "Ouvrir Instagram" } : null; }
  if (c === "email") return p.email ? { href: `mailto:${p.email}`, label: "Ouvrir l'e-mail" } : null;
  if (c === "phone") { const t = telHref(p.phone); return t ? { href: t, label: "Appeler" } : null; }
  if (c === "linkedin") { const h = web(p.linkedin); return h ? { href: h, label: "Ouvrir LinkedIn" } : null; }
  if (c === "tiktok") { const h = web(p.tiktok); return h ? { href: h, label: "Ouvrir TikTok" } : null; }
  return null;
}

/** Générateur de message : modèle rempli, réécriture par Claude, puis « Copier et marquer comme envoyé ». */
export function MessageComposer({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const app = useApp();
  const p = app.byId(prospectId);
  return (
    <Dialog open onClose={onClose} variant="drawer" label="Générer un message">
      {p ? <Composer key={p.id} p={p} onClose={onClose} /> : <div className="p-6 text-sm text-muted">Fiche introuvable.</div>}
    </Dialog>
  );
}

function Composer({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const { ref, listTemplates, listActivities, update, sendMessage, toast } = useApp();
  const category = ref.categories.find((c) => c.id === p.category_id) ?? null;
  const firstOpen = ref.stages.filter((s) => s.kind === "open").sort((a, b) => a.position - b.position)[0];

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [channel, setChannel] = useState<Channel>(p.preferred_channel ?? "instagram");
  const [tone, setTone] = useState<Tone>(category?.default_tone ?? "tu");
  const [offer, setOffer] = useState<OfferId>("reel");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState(p.highlights ?? "");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [active, setActive] = useState(0);
  const [aiState, setAiState] = useState<{ configured: boolean } | null>(null);
  const [busy, setBusy] = useState<"ai" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const contactedRef = useRef(p.stage_id !== firstOpen?.id);

  const offerLabel = OFFERS.find((o) => o.id === offer)!.label;
  const template = templates?.find((t) => t.id === templateId) ?? null;
  const forChannel = useMemo(() => (templates ?? []).filter((t) => t.channel === channel), [templates, channel]);

  const fill = (t: Template | null, over?: { tone?: Tone; offer?: OfferId; highlights?: string }) => {
    const off = OFFERS.find((o) => o.id === (over?.offer ?? offer))!.label;
    const r = fillTemplate(t?.body ?? "", { prospect: p, offer: off, detail: detailFrom(over?.highlights ?? highlights) });
    setVariants([{ text: r.text, ai: false }]);
    setActive(0);
  };

  // Chargement des modèles et de l'état de la clé Claude ; on regarde aussi si le prospect a déjà reçu un message.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, acts] = await Promise.all([listTemplates().catch(() => [] as Template[]), listActivities(p.id).catch(() => [])]);
      if (!alive) return;
      if (acts.some((a) => a.kind === "message")) contactedRef.current = true;
      setTemplates(list);
      const t = pickTemplate(list, { channel, tone, categoryId: p.category_id, contacted: contactedRef.current });
      setTemplateId(t?.id ?? null);
      const r = fillTemplate(t?.body ?? "", { prospect: p, offer: OFFERS[0].label, detail: detailFrom(p.highlights) });
      setVariants([{ text: r.text, ai: false }]);
    })();
    fetch("/api/messages/status").then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setAiState(j ? { configured: !!j.configured } : { configured: false }); }).catch(() => { if (alive) setAiState({ configured: false }); });
    return () => { alive = false; abort.current?.abort(); };
    // Chargement initial uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (c: Channel, t: Tone) => {
    const next = pickTemplate(templates ?? [], { channel: c, tone: t, categoryId: p.category_id, contacted: contactedRef.current });
    setTemplateId(next?.id ?? null);
    fill(next, { tone: t });
  };

  const current = variants[active]?.text ?? "";
  const unresolved = current.includes(PLACEHOLDER);
  const words = current.trim() ? current.trim().split(/\s+/).length : 0;
  const link = channelLink(p, channel);

  const rewrite = async () => {
    setError(null); setBusy("ai");
    abort.current?.abort();
    const ctl = new AbortController(); abort.current = ctl;
    try {
      const base = template ? fillTemplate(template.body, { prospect: p, offer: offerLabel, detail: detailFrom(highlights) }).text : current;
      const res = await fetch("/api/messages/generate", {
        method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({
          name: p.name, category: category?.name ?? null, district: p.district === "rive_gauche" ? "rive gauche" : p.district === "rive_droite" ? "rive droite" : null,
          channel, tone, contactFirstName: p.contact_first_name, highlights: highlights || null, website: p.website, instagram: p.instagram,
          offer: offerLabel, template: base || "(aucun modèle : écris un premier message)", count: 3,
        }),
      });
      const j = await res.json().catch(() => null) as { variants?: string[]; message?: string } | null;
      if (!res.ok || !j?.variants?.length) { setError(j?.message ?? "Claude n'a pas pu répondre."); return; }
      setVariants(j.variants.map((text) => ({ text, ai: true })));
      setActive(0);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Claude ne répond pas, réessaie dans un instant.");
    } finally { setBusy(null); }
  };

  const edit = (text: string) => setVariants((l) => l.map((v, i) => (i === active ? { ...v, text } : v)));

  const copy = async () => {
    const ok = await copyText(current);
    setCopied(ok);
    toast(ok ? "Message copié" : "Copie impossible : sélectionne le texte et copie-le à la main", { kind: ok ? "info" : "error" });
    return ok;
  };

  const send = async () => {
    if (p.do_not_contact) return;
    setBusy("send");
    await copyText(current);
    const ok = await sendMessage(p.id, { template_id: templateId, channel, variant: active + 1, body: current.trim(), written_by_ai: !!variants[active]?.ai });
    setBusy(null);
    if (ok) onClose();
  };

  const saveHighlights = () => { const v = highlights.trim() || null; if (v !== (p.highlights ?? null)) void update(p.id, { highlights: v }); };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-2 border-b border-border px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Message pour {p.name}</h2>
          <p className="mt-0.5 text-xs text-muted">{category?.name ?? "Sans catégorie"}{p.contact_first_name ? ` · ${p.contact_first_name}` : ""}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {p.do_not_contact ? (
          <p role="alert" className="flex gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> Ce prospect est marqué « Ne pas contacter ». Le message ne peut pas être marqué comme envoyé.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mc-channel" className="mb-1 block text-xs font-medium text-muted">Canal</label>
            <select id="mc-channel" className={inputCls} value={channel} onChange={(e) => { const c = e.target.value as Channel; setChannel(c); choose(c, tone); }}>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mc-tone" className="mb-1 block text-xs font-medium text-muted">Ton</label>
            <select id="mc-tone" className={inputCls} value={tone} onChange={(e) => { const t = e.target.value as Tone; setTone(t); choose(channel, t); }}>
              <option value="tu">Tutoiement</option>
              <option value="vous">Vouvoiement</option>
            </select>
          </div>
          <div>
            <label htmlFor="mc-offer" className="mb-1 block text-xs font-medium text-muted">Proposition</label>
            <select id="mc-offer" className={inputCls} value={offer} onChange={(e) => { const o = e.target.value as OfferId; setOffer(o); fill(template, { offer: o }); }}>
              {OFFERS.map((o) => <option key={o.id} value={o.id}>{o.hint}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mc-template" className="mb-1 block text-xs font-medium text-muted">Modèle</label>
            <select id="mc-template" className={inputCls} value={templateId ?? ""} disabled={!templates} onChange={(e) => { const t = templates?.find((x) => x.id === e.target.value) ?? null; setTemplateId(t?.id ?? null); fill(t); }}>
              {forChannel.length === 0 ? <option value="">Aucun modèle pour ce canal</option> : null}
              {forChannel.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="mc-high" className="mb-1 block text-xs font-medium text-muted">Éléments à mettre en avant</label>
          <textarea id="mc-high" rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} onBlur={saveHighlights}
            placeholder="Ce que tu as remarqué : déco, plats, ambiance, ouverture récente… (enregistré dans la fiche)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 hover:border-muted/50" />
          <p className="mt-1 text-xs text-muted">La première ligne alimente {"{détail_remarqué}"} ; Claude s’appuie sur tout le champ.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fill(template)} disabled={busy !== null}>Remplir le modèle</Button>
          <Button variant="primary" onClick={() => void rewrite()} disabled={busy !== null || aiState?.configured === false}
            title={aiState?.configured === false ? "La clé Claude n'est pas configurée (voir Paramètres)" : "Claude propose 3 variantes à partir de la fiche"}>
            <Sparkles size={15} aria-hidden /> {busy === "ai" ? "Claude écrit…" : "Réécrire avec Claude"}
          </Button>
          {aiState?.configured === false ? <span className="text-xs text-muted">Clé Claude non configurée : modèles seuls.</span> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

        {variants.length > 1 ? (
          <div role="tablist" aria-label="Variantes" className="flex gap-1.5">
            {variants.map((v, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
                className={`h-8 rounded-lg px-3 text-[13px] font-medium ${i === active ? "bg-accent text-accent-fg" : "border border-border bg-surface hover:bg-subtle"}`}>Variante {i + 1}</button>
            ))}
          </div>
        ) : null}

        <div>
          <label htmlFor="mc-body" className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
            <span>Message{variants[active]?.ai ? " · écrit par Claude" : ""}</span><span className="tabular-nums">{words} mots</span>
          </label>
          <textarea id="mc-body" rows={12} value={current} onChange={(e) => edit(e.target.value)} placeholder={templates && forChannel.length === 0 ? "Aucun modèle pour ce canal : écris ton message ici ou crée un modèle dans Messages." : ""}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed hover:border-muted/50" />
          {unresolved ? <p className="mt-1 flex items-center gap-1.5 text-xs text-danger"><TriangleAlert size={13} aria-hidden /> Remplace « {PLACEHOLDER} » avant d’envoyer (ou renseigne « Éléments à mettre en avant »).</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {link ? <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium hover:bg-subtle"><ExternalLink size={15} aria-hidden /> {link.label}</a> : null}
        <Button onClick={() => void copy()} disabled={!current.trim()}>{copied ? <ClipboardCheck size={15} aria-hidden /> : <Copy size={15} aria-hidden />} Copier</Button>
        <Button variant="primary" className="ml-auto" onClick={() => void send()} disabled={!current.trim() || busy !== null || p.do_not_contact}
          title="Copie le message, l'ajoute à l'historique et programme la relance dans 3 jours">
          <ClipboardCheck size={15} aria-hidden /> Copier et marquer comme envoyé
        </Button>
      </div>
    </div>
  );
}
