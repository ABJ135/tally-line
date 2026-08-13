import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Check, X, Flag, RotateCcw, Trophy, ChevronRight, Plus, ArrowLeft, PartyPopper } from 'lucide-react';

/* ---------------------------------------------------------------
   TALLY LINE — a "race to the number" scorekeeper.
   Palette / type tokens (see design plan): deep ink track, amber
   finish-line accent, chalk-white text, Bebas Neue display face
   for numbers/headings, Inter for UI body text.
------------------------------------------------------------------ */

const COLORS = {
  bg: '#0B1220',
  surface: '#121B2C',
  surfaceAlt: '#1A2740',
  surfaceRaised: '#1F2E4A',
  border: '#26334D',
  borderSoft: '#1D2A42',
  text: '#EDEAE0',
  textDim: '#B7C0CF',
  textMuted: '#7C8AA0',
  accent: '#F2A93B',
  accentSoft: 'rgba(242,169,59,0.16)',
  accentDark: '#C9841F',
  success: '#4CC38A',
  successSoft: 'rgba(76,195,138,0.16)',
  danger: '#E2637A',
  dangerSoft: 'rgba(226,99,122,0.14)',
};

const STORAGE_KEY = 'tallyline_state_v1';

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.players)) return null;
    const valid = parsed.players.every(
      (p) =>
        p &&
        typeof p.id !== 'undefined' &&
        typeof p.name === 'string' &&
        typeof p.tNumber === 'number' &&
        Number.isFinite(p.tNumber) &&
        typeof p.cNumber === 'number' &&
        Number.isFinite(p.cNumber)
    );
    if (!valid) return null;
    return {
      players: parsed.players,
      currentPlayerIndex: Number.isInteger(parsed.currentPlayerIndex) ? parsed.currentPlayerIndex : 0,
      gameStarted: Boolean(parsed.gameStarted),
    };
  } catch (e) {
    return null;
  }
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage unavailable — game still works in-memory */
  }
}

function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}

function uid() {
  return 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function isWinner(p) {
  return p.cNumber >= p.tNumber;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(n) {
  if (!Number.isFinite(n)) return '0';
  return round2(n).toString();
}

/* ---------------------------- small UI atoms ---------------------------- */

function StatusPill({ winner }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"
      style={{
        backgroundColor: winner ? COLORS.successSoft : COLORS.accentSoft,
        color: winner ? COLORS.success : COLORS.accent,
      }}
    >
      {winner ? <Trophy size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS.accent }} />}
      {winner ? 'Winner' : 'Playing'}
    </span>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-sm" style={{ color: COLORS.danger }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
      {children}
    </label>
  );
}

