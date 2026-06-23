import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  initialMachines, initialFilament, getYouTubeEmbedUrl,
  getStatusColor, getStatusLabel, getIssueTypeLabel, getIssueStatusColor,
  Machine, MachineStatus, FilamentItem, IssueReport
} from './data';

// ─── localStorage helpers ───────────────────────────────────────
const STORAGE_KEY = 'mastery-wiki-data';
const PASSWORD_KEY = 'mastery-wiki-admin-pw';
const REPORTS_KEY = 'mastery-wiki-reports';

function loadData(): { machines: Machine[]; filament: FilamentItem[] } {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return { machines: initialMachines, filament: initialFilament };
}
function saveData(d: { machines: Machine[]; filament: FilamentItem[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}
function loadPw(): string { return localStorage.getItem(PASSWORD_KEY) || 'exco2026'; }
function savePw(p: string) { localStorage.setItem(PASSWORD_KEY, p); }

function loadReports(): IssueReport[] {
  try {
    const s = localStorage.getItem(REPORTS_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return [];
}
function saveReports(reports: IssueReport[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

// ─── Navigation types ───────────────────────────────────────────
type View = 'home' | 'machine' | 'filament' | 'rules' | 'admin';

interface NavState { view: View; machineId?: string; }

function parseHash(): NavState {
  const h = window.location.hash.slice(1);
  if (h.startsWith('/machine/')) return { view: 'machine', machineId: h.replace('/machine/', '') };
  if (h === '/filament') return { view: 'filament' };
  if (h === '/rules') return { view: 'rules' };
  if (h === '/admin') return { view: 'admin' };
  return { view: 'home' };
}

function setHash(view: View, machineId?: string) {
  if (view === 'machine' && machineId) window.location.hash = `/machine/${machineId}`;
  else if (view === 'filament') window.location.hash = '/filament';
  else if (view === 'rules') window.location.hash = '/rules';
  else if (view === 'admin') window.location.hash = '/admin';
  else window.location.hash = '/';
}

// ─── Search ─────────────────────────────────────────────────────
interface SearchResult {
  machineId: string;
  machineName: string;
  section: string;
  text: string;
}

function buildSearchIndex(machines: Machine[]): SearchResult[] {
  const results: SearchResult[] = [];
  for (const m of machines) {
    results.push({ machineId: m.id, machineName: m.name, section: 'Name', text: m.name });
    results.push({ machineId: m.id, machineName: m.name, section: 'Quick Start', text: m.quickStartSteps.join(' ') });
    for (const s of m.correctSettings) {
      results.push({ machineId: m.id, machineName: m.name, section: 'Settings', text: `${s.material} nozzle:${s.nozzle} bed:${s.bed} ${s.notes || ''}` });
    }
    for (const t of m.troubleshooting) {
      results.push({ machineId: m.id, machineName: m.name, section: 'Troubleshooting', text: `${t.title} ${t.steps.join(' ')}` });
    }
    for (const r of m.repairGuides) {
      results.push({ machineId: m.id, machineName: m.name, section: 'Repair Guide', text: `${r.title} ${r.tools.join(' ')} ${r.steps.join(' ')}` });
    }
    for (const rule of m.rules) {
      results.push({ machineId: m.id, machineName: m.name, section: 'Rules', text: rule });
    }
    if (m.laserSettings) {
      for (const ls of m.laserSettings) {
        results.push({ machineId: m.id, machineName: m.name, section: 'Laser Settings', text: `${ls.material} power:${ls.power} speed:${ls.speed} ${ls.notes || ''}` });
      }
    }
    if (m.cncSettings) {
      for (const cs of m.cncSettings) {
        results.push({ machineId: m.id, machineName: m.name, section: 'CNC Settings', text: `${cs.material} bit:${cs.bitType} spindle:${cs.spindleSpeed} depth:${cs.depthPerPass} ${cs.notes || ''}` });
      }
    }
  }
  return results;
}

function doSearch(index: SearchResult[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().split(/\s+/);
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of index) {
    const fullText = `${r.machineName} ${r.section} ${r.text}`.toLowerCase();
    if (q.every(w => fullText.includes(w))) {
      const key = `${r.machineId}|${r.section}|${r.text.slice(0, 40)}`;
      if (!seen.has(key)) { seen.add(key); out.push(r); }
    }
  }
  return out.slice(0, 30);
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return text;
  const regex = new RegExp(`(${q.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((p, i) =>
    q.some(w => p.toLowerCase() === w) ? <mark key={i} className="rounded px-1">{p}</mark> : p
  );
}

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: MachineStatus }) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm"
      style={{ background: color + '15', color, border: `1px solid ${color}40` }}>
      <span className="w-2.5 h-2.5 rounded-full status-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

// ─── Accordion ──────────────────────────────────────────────────
function Accordion({ title, children, icon, badge, defaultOpen = false }: {
  title: string; children: React.ReactNode; icon?: string; badge?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2a2d3a] rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-[#1a1d27] to-[#151820] shadow-soft">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left text-[#e1e4ed] hover:bg-[#22263a] transition-all duration-200">
        {icon && <span className="text-xl">{icon}</span>}
        <span className="flex-1 font-semibold">{title}</span>
        {badge}
        <svg className={`w-5 h-5 text-[#a0a4b4] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div className={`accordion-content ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 text-[#b0b4c4] text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ─── Difficulty Badge ───────────────────────────────────────────
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = { Easy: '#34d399', Medium: '#fbbf24', Hard: '#f87171' };
  const c = colors[difficulty] || '#a0a4b4';
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm" style={{ background: c + '20', color: c, border: `1px solid ${c}40` }}>{difficulty}</span>;
}

// ─── QR Code Section ────────────────────────────────────────────
function QRCodeSection({ machineId }: { machineId: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}${window.location.pathname}#/machine/${machineId}`);
  }, [machineId]);
  if (!url) return null;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="qr-container">
        <QRCodeSVG value={url} size={140} level="M" />
      </div>
      <p className="text-[11px] text-[#a0a4b4] text-center leading-relaxed max-w-[160px]">
        Scan for instant access to guide, settings & troubleshooting
      </p>
    </div>
  );
}

// ─── Report Issue Modal ─────────────────────────────────────────
function ReportIssueModal({ machine, onClose, onSubmit }: {
  machine: Machine;
  onClose: () => void;
  onSubmit: (report: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => void;
}) {
  const [reportedBy, setReportedBy] = useState('');
  const [issueType, setIssueType] = useState<IssueReport['issueType']>('broken');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedBy.trim() || !description.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit({ machineId: machine.id, machineName: machine.name, reportedBy: reportedBy.trim(), issueType, description: description.trim() });
    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-2xl p-8 border border-[#34d39944] w-full max-w-md text-center shadow-2xl">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#e1e4ed] mb-2">Report Submitted!</h2>
          <p className="text-[#a0a4b4] text-sm">Thank you for reporting this issue. The Exco team will review it soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-2xl p-6 border border-[#2a2d3a] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#e1e4ed] flex items-center gap-2">
            <span className="text-2xl">⚠️</span> Report Issue
          </h2>
          <button onClick={onClose} className="text-[#a0a4b4] hover:text-[#e1e4ed] transition-colors text-xl">×</button>
        </div>

        <p className="text-sm text-[#a0a4b4] mb-4">
          Reporting issue for: <span className="text-[#4da6ff] font-medium">{machine.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#a0a4b4] block mb-1.5">Your Name / HKUST ID <span className="text-[#f87171]">*</span></label>
            <input
              type="text"
              value={reportedBy}
              onChange={e => setReportedBy(e.target.value)}
              placeholder="e.g., John Chan or 20241234"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl px-4 py-2.5 text-sm focus:border-[#4da6ff] transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-[#a0a4b4] block mb-1.5">Issue Type <span className="text-[#f87171]">*</span></label>
            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value as IssueReport['issueType'])}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl px-4 py-2.5 text-sm focus:border-[#4da6ff] transition-colors"
            >
              <option value="broken">🔴 Broken / Not Working</option>
              <option value="needs-calibration">🟡 Needs Calibration</option>
              <option value="missing-parts">🟠 Missing Parts/Accessories</option>
              <option value="other">⚪ Other Issue</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-[#a0a4b4] block mb-1.5">Description <span className="text-[#f87171]">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail. What's wrong? When did you notice it? Any error messages?"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl px-4 py-2.5 text-sm h-32 resize-y focus:border-[#4da6ff] transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#f87171] to-[#fb7171] text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-shadow">
              📤 Submit Report
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-[#2a2d3a] text-[#e1e4ed] rounded-xl text-sm hover:bg-[#323642] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Machine Page ───────────────────────────────────────────────
function MachinePage({ machine, isAdmin, onSave, reports, onAddReport }: {
  machine: Machine;
  isAdmin: boolean;
  onSave: (m: Machine) => void;
  reports: IssueReport[];
  onAddReport: (report: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editStatus, setEditStatus] = useState<MachineStatus>(machine.status);
  const [editVideoUrls, setEditVideoUrls] = useState<string[]>(machine.videoUrls);
  const [showReportModal, setShowReportModal] = useState(false);

  const machineReports = reports.filter(r => r.machineId === machine.id && r.status !== 'resolved');

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = (field: string) => {
    const updated = { ...machine };
    if (field === 'status') updated.status = editStatus;
    else if (field === 'videoUrls') updated.videoUrls = editVideoUrls.filter(v => v.trim());
    else if (field === 'quickStart') updated.quickStartSteps = editValue.split('\n').filter(Boolean);
    else if (field === 'rules') updated.rules = editValue.split('\n').filter(Boolean);
    else if (field === 'settings') {
      try {
        updated.correctSettings = JSON.parse(editValue);
      } catch { alert('Invalid JSON for settings'); return; }
    }
    onSave(updated);
    setEditingField(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover Section */}
      <div className="bg-gradient-to-br from-[#1a1d27] via-[#1a1d27] to-[#151820] rounded-2xl p-6 sm:p-8 mb-8 border border-[#2a2d3a] shadow-glow-blue">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
          <div className="flex-1 text-center lg:text-left">
            <div className="text-6xl mb-4 icon-float">{machine.icon}</div>
            <h1 className="text-3xl font-bold text-[#e1e4ed] mb-2">{machine.name}</h1>
            <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start mb-3">
              <StatusBadge status={machine.status} />
              <span className="text-[#a0a4b4] text-sm bg-[#2a2d3a] px-3 py-1 rounded-full">{machine.quantity}</span>
            </div>
            {machine.statusNote && (
              <p className="text-[#fbbf24] text-sm italic bg-[#fbbf2415] inline-block px-3 py-1.5 rounded-lg border border-[#fbbf2430]">
                💡 {machine.statusNote}
              </p>
            )}
            {isAdmin && (
              <div className="mt-4 flex items-center gap-2 justify-center lg:justify-start">
                <label className="text-xs text-[#a0a4b4]">Status:</label>
                <select value={editStatus} onChange={e => { setEditStatus(e.target.value as MachineStatus); const u = { ...machine, status: e.target.value as MachineStatus }; onSave(u); }}
                  className="bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] text-sm rounded-lg px-3 py-1.5 focus:border-[#4da6ff]">
                  <option value="operational">Operational</option>
                  <option value="needs-attention">Needs Attention</option>
                  <option value="down">Down</option>
                </select>
              </div>
            )}
            {!isAdmin && (
              <button onClick={() => setShowReportModal(true)}
                className="mt-4 px-4 py-2.5 bg-gradient-to-r from-[#f87171] to-[#fb7171] text-white rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto lg:mx-0">
                <span>⚠️</span> Report Issue
              </button>
            )}
          </div>
          <QRCodeSection machineId={machine.id} />
        </div>
      </div>

      {/* Open Issues for Admins */}
      {isAdmin && machineReports.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-[#f8717115] to-[#f8717108] rounded-2xl p-5 border border-[#f8717130]">
          <h3 className="text-lg font-bold text-[#e1e4ed] mb-4 flex items-center gap-2">
            <span className="text-xl">📋</span> Open Reports ({machineReports.length})
          </h3>
          <div className="space-y-3">
            {machineReports.map(report => (
              <div key={report.id} className="bg-[#0f1117] rounded-xl p-4 border border-[#2a2d3a]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getIssueTypeLabel(report.issueType)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f8717122] text-[#f87171]">Open</span>
                  </div>
                  <span className="text-xs text-[#a0a4b4]">{new Date(report.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-[#b0b4c4] mb-2">{report.description}</p>
                <p className="text-xs text-[#a0a4b4]">Reported by: <span className="text-[#e1e4ed]">{report.reportedBy}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Start Guide */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#e1e4ed] flex items-center gap-2">
            <span className="text-2xl">🚀</span> Quick Start Guide
          </h2>
          {isAdmin && editingField !== 'quickStart' && (
            <button onClick={() => startEdit('quickStart', machine.quickStartSteps.join('\n'))}
              className="text-xs text-[#4da6ff] hover:text-[#6eb8ff] hover:underline transition-colors">✏️ Edit</button>
          )}
        </div>
        {editingField === 'quickStart' ? (
          <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <p className="text-xs text-[#a0a4b4] mb-3">One step per line:</p>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl p-3 text-sm h-40 resize-y focus:border-[#4da6ff] transition-colors" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => saveEdit('quickStart')} className="px-4 py-2 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-lg text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Save Changes</button>
              <button onClick={() => setEditingField(null)} className="px-4 py-2 bg-[#2a2d3a] text-[#e1e4ed] rounded-lg text-sm hover:bg-[#323642] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <ol className="space-y-3">
              {machine.quickStartSteps.map((s, i) => (
                <li key={i} className="flex gap-4 text-sm group">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#4da6ff] to-[#6eb8ff] text-white flex items-center justify-center text-xs font-bold shadow-md group-hover:scale-110 transition-transform">
                    {i + 1}
                  </span>
                  <span className="text-[#d0d4e0] pt-0.5 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Laser / CNC Quick Start for Snapmaker */}
      {machine.id === 'snapmaker-artisan' && machine.laserQuickStart && machine.cncQuickStart && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#1a1d27] to-[#1a1520] rounded-xl p-5 border border-red-900/30 shadow-soft">
            <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
              <span>🔴</span> Laser Quick Start
            </h3>
            <ol className="space-y-2">
              {machine.laserQuickStart.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-[#b0b4c4]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  <span className="pt-0.5 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-gradient-to-br from-[#1a1d27] to-[#1a1815] rounded-xl p-5 border border-orange-900/30 shadow-soft">
            <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
              <span>🟠</span> CNC Quick Start
            </h3>
            <ol className="space-y-2">
              {machine.cncQuickStart.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-[#b0b4c4]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  <span className="pt-0.5 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Correct Settings */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#e1e4ed] flex items-center gap-2">
            <span className="text-2xl">⚙️</span> Correct Settings
          </h2>
          {isAdmin && editingField !== 'settings' && (
            <button onClick={() => startEdit('settings', JSON.stringify(machine.correctSettings, null, 2))}
              className="text-xs text-[#4da6ff] hover:text-[#6eb8ff] hover:underline transition-colors">✏️ Edit JSON</button>
          )}
        </div>
        {editingField === 'settings' ? (
          <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <p className="text-xs text-[#a0a4b4] mb-3">Edit settings as JSON array:</p>
            <textarea value={editValue} onChange={e => { try { JSON.parse(e.target.value); setEditValue(e.target.value); } catch { /* */ } }}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl p-3 text-xs font-mono h-64 resize-y focus:border-[#4da6ff] transition-colors" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => saveEdit('settings')} className="px-4 py-2 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-lg text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Save Changes</button>
              <button onClick={() => setEditingField(null)} className="px-4 py-2 bg-[#2a2d3a] text-[#e1e4ed] rounded-lg text-sm hover:bg-[#323642] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {machine.correctSettings.length > 0 && (() => {
              const hasBed = machine.correctSettings.some(s => s.bed && s.bed.trim());
              return (
                <div className="overflow-x-auto bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-xl border border-[#2a2d3a] shadow-soft">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2a2d3a] bg-[#151820]/50">
                        <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Material</th>
                        <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">{hasBed ? 'Nozzle' : 'Temperature'}</th>
                        {hasBed && <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Bed</th>}
                        <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {machine.correctSettings.map((s, i) => (
                        <tr key={i} className="border-b border-[#2a2d3a]/50 last:border-0 hover:bg-[#4da6ff08] transition-colors">
                          <td className="px-5 py-3 text-[#e1e4ed] font-medium">{s.material}</td>
                          <td className="px-5 py-3 text-[#34d399] font-mono">{s.nozzle}</td>
                          {hasBed && <td className="px-5 py-3 text-[#fbbf24] font-mono">{s.bed || '—'}</td>}
                          <td className="px-5 py-3 text-[#a0a4b4] text-xs">{s.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {/* Laser Settings Table */}
        {machine.laserSettings && machine.laserSettings.length > 0 && (
          <div className="mt-6">
            <h3 className="text-base font-bold text-[#e1e4ed] mb-3 flex items-center gap-2">
              <span>🔴</span> Laser Settings
            </h3>
            <div className="overflow-x-auto bg-gradient-to-br from-[#1a1d27] to-[#1a1520] rounded-xl border border-red-900/30 shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3a] bg-[#1a1520]/50">
                    <th className="text-left px-5 py-3 text-red-400 font-semibold">Material</th>
                    <th className="text-left px-5 py-3 text-red-400 font-semibold">Power</th>
                    <th className="text-left px-5 py-3 text-red-400 font-semibold">Speed</th>
                    <th className="text-left px-5 py-3 text-red-400 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {machine.laserSettings.map((s, i) => (
                    <tr key={i} className="border-b border-[#2a2d3a]/50 last:border-0 hover:bg-red-500/5 transition-colors">
                      <td className="px-5 py-3 text-[#e1e4ed] font-medium">{s.material}</td>
                      <td className="px-5 py-3 text-[#f87171] font-mono">{s.power}</td>
                      <td className="px-5 py-3 text-[#fbbf24] font-mono">{s.speed}</td>
                      <td className="px-5 py-3 text-[#a0a4b4] text-xs">{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CNC Settings Table */}
        {machine.cncSettings && machine.cncSettings.length > 0 && (
          <div className="mt-6">
            <h3 className="text-base font-bold text-[#e1e4ed] mb-3 flex items-center gap-2">
              <span>🟠</span> CNC Settings
            </h3>
            <div className="overflow-x-auto bg-gradient-to-br from-[#1a1d27] to-[#1a1815] rounded-xl border border-orange-900/30 shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3a] bg-[#1a1815]/50">
                    <th className="text-left px-5 py-3 text-orange-400 font-semibold">Material</th>
                    <th className="text-left px-5 py-3 text-orange-400 font-semibold">Bit Type</th>
                    <th className="text-left px-5 py-3 text-orange-400 font-semibold">Spindle Speed</th>
                    <th className="text-left px-5 py-3 text-orange-400 font-semibold">Depth/Pass</th>
                    <th className="text-left px-5 py-3 text-orange-400 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {machine.cncSettings.map((s, i) => (
                    <tr key={i} className="border-b border-[#2a2d3a]/50 last:border-0 hover:bg-orange-500/5 transition-colors">
                      <td className="px-5 py-3 text-[#e1e4ed] font-medium">{s.material}</td>
                      <td className="px-5 py-3 text-[#fb923c]">{s.bitType}</td>
                      <td className="px-5 py-3 text-[#fbbf24] font-mono">{s.spindleSpeed}</td>
                      <td className="px-5 py-3 text-[#34d399] font-mono">{s.depthPerPass}</td>
                      <td className="px-5 py-3 text-[#a0a4b4] text-xs">{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Troubleshooting */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-[#e1e4ed] mb-4 flex items-center gap-2">
          <span className="text-2xl">🔍</span> Common Problems & Troubleshooting
        </h2>
        {machine.troubleshooting.map((t, i) => (
          <Accordion key={i} title={t.title} icon="⚠️">
            <ol className="space-y-2.5 mt-3">
              {t.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#fbbf2420] text-[#fbbf24] flex items-center justify-center text-[11px] font-bold border border-[#fbbf2430]">
                    {j + 1}
                  </span>
                  <span className="text-[#d0d4e0] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Accordion>
        ))}
      </section>

      {/* Repair Guides */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-[#e1e4ed] mb-4 flex items-center gap-2">
          <span className="text-2xl">🔧</span> Repair Procedures
        </h2>
        {machine.repairGuides.map((r, i) => (
          <Accordion key={i} title={r.title} icon="🛠️" badge={<DifficultyBadge difficulty={r.difficulty} />}>
            {r.warning && (
              <div className="bg-[#f8717115] border border-[#f8717130] rounded-xl p-4 mb-4 text-[#f87171] text-xs leading-relaxed flex gap-2">
                <span>⚠️</span>
                <span>{r.warning}</span>
              </div>
            )}
            {r.tools.length > 0 && (
              <div className="mb-4 p-3 bg-[#4da6ff10] border border-[#4da6ff20] rounded-xl">
                <span className="text-xs font-semibold text-[#4da6ff]">🔧 Tools needed: </span>
                <span className="text-xs text-[#b0b4c4]">{r.tools.join(', ')}</span>
              </div>
            )}
            <ol className="space-y-2.5 mt-3">
              {r.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4da6ff20] text-[#4da6ff] flex items-center justify-center text-[11px] font-bold border border-[#4da6ff30]">
                    {j + 1}
                  </span>
                  <span className="text-[#d0d4e0] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Accordion>
        ))}
      </section>

      {/* Rules */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#e1e4ed] flex items-center gap-2">
            <span className="text-2xl">📋</span> Machine-Specific Rules
          </h2>
          {isAdmin && editingField !== 'rules' && (
            <button onClick={() => startEdit('rules', machine.rules.join('\n'))}
              className="text-xs text-[#4da6ff] hover:text-[#6eb8ff] hover:underline transition-colors">✏️ Edit</button>
          )}
        </div>
        {editingField === 'rules' ? (
          <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <p className="text-xs text-[#a0a4b4] mb-3">One rule per line:</p>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl p-3 text-sm h-40 resize-y focus:border-[#4da6ff] transition-colors" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => saveEdit('rules')} className="px-4 py-2 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-lg text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Save Changes</button>
              <button onClick={() => setEditingField(null)} className="px-4 py-2 bg-[#2a2d3a] text-[#e1e4ed] rounded-lg text-sm hover:bg-[#323642] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <ul className="space-y-2.5">
              {machine.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 text-[#fbbf24] mt-0.5 text-lg">⚠️</span>
                  <span className="text-[#d0d4e0] leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Video Guides */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#e1e4ed] flex items-center gap-2">
            <span className="text-2xl">🎬</span> Video Guides
          </h2>
          {isAdmin && editingField !== 'videoUrls' && (
            <button onClick={() => { setEditingField('videoUrls'); setEditVideoUrls([...machine.videoUrls]); }}
              className="text-xs text-[#4da6ff] hover:text-[#6eb8ff] hover:underline transition-colors">✏️ Edit Videos</button>
          )}
        </div>
        {editingField === 'videoUrls' ? (
          <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
            <p className="text-xs text-[#a0a4b4] mb-3">One YouTube URL per line:</p>
            <textarea value={editVideoUrls.join('\n')} onChange={e => setEditVideoUrls(e.target.value.split('\n'))}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl p-3 text-sm h-32 resize-y focus:border-[#4da6ff] transition-colors" placeholder="https://youtube.com/watch?v=..." />
            <div className="flex gap-2 mt-3">
              <button onClick={() => saveEdit('videoUrls')} className="px-4 py-2 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-lg text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Save Changes</button>
              <button onClick={() => setEditingField(null)} className="px-4 py-2 bg-[#2a2d3a] text-[#e1e4ed] rounded-lg text-sm hover:bg-[#323642] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {machine.videoUrls.map((url, idx) => (
              <div key={idx} className="video-card bg-[#1a1d27] rounded-xl overflow-hidden border border-[#2a2d3a] shadow-soft">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe src={getYouTubeEmbedUrl(url)} title={`Video Guide ${idx + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen className="absolute inset-0 w-full h-full" />
                </div>
              </div>
            ))}
            {machine.videoUrls.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#a0a4b4] text-sm bg-[#1a1d27] rounded-xl border border-[#2a2d3a] border-dashed">
                <span className="text-4xl block mb-2">🎥</span>
                No videos added yet
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-[#a0a4b4] py-8 border-t border-[#2a2d3a]">
        <p className="flex items-center justify-center gap-2">
          <span>📅</span> Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p className="mt-2 flex items-center justify-center gap-2">
          <span>⚡</span> Maintained with care by Exco R&D Sprint
        </p>
      </footer>

      {/* Report Issue Modal */}
      {showReportModal && (
        <ReportIssueModal
          machine={machine}
          onClose={() => setShowReportModal(false)}
          onSubmit={(report) => { onAddReport(report); }}
        />
      )}
    </div>
  );
}

// ─── Filament Page ──────────────────────────────────────────────
function FilamentPage({ filament, isAdmin, onSave }: { filament: FilamentItem[]; isAdmin: boolean; onSave: (f: FilamentItem[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(filament);

  useEffect(() => { setEditData(filament); }, [filament]);

  const addRow = () => {
    setEditData([...editData, { id: `f${Date.now()}`, material: '', brand: '', size: '', colors: '' }]);
  };
  const removeRow = (id: string) => {
    setEditData(editData.filter(f => f.id !== id));
  };
  const updateRow = (id: string, field: keyof FilamentItem, value: string) => {
    setEditData(editData.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const save = () => { onSave(editData); setEditing(false); };
  const cancel = () => { setEditData(filament); setEditing(false); };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#e1e4ed] flex items-center gap-3">
          <span className="text-3xl">🧵</span> Filament Inventory
        </h1>
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-[#4da6ff] hover:text-[#6eb8ff] flex items-center gap-1 hover:underline transition-colors">
            ✏️ Edit Inventory
          </button>
        )}
      </div>

      <div className="overflow-x-auto bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-xl border border-[#2a2d3a] shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2d3a] bg-[#151820]/50">
              <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Material</th>
              <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Brand/Model</th>
              <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Size</th>
              <th className="text-left px-5 py-3 text-[#4da6ff] font-semibold">Colors Available</th>
              {editing && <th className="px-3 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {(editing ? editData : filament).map(f => (
              <tr key={f.id} className="border-b border-[#2a2d3a]/50 last:border-0 hover:bg-[#4da6ff08] transition-colors">
                {editing ? (
                  <>
                    <td className="px-3 py-2"><input value={f.material} onChange={e => updateRow(f.id, 'material', e.target.value)}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-xs focus:border-[#4da6ff] transition-colors" /></td>
                    <td className="px-3 py-2"><input value={f.brand} onChange={e => updateRow(f.id, 'brand', e.target.value)}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-xs focus:border-[#4da6ff] transition-colors" /></td>
                    <td className="px-3 py-2"><input value={f.size} onChange={e => updateRow(f.id, 'size', e.target.value)}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-xs focus:border-[#4da6ff] transition-colors" /></td>
                    <td className="px-3 py-2"><input value={f.colors} onChange={e => updateRow(f.id, 'colors', e.target.value)}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-xs focus:border-[#4da6ff] transition-colors" /></td>
                    <td className="px-3 py-2"><button onClick={() => removeRow(f.id)} className="text-[#f87171] text-xs hover:text-[#fb7171] transition-colors">✕</button></td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-[#e1e4ed] font-medium">{f.material}</td>
                    <td className="px-5 py-3 text-[#b0b4c4]">{f.brand}</td>
                    <td className="px-5 py-3 text-[#b0b4c4]">{f.size}</td>
                    <td className="px-5 py-3 text-[#b0b4c4]">{f.colors}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="flex gap-3 mt-4">
          <button onClick={addRow} className="px-4 py-2 bg-[#34d39922] text-[#34d399] border border-[#34d39944] rounded-lg text-sm font-medium hover:bg-[#34d39933] transition-colors">+ Add Row</button>
          <button onClick={save} className="px-4 py-2 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-lg text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Save Changes</button>
          <button onClick={cancel} className="px-4 py-2 bg-[#2a2d3a] text-[#e1e4ed] rounded-lg text-sm hover:bg-[#323642] transition-colors">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── All Rules Page ─────────────────────────────────────────────
function AllRulesPage({ machines }: { machines: Machine[] }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#e1e4ed] mb-6 flex items-center gap-3">
        <span className="text-3xl">📋</span> All Rules — Consolidated
      </h1>
      {machines.map(m => (
        <div key={m.id} className="mb-6 bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
          <h2 className="text-lg font-bold text-[#e1e4ed] mb-4 flex items-center gap-3">
            <span className="text-2xl">{m.icon}</span> {m.name}
            <StatusBadge status={m.status} />
          </h2>
          <ul className="space-y-2.5">
            {m.rules.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 text-[#fbbf24] mt-0.5 text-lg">⚠️</span>
                <span className="text-[#b0b4c4] leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Admin Panel ────────────────────────────────────────────────
function AdminPanel({ machines, filament, onSaveMachines, onSaveFilament, onChangePw, reports, onUpdateReportStatus, onUpdateReportNotes, onDeleteReport }: {
  machines: Machine[]; filament: FilamentItem[];
  onSaveMachines: (m: Machine[]) => void;
  onSaveFilament: (f: FilamentItem[]) => void;
  onChangePw: (pw: string) => void;
  reports: IssueReport[];
  onUpdateReportStatus: (id: string, status: IssueReport['status']) => void;
  onUpdateReportNotes: (id: string, notes: string) => void;
  onDeleteReport: (id: string) => void;
}) {
  const [selectedMachine, setSelectedMachine] = useState<string>(machines[0]?.id || '');
  const [tab, setTab] = useState<'machines' | 'reports' | 'backup' | 'password'>('machines');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const machine = machines.find(m => m.id === selectedMachine);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);

  useEffect(() => {
    if (machine) setEditMachine(JSON.parse(JSON.stringify(machine)));
  }, [selectedMachine, machine]);

  const saveMachine = () => {
    if (!editMachine) return;
    const updated = machines.map(m => m.id === editMachine.id ? editMachine : m);
    onSaveMachines(updated);
  };

  const addMachine = () => {
    const id = `machine-${Date.now()}`;
    const newM: Machine = {
      id, name: 'New Machine', icon: '🔧', status: 'operational', quantity: '1 unit',
      category: 'printer', quickStartSteps: ['Step 1'], correctSettings: [],
      troubleshooting: [], repairGuides: [], rules: ['Rule 1'], videoUrls: [],
    };
    onSaveMachines([...machines, newM]);
    setSelectedMachine(id);
  };

  const removeMachine = (id: string) => {
    if (!confirm('Delete this machine page?')) return;
    const updated = machines.filter(m => m.id !== id);
    onSaveMachines(updated);
    if (selectedMachine === id) setSelectedMachine(updated[0]?.id || '');
  };

  const exportData = () => {
    const data = { machines, filament, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mastery-wiki-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.machines) onSaveMachines(data.machines);
          if (data.filament) onSaveFilament(data.filament);
          alert('Import successful!');
        } catch { alert('Invalid JSON file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const resetData = () => {
    if (!confirm('Reset all data to defaults? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    onSaveMachines(initialMachines);
    onSaveFilament(initialFilament);
  };

  const changePassword = () => {
    if (!newPw || newPw.length < 4) { setPwMsg('Password must be at least 4 characters'); return; }
    if (newPw !== confirmPw) { setPwMsg('Passwords do not match'); return; }
    onChangePw(newPw);
    setNewPw(''); setConfirmPw(''); setPwMsg('Password changed successfully!');
  };

  const updateTroubleshooting = (idx: number, field: string, value: string) => {
    if (!editMachine) return;
    const ts = [...editMachine.troubleshooting];
    if (field === 'title') ts[idx] = { ...ts[idx], title: value };
    else if (field === 'steps') ts[idx] = { ...ts[idx], steps: value.split('\n') };
    setEditMachine({ ...editMachine, troubleshooting: ts });
  };

  const updateRepairGuide = (idx: number, field: string, value: string) => {
    if (!editMachine) return;
    const rg = [...editMachine.repairGuides];
    if (field === 'title') rg[idx] = { ...rg[idx], title: value };
    else if (field === 'difficulty') rg[idx] = { ...rg[idx], difficulty: value as 'Easy' | 'Medium' | 'Hard' };
    else if (field === 'tools') rg[idx] = { ...rg[idx], tools: value.split(',').map(s => s.trim()).filter(Boolean) };
    else if (field === 'steps') rg[idx] = { ...rg[idx], steps: value.split('\n').filter(Boolean) };
    else if (field === 'warning') rg[idx] = { ...rg[idx], warning: value };
    setEditMachine({ ...editMachine, repairGuides: rg });
  };

  const addTroubleshooting = () => {
    if (!editMachine) return;
    setEditMachine({ ...editMachine, troubleshooting: [...editMachine.troubleshooting, { title: 'New Issue', steps: ['Step 1'] }] });
  };
  const removeTroubleshooting = (idx: number) => {
    if (!editMachine) return;
    setEditMachine({ ...editMachine, troubleshooting: editMachine.troubleshooting.filter((_, i) => i !== idx) });
  };
  const addRepairGuide = () => {
    if (!editMachine) return;
    setEditMachine({ ...editMachine, repairGuides: [...editMachine.repairGuides, { title: 'New Guide', difficulty: 'Easy', tools: [], steps: ['Step 1'] }] });
  };
  const removeRepairGuide = (idx: number) => {
    if (!editMachine) return;
    setEditMachine({ ...editMachine, repairGuides: editMachine.repairGuides.filter((_, i) => i !== idx) });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#e1e4ed] mb-6 flex items-center gap-3">
        <span className="text-3xl">🔐</span> Admin Panel
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['machines', 'reports', 'backup', 'password'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white shadow-glow-blue' : 'bg-[#1a1d27] text-[#a0a4b4] border border-[#2a2d3a] hover:border-[#4da6ff44]'}`}>
            {t === 'machines' ? '🖨️ Edit Machines' : t === 'reports' ? `📋 Reports (${reports.filter(r => r.status !== 'resolved').length})` : t === 'backup' ? '💾 Backup/Restore' : '🔑 Change Password'}
          </button>
        ))}
      </div>

      {tab === 'machines' && (
        <div>
          {/* Machine selector */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {machines.map(m => (
              <button key={m.id} onClick={() => setSelectedMachine(m.id)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${selectedMachine === m.id ? 'bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white shadow-glow-blue' : 'bg-[#1a1d27] text-[#a0a4b4] border border-[#2a2d3a] hover:border-[#4da6ff44]'}`}>
                {m.icon} {m.name.replace(' Printer', '').replace(' Printer', '')}
              </button>
            ))}
            <button onClick={addMachine} className="px-4 py-2 rounded-xl text-sm bg-[#34d39922] text-[#34d399] border border-[#34d39944] hover:bg-[#34d39933] transition-colors">+ Add Machine</button>
          </div>

          {editMachine && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <h3 className="text-sm font-bold text-[#e1e4ed] mb-4 flex items-center gap-2">
                  <span>📝</span> Basic Info
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Name</label>
                    <input value={editMachine.name} onChange={e => setEditMachine({ ...editMachine, name: e.target.value })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Icon (emoji)</label>
                    <input value={editMachine.icon} onChange={e => setEditMachine({ ...editMachine, icon: e.target.value })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Status</label>
                    <select value={editMachine.status} onChange={e => setEditMachine({ ...editMachine, status: e.target.value as MachineStatus })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors">
                      <option value="operational">Operational</option>
                      <option value="needs-attention">Needs Attention</option>
                      <option value="down">Down</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Quantity</label>
                    <input value={editMachine.quantity} onChange={e => setEditMachine({ ...editMachine, quantity: e.target.value })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Status Note</label>
                    <input value={editMachine.statusNote || ''} onChange={e => setEditMachine({ ...editMachine, statusNote: e.target.value })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Category</label>
                    <select value={editMachine.category} onChange={e => setEditMachine({ ...editMachine, category: e.target.value as any })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm focus:border-[#4da6ff] transition-colors">
                      <option value="printer">Printer</option>
                      <option value="snapmaker">Snapmaker</option>
                      <option value="soldering">Soldering</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-[#a0a4b4] block mb-1.5">Video URLs (one per line)</label>
                    <textarea value={editMachine.videoUrls.join('\n')} onChange={e => setEditMachine({ ...editMachine, videoUrls: e.target.value.split('\n') })}
                      className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm h-24 resize-y focus:border-[#4da6ff] transition-colors" placeholder="https://youtube.com/watch?v=..." />
                  </div>
                </div>
              </div>

              {/* Quick Start */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <h3 className="text-sm font-bold text-[#e1e4ed] mb-3">🚀 Quick Start Steps (one per line)</h3>
                <textarea value={editMachine.quickStartSteps.join('\n')}
                  onChange={e => setEditMachine({ ...editMachine, quickStartSteps: e.target.value.split('\n') })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg p-3 text-sm h-32 resize-y focus:border-[#4da6ff] transition-colors" />
              </div>

              {/* Correct Settings */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <h3 className="text-sm font-bold text-[#e1e4ed] mb-3">⚙️ Correct Settings (JSON)</h3>
                <textarea value={JSON.stringify(editMachine.correctSettings, null, 2)}
                  onChange={e => { try { setEditMachine({ ...editMachine, correctSettings: JSON.parse(e.target.value) }); } catch { /* */ } }}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg p-3 text-xs font-mono h-48 resize-y focus:border-[#4da6ff] transition-colors" />
              </div>

              {/* Troubleshooting */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#e1e4ed]">⚠️ Troubleshooting Items</h3>
                  <button onClick={addTroubleshooting} className="text-xs text-[#34d399] hover:text-[#4ade80] transition-colors">+ Add</button>
                </div>
                {editMachine.troubleshooting.map((t, i) => (
                  <div key={i} className="mb-3 p-4 bg-[#0f1117] rounded-lg border border-[#2a2d3a]">
                    <div className="flex items-center justify-between mb-2">
                      <input value={t.title} onChange={e => updateTroubleshooting(i, 'title', e.target.value)}
                        className="flex-1 bg-[#1a1d27] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-1.5 text-sm mr-2 focus:border-[#4da6ff] transition-colors" />
                      <button onClick={() => removeTroubleshooting(i)} className="text-[#f87171] text-xs hover:text-[#fb7171] transition-colors">✕</button>
                    </div>
                    <textarea value={t.steps.join('\n')} onChange={e => updateTroubleshooting(i, 'steps', e.target.value)}
                      className="w-full bg-[#1a1d27] border border-[#2a2d3a] text-[#a0a4b4] rounded-lg px-3 py-1.5 text-xs h-20 resize-y focus:border-[#4da6ff] transition-colors" />
                  </div>
                ))}
              </div>

              {/* Repair Guides */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#e1e4ed]">🔧 Repair Guides</h3>
                  <button onClick={addRepairGuide} className="text-xs text-[#34d399] hover:text-[#4ade80] transition-colors">+ Add</button>
                </div>
                {editMachine.repairGuides.map((r, i) => (
                  <div key={i} className="mb-3 p-4 bg-[#0f1117] rounded-lg border border-[#2a2d3a]">
                    <div className="flex items-center gap-2 mb-2">
                      <input value={r.title} onChange={e => updateRepairGuide(i, 'title', e.target.value)}
                        className="flex-1 bg-[#1a1d27] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-1.5 text-sm focus:border-[#4da6ff] transition-colors" />
                      <select value={r.difficulty} onChange={e => updateRepairGuide(i, 'difficulty', e.target.value)}
                        className="bg-[#1a1d27] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-2 py-1.5 text-xs focus:border-[#4da6ff] transition-colors">
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                      <button onClick={() => removeRepairGuide(i)} className="text-[#f87171] text-xs hover:text-[#fb7171] transition-colors">✕</button>
                    </div>
                    <input value={r.tools.join(', ')} onChange={e => updateRepairGuide(i, 'tools', e.target.value)}
                      placeholder="Tools (comma-separated)"
                      className="w-full bg-[#1a1d27] border border-[#2a2d3a] text-[#a0a4b4] rounded-lg px-3 py-1.5 text-xs mb-2 focus:border-[#4da6ff] transition-colors" />
                    <textarea value={r.steps.join('\n')} onChange={e => updateRepairGuide(i, 'steps', e.target.value)}
                      placeholder="Steps (one per line)"
                      className="w-full bg-[#1a1d27] border border-[#2a2d3a] text-[#a0a4b4] rounded-lg px-3 py-1.5 text-xs h-20 resize-y mb-2 focus:border-[#4da6ff] transition-colors" />
                    <input value={r.warning || ''} onChange={e => updateRepairGuide(i, 'warning', e.target.value)}
                      placeholder="Warning (optional)"
                      className="w-full bg-[#1a1d27] border border-[#2a2d3a] text-[#f87171] rounded-lg px-3 py-1.5 text-xs focus:border-[#4da6ff] transition-colors" />
                  </div>
                ))}
              </div>

              {/* Rules */}
              <div className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a] shadow-soft">
                <h3 className="text-sm font-bold text-[#e1e4ed] mb-3">📋 Rules (one per line)</h3>
                <textarea value={editMachine.rules.join('\n')}
                  onChange={e => setEditMachine({ ...editMachine, rules: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg p-3 text-sm h-32 resize-y focus:border-[#4da6ff] transition-colors" />
              </div>

              {/* Save/Delete */}
              <div className="flex gap-3">
                <button onClick={saveMachine} className="px-5 py-2.5 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-xl text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">💾 Save Changes</button>
                <button onClick={() => removeMachine(editMachine.id)} className="px-5 py-2.5 bg-[#f8717122] text-[#f87171] border border-[#f8717144] rounded-xl text-sm hover:bg-[#f8717133] transition-colors">🗑️ Delete Machine</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-[#1a1d27] rounded-xl p-8 border border-[#2a2d3a] text-center">
              <span className="text-5xl block mb-3">✅</span>
              <p className="text-[#e1e4ed] font-medium">No reports yet</p>
              <p className="text-[#a0a4b4] text-sm mt-1">Members can report issues from any machine page</p>
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-[#1a1d27] rounded-xl p-5 border border-[#2a2d3a]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📋</span>
                    <div>
                      <h3 className="font-bold text-[#e1e4ed]">{report.machineName}</h3>
                      <p className="text-xs text-[#a0a4b4]">Reported by {report.reportedBy} on {new Date(report.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={report.status} onChange={e => onUpdateReportStatus(report.id, e.target.value as IssueReport['status'])}
                      className="bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-1.5 text-xs focus:border-[#4da6ff]"
                      style={{ color: getIssueStatusColor(report.status) }}>
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <button onClick={() => onDeleteReport(report.id)} className="text-[#f87171] text-xs hover:text-[#fb7171] px-2 py-1">🗑️</button>
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-[#f8717122] text-[#f87171]">{getIssueTypeLabel(report.issueType)}</span>
                </div>
                <p className="text-sm text-[#b0b4c4] mb-3">{report.description}</p>
                <div>
                  <label className="text-xs text-[#a0a4b4] block mb-1">Admin Notes (optional)</label>
                  <textarea value={report.adminNotes || ''} onChange={e => onUpdateReportNotes(report.id, e.target.value)}
                    placeholder="Add notes about this issue..."
                    className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-3 py-2 text-sm h-20 resize-y focus:border-[#4da6ff]" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'backup' && (
        <div className="bg-[#1a1d27] rounded-xl p-6 border border-[#2a2d3a] shadow-soft space-y-4">
          <h3 className="text-sm font-bold text-[#e1e4ed] flex items-center gap-2">
            <span>💾</span> Backup & Restore
          </h3>
          <p className="text-xs text-[#a0a4b4] leading-relaxed">Export all wiki data as a JSON file for backup. Import to restore from a backup or transfer data to another device.</p>
          <div className="flex gap-3 flex-wrap pt-2">
            <button onClick={exportData} className="px-5 py-2.5 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-xl text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">📤 Export Data</button>
            <button onClick={importData} className="px-5 py-2.5 bg-[#34d39922] text-[#34d399] border border-[#34d39944] rounded-xl text-sm hover:bg-[#34d39933] transition-colors">📥 Import Data</button>
            <button onClick={resetData} className="px-5 py-2.5 bg-[#f8717122] text-[#f87171] border border-[#f8717144] rounded-xl text-sm hover:bg-[#f8717133] transition-colors">🔄 Reset to Defaults</button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-[#1a1d27] rounded-xl p-6 border border-[#2a2d3a] shadow-soft space-y-4">
          <h3 className="text-sm font-bold text-[#e1e4ed] flex items-center gap-2">
            <span>🔑</span> Change Admin Password
          </h3>
          <input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-4 py-2.5 text-sm focus:border-[#4da6ff] transition-colors" />
          <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-lg px-4 py-2.5 text-sm focus:border-[#4da6ff] transition-colors" />
          <button onClick={changePassword} className="px-5 py-2.5 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-xl text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Change Password</button>
          {pwMsg && <p className={`text-xs ${pwMsg.includes('success') ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{pwMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(loadData);
  const [nav, setNav] = useState<NavState>(parseHash);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [reports, setReports] = useState<IssueReport[]>(loadReports);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { saveReports(reports); }, [reports]);

  useEffect(() => {
    const handler = () => setNav(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchIndex = useMemo(() => buildSearchIndex(data.machines), [data.machines]);
  const searchResults = useMemo(() => doSearch(searchIndex, searchQuery), [searchIndex, searchQuery]);

  const navigate = (view: View, machineId?: string) => {
    setHash(view, machineId);
    setSearchQuery('');
    setShowSearch(false);
  };

  const loginAdmin = () => {
    const pw = loadPw();
    if (pwInput === pw) { setIsAdmin(true); setShowPwModal(false); setPwInput(''); setPwError(''); }
    else setPwError('Incorrect password');
  };

  const logoutAdmin = () => { setIsAdmin(false); };

  const saveMachines = (machines: Machine[]) => setData(d => ({ ...d, machines }));
  const saveFilament = (filament: FilamentItem[]) => setData(d => ({ ...d, filament }));

  const changePassword = (pw: string) => { savePw(pw); };

  const updateMachine = (updated: Machine) => {
    saveMachines(data.machines.map(m => m.id === updated.id ? updated : m));
  };

  const addReport = (reportData: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => {
    const newReport: IssueReport = {
      ...reportData,
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'open'
    };
    setReports(prev => [newReport, ...prev]);
  };

  const updateReportStatus = (reportId: string, status: IssueReport['status']) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
  };

  const updateReportNotes = (reportId: string, adminNotes: string) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, adminNotes } : r));
  };

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const currentMachine = nav.machineId ? data.machines.find(m => m.id === nav.machineId) : null;

  const printers = data.machines.filter(m => m.category === 'printer');
  const nonPrinters = data.machines.filter(m => m.category !== 'printer');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] via-[#0f1117] to-[#131620] text-[#e1e4ed]">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header border-b border-[#2a2d3a]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate('home')} className="flex items-center gap-2.5 flex-shrink-0 group">
            <span className="text-2xl icon-float">⚡</span>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-lg hidden sm:block group-hover:opacity-80 transition-opacity">Mastery Wiki</span>
          </button>

          {/* Search */}
          <div className="flex-1 relative" ref={searchRef}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a0a4b4] text-lg">🔍</span>
              <input
                type="text"
                placeholder="Search machines, problems, settings..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                className="w-full bg-[#1a1d27]/80 border border-[#2a2d3a] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#e1e4ed] placeholder-[#a0a4b4] focus:outline-none focus:border-[#4da6ff] focus:bg-[#1a1d27] transition-all shadow-soft"
              />
            </div>

            {/* Search Results Dropdown */}
            {showSearch && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d27] border border-[#2a2d3a] rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50">
                {searchResults.length === 0 ? (
                  <div className="p-6 text-center text-[#a0a4b4] text-sm">
                    <p className="text-3xl mb-3">🔍</p>
                    <p className="font-medium">No results found for "{searchQuery}"</p>
                    <p className="text-xs mt-2 text-[#6a6e7e]">Try different keywords like "clog", "PETG temperature", or "laser settings"</p>
                  </div>
                ) : (
                  searchResults.map((r, i) => (
                    <button key={i} onClick={() => { navigate('machine', r.machineId); setShowSearch(false); setSearchQuery(''); }}
                      className="w-full text-left px-5 py-3 hover:bg-[#22263a] border-b border-[#2a2d3a] last:border-0 transition-colors group">
                      <div className="flex items-center gap-2 text-xs text-[#4da6ff] mb-1">
                        <span>{data.machines.find(m => m.id === r.machineId)?.icon}</span>
                        <span className="font-semibold group-hover:text-[#6eb8ff] transition-colors">{r.machineName}</span>
                        <span className="text-[#a0a4b4]">→</span>
                        <span className="text-[#fbbf24]">{r.section}</span>
                      </div>
                      <div className="text-xs text-[#a0a4b4] line-clamp-2">{highlightMatch(r.text.slice(0, 120), searchQuery)}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Admin toggle */}
          <button onClick={() => isAdmin ? logoutAdmin() : setShowPwModal(true)}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-all ${isAdmin ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:text-[#e1e4ed] hover:bg-[#1a1d27]'}`}
            title={isAdmin ? 'Logout admin' : 'Admin login'}>
            {isAdmin ? '🔓' : '🔒'}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar (desktop) */}
        <nav className="hidden lg:block w-64 flex-shrink-0 p-5 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#a0a4b4] uppercase tracking-wider mb-3 mt-2 px-3">Printer Fleet</div>
            {printers.map(m => (
              <button key={m.id} onClick={() => navigate('machine', m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group
                  ${nav.view === 'machine' && nav.machineId === m.id ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:bg-[#1a1d27] hover:text-[#e1e4ed]'}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 status-dot" style={{ background: getStatusColor(m.status), boxShadow: `0 0 6px ${getStatusColor(m.status)}66` }} />
                <span>{m.icon}</span>
                <span className="truncate">{m.name.replace(' Printer', '')}</span>
              </button>
            ))}

            <div className="text-xs font-semibold text-[#a0a4b4] uppercase tracking-wider mb-3 mt-6 px-3">Other Equipment</div>
            {nonPrinters.map(m => (
              <button key={m.id} onClick={() => navigate('machine', m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group
                  ${nav.view === 'machine' && nav.machineId === m.id ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:bg-[#1a1d27] hover:text-[#e1e4ed]'}`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 status-dot" style={{ background: getStatusColor(m.status), boxShadow: `0 0 6px ${getStatusColor(m.status)}66` }} />
                <span>{m.icon}</span>
                <span className="truncate">{m.name.split(' ').slice(0, 2).join(' ')}</span>
              </button>
            ))}

            <div className="text-xs font-semibold text-[#a0a4b4] uppercase tracking-wider mb-3 mt-6 px-3">Reference</div>
            <button onClick={() => navigate('filament')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group
                ${nav.view === 'filament' ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:bg-[#1a1d27] hover:text-[#e1e4ed]'}`}>
              🧵 Filament Inventory
            </button>
            <button onClick={() => navigate('rules')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group
                ${nav.view === 'rules' ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:bg-[#1a1d27] hover:text-[#e1e4ed]'}`}>
              📋 All Rules
            </button>
            {isAdmin && (
              <button onClick={() => navigate('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group
                  ${nav.view === 'admin' ? 'bg-[#4da6ff22] text-[#4da6ff] border border-[#4da6ff44]' : 'text-[#a0a4b4] hover:bg-[#1a1d27] hover:text-[#e1e4ed]'}`}>
                🔐 Admin Panel
              </button>
            )}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 pb-28 lg:pb-6 min-w-0">
          {/* Home / Printer Fleet */}
          {nav.view === 'home' && (
            <div>
              <h1 className="text-2xl font-bold text-[#e1e4ed] mb-6 flex items-center gap-3">
                <span className="text-3xl">🖨️</span> Printer Fleet
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
                {printers.map(m => (
                  <button key={m.id} onClick={() => navigate('machine', m.id)}
                    className="card-hover bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-2xl p-5 border border-[#2a2d3a] text-left group shadow-soft">
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-4xl icon-float">{m.icon}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <h3 className="font-bold text-[#e1e4ed] mb-1.5 group-hover:text-[#4da6ff] transition-colors text-lg">{m.name}</h3>
                    <p className="text-xs text-[#a0a4b4] mb-2">×{m.quantity}</p>
                    {m.statusNote && <p className="text-xs text-[#fbbf24] italic bg-[#fbbf2415] inline-block px-2.5 py-1 rounded-lg border border-[#fbbf2430]">{m.statusNote}</p>}
                  </button>
                ))}
              </div>

              <h2 className="text-xl font-bold text-[#e1e4ed] mb-5 flex items-center gap-2">
                <span className="text-2xl">🔩</span> Other Equipment
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {nonPrinters.map(m => (
                  <button key={m.id} onClick={() => navigate('machine', m.id)}
                    className="card-hover bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-2xl p-5 border border-[#2a2d3a] text-left group shadow-soft">
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-4xl icon-float">{m.icon}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <h3 className="font-bold text-[#e1e4ed] mb-1.5 group-hover:text-[#4da6ff] transition-colors text-lg">{m.name}</h3>
                    <p className="text-xs text-[#a0a4b4] mb-2">×{m.quantity}</p>
                    {m.statusNote && <p className="text-xs text-[#fbbf24] italic bg-[#fbbf2415] inline-block px-2.5 py-1 rounded-lg border border-[#fbbf2430]">{m.statusNote}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Machine detail */}
          {nav.view === 'machine' && currentMachine && (
            <MachinePage machine={currentMachine} isAdmin={isAdmin} onSave={updateMachine} reports={reports} onAddReport={addReport} />
          )}
          {nav.view === 'machine' && !currentMachine && (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🤷</p>
              <p className="text-[#a0a4b4] text-lg">Machine not found</p>
              <button onClick={() => navigate('home')} className="mt-6 text-[#4da6ff] hover:text-[#6eb8ff] hover:underline transition-colors">← Back to home</button>
            </div>
          )}

          {/* Filament */}
          {nav.view === 'filament' && (
            <FilamentPage filament={data.filament} isAdmin={isAdmin} onSave={saveFilament} />
          )}

          {/* Rules */}
          {nav.view === 'rules' && (
            <AllRulesPage machines={data.machines} />
          )}

          {/* Admin */}
          {nav.view === 'admin' && isAdmin && (
            <AdminPanel machines={data.machines} filament={data.filament}
              onSaveMachines={saveMachines} onSaveFilament={saveFilament} onChangePw={changePassword}
              reports={reports} onUpdateReportStatus={updateReportStatus} onUpdateReportNotes={updateReportNotes} onDeleteReport={deleteReport} />
          )}
          {nav.view === 'admin' && !isAdmin && (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🔒</p>
              <p className="text-[#a0a4b4] text-lg">Admin access required</p>
              <button onClick={() => setShowPwModal(true)} className="mt-6 px-6 py-3 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-xl text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Login as Admin</button>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-[#2a2d3a] z-40 mobile-safe-bottom">
        <div className="flex justify-around py-2">
          <button onClick={() => navigate('home')}
            className={`flex flex-col items-center px-3 py-1.5 text-[11px] rounded-xl transition-all ${nav.view === 'home' ? 'text-[#4da6ff] bg-[#4da6ff15]' : 'text-[#a0a4b4]'}`}>
            <span className="text-xl mb-0.5">🖨️</span>Printers
          </button>
          <button onClick={() => navigate('machine', 'snapmaker-artisan')}
            className={`flex flex-col items-center px-3 py-1.5 text-[11px] rounded-xl transition-all ${nav.view === 'machine' && nav.machineId === 'snapmaker-artisan' ? 'text-[#4da6ff] bg-[#4da6ff15]' : 'text-[#a0a4b4]'}`}>
            <span className="text-xl mb-0.5">🔩</span>Snapmaker
          </button>
          <button onClick={() => navigate('machine', 'soldering-station')}
            className={`flex flex-col items-center px-3 py-1.5 text-[11px] rounded-xl transition-all ${nav.view === 'machine' && nav.machineId === 'soldering-station' ? 'text-[#4da6ff] bg-[#4da6ff15]' : 'text-[#a0a4b4]'}`}>
            <span className="text-xl mb-0.5">🔧</span>Solder
          </button>
          <button onClick={() => navigate('filament')}
            className={`flex flex-col items-center px-3 py-1.5 text-[11px] rounded-xl transition-all ${nav.view === 'filament' ? 'text-[#4da6ff] bg-[#4da6ff15]' : 'text-[#a0a4b4]'}`}>
            <span className="text-xl mb-0.5">🧵</span>Filament
          </button>
          <button onClick={() => navigate('rules')}
            className={`flex flex-col items-center px-3 py-1.5 text-[11px] rounded-xl transition-all ${nav.view === 'rules' ? 'text-[#4da6ff] bg-[#4da6ff15]' : 'text-[#a0a4b4]'}`}>
            <span className="text-xl mb-0.5">📋</span>Rules
          </button>
        </div>
      </nav>

      {/* Password Modal */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPwModal(false)}>
          <div className="bg-gradient-to-br from-[#1a1d27] to-[#151820] rounded-2xl p-6 border border-[#2a2d3a] w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[#e1e4ed] mb-4 flex items-center gap-2">
              <span className="text-2xl">🔐</span> Admin Login
            </h2>
            <input type="password" placeholder="Enter password"
              value={pwInput} onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loginAdmin()}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] text-[#e1e4ed] rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-[#4da6ff] focus:shadow-glow-blue transition-all"
              autoFocus />
            {pwError && <p className="text-[#f87171] text-xs mb-3 flex items-center gap-1">⚠️ {pwError}</p>}
            <div className="flex gap-2">
              <button onClick={loginAdmin} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#4da6ff] to-[#6eb8ff] text-white rounded-xl text-sm font-medium shadow-glow-blue hover:shadow-lg transition-shadow">Login</button>
              <button onClick={() => { setShowPwModal(false); setPwInput(''); setPwError(''); }}
                className="px-4 py-2.5 bg-[#2a2d3a] text-[#e1e4ed] rounded-xl text-sm hover:bg-[#323642] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