function PrimaryButton({ children, onClick, disabled, type = 'button', className = '', full }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold tracking-wide transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        full ? 'w-full' : ''
      } ${className}`}
      style={{ backgroundColor: COLORS.accent, color: '#1A1300' }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled, className = '', full, tone = 'default' }) {
  const toneColor = tone === 'danger' ? COLORS.danger : COLORS.textDim;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold tracking-wide transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        full ? 'w-full' : ''
      } ${className}`}
      style={{ borderColor: COLORS.border, color: toneColor, backgroundColor: 'transparent' }}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', inputMode, className = '', autoFocus }) {
  return (
    <input
      autoFocus={autoFocus}
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-xl border px-4 py-3 text-base outline-none transition-colors focus:ring-2 ${className}`}
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderColor: COLORS.border,
        color: COLORS.text,
      }}
    />
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg"
        style={{ backgroundColor: COLORS.surfaceRaised, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      >
        <PartyPopper size={16} style={{ color: COLORS.accent }} />
        {message}
      </div>
    </div>
  );
}

/* The signature element: a horizontal "finish line" track showing how far
   a player's current number has travelled toward their target. */
function FinishTrack({ current, target, winner }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div className="mt-5">
      <div className="relative h-4 w-full overflow-hidden rounded-full" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: winner ? COLORS.success : COLORS.accent,
          }}
        />
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full w-px opacity-40"
            style={{ left: `${t}%`, backgroundColor: COLORS.bg }}
          />
        ))}
        <div
          className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow transition-all duration-500 ease-out"
          style={{
            left: `calc(${pct}% - ${pct >= 100 ? 24 : 12}px)`,
            backgroundColor: winner ? COLORS.success : COLORS.accent,
            borderColor: COLORS.bg,
          }}
        >
          {winner ? <Flag size={12} color="#0B1220" /> : null}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium" style={{ color: COLORS.textMuted }}>
        <span>0</span>
        <span>{fmt(target)}</span>
      </div>
    </div>
  );
}

function Modal({ title, description, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(5,8,14,0.72)' }}>
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <h3 className="text-lg font-bold" style={{ color: COLORS.text }}>
          {title}
        </h3>
        <p className="mt-2 text-sm" style={{ color: COLORS.textDim }}>
          {description}
        </p>
        <div className="mt-6 flex gap-3">
          <SecondaryButton full onClick={onCancel}>
            Cancel
          </SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl px-5 py-3 text-sm font-bold tracking-wide transition-transform active:scale-[0.98]"
            style={{ backgroundColor: danger ? COLORS.danger : COLORS.accent, color: '#1A1300' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Navbar({ view, setView, onResetClick, playerCount }) {
  const tabs = [
    { id: 'game', label: 'Game' },
    { id: 'results', label: 'Results' },
  ];
  return (
    <div className="sticky top-0 z-30 border-b backdrop-blur" style={{ backgroundColor: 'rgba(11,18,32,0.92)', borderColor: COLORS.borderSoft }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text, letterSpacing: '0.04em' }}>
            TALLY LINE
          </span>
          <span className="hidden text-xs font-medium sm:inline" style={{ color: COLORS.textMuted }}>
            {playerCount} {playerCount === 1 ? 'player' : 'players'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-full border p-1" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className="rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide transition-colors sm:px-4"
                style={{
                  backgroundColor: view === t.id ? COLORS.accent : 'transparent',
                  color: view === t.id ? '#1A1300' : COLORS.textDim,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onResetClick}
            aria-label="Reset game"
            className="ml-1 rounded-full border p-2 transition-colors hover:opacity-80"
            style={{ borderColor: COLORS.border, color: COLORS.danger }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Dashboard ------------------------------- */

function Dashboard({ onGameStart }) {
  const [step, setStep] = useState('count'); // 'count' | 'players'
  const [countInput, setCountInput] = useState('');
  const [setupPlayers, setSetupPlayers] = useState([]);
  const [error, setError] = useState('');

  function handleCountNext() {
    const trimmed = countInput.trim();
    const n = Number(trimmed);
    if (!trimmed || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      setError('Enter a whole number of players greater than 0.');
      return;
    }
    if (n > 20) {
      setError('Keep it to 20 players or fewer.');
      return;
    }
    setSetupPlayers(Array.from({ length: n }, () => ({ id: uid(), name: '', tNumber: '' })));
    setError('');
    setStep('players');
  }

  function updatePlayer(id, field, value) {
    setSetupPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  function handleStart() {
    for (const p of setupPlayers) {
      if (!p.name.trim()) {
        setError('Every player needs a name.');
        return;
      }
    }
    for (const p of setupPlayers) {
      const t = Number(p.tNumber);
      if (p.tNumber.toString().trim() === '' || !Number.isFinite(t) || t <= 0) {
        setError('Every player needs a target number greater than 0.');
        return;
      }
    }
    const finalPlayers = setupPlayers.map((p) => ({
      id: p.id,
      name: p.name.trim(),
      tNumber: round2(Number(p.tNumber)),
      cNumber: 0,
    }));
    setError('');
    onGameStart(finalPlayers);
  }

  if (step === 'count') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: COLORS.accentSoft }}
            >
              <Flag size={22} style={{ color: COLORS.accent }} />
            </div>
            <h1
              className="text-4xl font-black"
              style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text, letterSpacing: '0.03em' }}
            >
              TALLY LINE
            </h1>
            <p className="mt-2 text-sm" style={{ color: COLORS.textDim }}>
              Set a target for every player, then race their score to the finish line.
            </p>
          </div>

          <div className="rounded-2xl border p-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
            <FieldLabel>Number of players</FieldLabel>
            <TextInput
              autoFocus
              type="number"
              inputMode="numeric"
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              placeholder="e.g. 3"
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton full className="mt-5" onClick={handleCountNext}>
              Next <ChevronRight size={16} />
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => setStep('count')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: COLORS.textMuted }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h2 className="text-2xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text, letterSpacing: '0.02em' }}>
          NAME YOUR RUNNERS
        </h2>
        <p className="mt-1 text-sm" style={{ color: COLORS.textDim }}>
          Give each player a name and the number they're racing to.
        </p>

        {/* desktop table */}
        <div className="mt-6 hidden overflow-hidden rounded-2xl border sm:block" style={{ borderColor: COLORS.border }}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ backgroundColor: COLORS.surfaceAlt }}>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                  #
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                  Target number
                </th>
              </tr>
            </thead>
            <tbody>
              {setupPlayers.map((p, i) => (
                <tr key={p.id} className="border-t" style={{ borderColor: COLORS.borderSoft, backgroundColor: COLORS.surface }}>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: COLORS.textMuted }}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <TextInput value={p.name} onChange={(e) => updatePlayer(p.id, 'name', e.target.value)} placeholder="Player name" />
                  </td>
                  <td className="px-4 py-3">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      value={p.tNumber}
                      onChange={(e) => updatePlayer(p.id, 'tNumber', e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="mt-6 space-y-3 sm:hidden">
          {setupPlayers.map((p, i) => (
            <div key={p.id} className="rounded-2xl border p-4" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
              <div className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                Player {i + 1}
              </div>
              <FieldLabel>Name</FieldLabel>
              <TextInput value={p.name} onChange={(e) => updatePlayer(p.id, 'name', e.target.value)} placeholder="Player name" />
              <div className="mt-3">
                <FieldLabel>Target number</FieldLabel>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={p.tNumber}
                  onChange={(e) => updatePlayer(p.id, 'tNumber', e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
            </div>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>

        <PrimaryButton full className="mt-6" onClick={handleStart}>
          Start game <ChevronRight size={16} />
        </PrimaryButton>
      </div>
    </div>
  );
}

/* -------------------------------- Game view ------------------------------- */

function GameView({ players, currentPlayerIndex, onAdd, onEditSave, onNext, onEnd }) {
  const [scoreInput, setScoreInput] = useState('');
  const [scoreError, setScoreError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');

  const total = players.length;
  const safeIndex = currentPlayerIndex < total ? currentPlayerIndex : 0;
  const player = players[safeIndex];
  const allWon = total > 0 && players.every(isWinner);

  useEffect(() => {
    setScoreInput('');
    setScoreError('');
    setEditing(false);
    setEditError('');
  }, [safeIndex]);

  if (total === 0) return null;

  if (allWon) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.successSoft }}>
          <Trophy size={28} style={{ color: COLORS.success }} />
        </div>
        <h2 className="text-3xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text }}>
          GAME COMPLETED
        </h2>
        <p className="mt-2 max-w-xs text-sm" style={{ color: COLORS.textDim }}>
          Every player has crossed their finish line. Check the results to see how it played out.
        </p>
        <PrimaryButton className="mt-6" onClick={onEnd}>
          View results <ChevronRight size={16} />
        </PrimaryButton>
      </div>
    );
  }

  const winner = isWinner(player);

  function submitScore() {
    if (winner) return;
    const trimmed = scoreInput.trim();
    const val = Number(trimmed);
    if (!trimmed || !Number.isFinite(val) || val <= 0) {
      setScoreError('Enter a positive number.');
      return;
    }
    onAdd(safeIndex, val);
    setScoreInput('');
    setScoreError('');
  }

  function startEdit() {
    setEditValue(String(player.cNumber));
    setEditing(true);
    setEditError('');
  }

  function saveEdit() {
    const trimmed = editValue.trim();
    const val = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(val) || val < 0) {
      setEditError('Enter a number 0 or greater.');
      return;
    }
    onEditSave(safeIndex, val);
    setEditing(false);
    setEditError('');
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      {/* lane indicator */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        {players.map((p, i) => (
          <div
            key={p.id}
            className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold"
            style={{
              borderColor: i === safeIndex ? COLORS.accent : COLORS.border,
              backgroundColor: i === safeIndex ? COLORS.accentSoft : isWinner(p) ? COLORS.successSoft : 'transparent',
              color: i === safeIndex ? COLORS.accent : isWinner(p) ? COLORS.success : COLORS.textMuted,
            }}
            title={p.name}
          >
            {isWinner(p) ? <Trophy size={13} /> : i + 1}
          </div>
        ))}
      </div>

      <div className="rounded-3xl border p-6 shadow-xl sm:p-8" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
            Lane {safeIndex + 1} of {total}
          </span>
          {winner && <StatusPill winner />}
        </div>

        <h2 className="mt-2 truncate text-3xl font-black sm:text-4xl" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text, letterSpacing: '0.01em' }}>
          {player.name}
        </h2>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Current number
            </div>
            {editing ? (
              <div className="mt-1">
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-32 rounded-lg border px-3 py-1.5 text-2xl font-black outline-none focus:ring-2"
                  style={{ backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.accent, color: COLORS.text, fontFamily: "'Bebas Neue', sans-serif" }}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: COLORS.success, color: '#052015' }}
                  >
                    <Check size={13} /> Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditError('');
                    }}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold"
                    style={{ borderColor: COLORS.border, color: COLORS.textDim }}
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
                <ErrorText>{editError}</ErrorText>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-5xl font-black leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text }}>
                  {fmt(player.cNumber)}
                </span>
                <button onClick={startEdit} aria-label="Edit current number" className="rounded-full p-2 transition-colors hover:opacity-70" style={{ color: COLORS.textMuted }}>
                  <Pencil size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Target
            </div>
            <div className="text-2xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.textDim }}>
              {fmt(player.tNumber)}
            </div>
          </div>
        </div>

        <FinishTrack current={player.cNumber} target={player.tNumber} winner={winner} />

        {winner ? (
          <div
            className="mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
            style={{ backgroundColor: COLORS.successSoft, color: COLORS.success }}
          >
            <Trophy size={16} /> This player wins!
          </div>
        ) : (
          <div className="mt-6">
            <FieldLabel>Add to score</FieldLabel>
            <div className="flex gap-2">
              <TextInput
                type="number"
                inputMode="decimal"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder="Enter a number"
              />
              <button
                onClick={submitScore}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-sm font-bold"
                style={{ backgroundColor: COLORS.accent, color: '#1A1300' }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
            <ErrorText>{scoreError}</ErrorText>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <SecondaryButton full onClick={() => onNext(safeIndex)}>
            Next <ChevronRight size={15} />
          </SecondaryButton>
          <SecondaryButton full tone="danger" onClick={onEnd}>
            End
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Results view ------------------------------ */

function ResultsView({ players }) {
  if (players.length === 0) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h2 className="text-2xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text, letterSpacing: '0.02em' }}>
        RESULTS
      </h2>
      <p className="mt-1 text-sm" style={{ color: COLORS.textDim }}>
        Live standings — updates the moment a score changes.
      </p>

      {/* desktop table */}
      <div className="mt-6 hidden overflow-hidden rounded-2xl border sm:block" style={{ borderColor: COLORS.border }}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr style={{ backgroundColor: COLORS.surfaceAlt }}>
              {['Name', 'Target', 'Current', 'Remaining', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const remaining = Math.max(p.tNumber - p.cNumber, 0);
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: COLORS.borderSoft, backgroundColor: COLORS.surface }}>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: COLORS.text }}>
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: COLORS.textDim }}>
                    {fmt(p.tNumber)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: COLORS.textDim }}>
                    {fmt(p.cNumber)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: COLORS.textDim }}>
                    {fmt(remaining)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill winner={isWinner(p)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="mt-6 space-y-3 sm:hidden">
        {players.map((p) => {
          const remaining = Math.max(p.tNumber - p.cNumber, 0);
          return (
            <div key={p.id} className="rounded-2xl border p-4" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: COLORS.text }}>
                  {p.name}
                </span>
                <StatusPill winner={isWinner(p)} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                    Target
                  </div>
                  <div className="text-lg font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.textDim }}>
                    {fmt(p.tNumber)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                    Current
                  </div>
                  <div className="text-lg font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.text }}>
                    {fmt(p.cNumber)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                    Remaining
                  </div>
                  <div className="text-lg font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: COLORS.accent }}>
                    {fmt(remaining)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- App root -------------------------------- */

export default function App() {
  const restored = useMemo(() => loadState(), []);

  const [players, setPlayers] = useState(restored?.players || []);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(restored?.currentPlayerIndex || 0);
  const [gameStarted, setGameStarted] = useState(restored?.gameStarted || false);
  const [view, setView] = useState('game');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (gameStarted) {
      saveState({ players, currentPlayerIndex, gameStarted });
    }
  }, [players, currentPlayerIndex, gameStarted]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function handleGameStart(finalPlayers) {
    setPlayers(finalPlayers);
    setCurrentPlayerIndex(0);
    setGameStarted(true);
    setView('game');
  }

  function handleAdd(index, val) {
    setPlayers((prev) => {
      const updated = prev.map((p, i) => (i === index ? { ...p, cNumber: round2(p.cNumber + val) } : p));
      if (isWinner(updated[index]) && !isWinner(prev[index])) {
        setToast(`${updated[index].name} crossed the finish line!`);
      }
      return updated;
    });
  }

  function handleEditSave(index, val) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, cNumber: round2(val) } : p)));
  }

  function handleNext(fromIndex) {
    setPlayers((prevPlayers) => {
      if (prevPlayers.length === 0 || prevPlayers.every(isWinner)) return prevPlayers;
      let idx = fromIndex;
      for (let i = 0; i < prevPlayers.length; i++) {
        idx = (idx + 1) % prevPlayers.length;
        if (!isWinner(prevPlayers[idx])) {
          setCurrentPlayerIndex(idx);
          break;
        }
      }
      return prevPlayers;
    });
  }

  function handleEnd() {
    setView('results');
  }

  function handleResetClick() {
    setShowResetConfirm(true);
  }

  function handleResetConfirm() {
    clearStoredState();
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setGameStarted(false);
    setView('game');
    setShowResetConfirm(false);
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}
    >
      <Toast message={toast} />

      {showResetConfirm && (
        <Modal
          title="Reset the game?"
          description="This clears every player, score, and saved progress. You'll start again from the player-count screen."
          confirmLabel="Reset game"
          danger
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {!gameStarted ? (
        <Dashboard onGameStart={handleGameStart} />
      ) : (
        <>
          <Navbar view={view} setView={setView} onResetClick={handleResetClick} playerCount={players.length} />
          {view === 'game' ? (
            <GameView
              players={players}
              currentPlayerIndex={currentPlayerIndex}
              onAdd={handleAdd}
              onEditSave={handleEditSave}
              onNext={handleNext}
              onEnd={handleEnd}
            />
          ) : (
            <ResultsView players={players} />
          )}
        </>
      )}
    </div>
  );
}
