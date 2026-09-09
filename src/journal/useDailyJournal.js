import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONVERSATION_ENTRY_LIMIT, buildJournalContext, createConversationEntry, forgetJournalMoment,
  loadConversationEntries, loadConversationSummaries, mergeJournalSummary, storeConversationEntry,
  storeConversationSummary, updateJournalMoment } from "../conversation-journal.js";
import { createConversationFingerprint, groupConversationEntriesByDay, mergeDailyTimeline } from "../daily-timeline.js";
import { createCaptureFingerprint, createCaptureSummaryCollage } from "../capture-summary.js";

export function getConversationSummaryApiUrl() {
  return import.meta.env.VITE_JOCAM_SUMMARY_URL || (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:8787/conversation-summary" : "/api/conversation-summary");
}

export default function useDailyJournal({ captures = [], friends = [], libraryOpen = false, sessionActive = false, onMemoryChange } = {}) {
  const [entries, setEntries] = useState([]);
  const [records, setRecords] = useState({});
  const [states, setStates] = useState({});
  const [ready, setReady] = useState(false);
  const recordsRef = useRef(records);
  const entriesRef = useRef(entries);
  const memoryChangeRef = useRef(onMemoryChange);
  const attemptsRef = useRef(new Map());
  const epochRef = useRef(0);
  const sessionId = useRef(globalThis.crypto?.randomUUID?.() || String(Date.now()));
  recordsRef.current = records;
  entriesRef.current = entries;
  memoryChangeRef.current = onMemoryChange;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadConversationEntries(), loadConversationSummaries()]).then(([savedEntries, summaries]) => {
      if (cancelled) return;
      setEntries((current) => [...new Map([...savedEntries, ...current].map((entry) => [entry.id, entry])).values()]
        .sort((a, b) => a.createdAt - b.createdAt).slice(-CONVERSATION_ENTRY_LIMIT));
      setRecords(Object.fromEntries(summaries.filter((record) => record.dayKey).map((record) => [record.dayKey, record])));
      setReady(true);
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const recordMessage = useCallback((message) => {
    const entry = createConversationEntry({ ...message, sessionId: message.sessionId || sessionId.current });
    if (!entry || entry.source === "gameplay") return null;
    setEntries((current) => current.some((item) => item.id === entry.id) ? current : [...current, entry].slice(-CONVERSATION_ENTRY_LIMIT));
    void storeConversationEntry(entry).catch(() => {});
    return entry;
  }, []);
  const entriesByDay = useMemo(() => groupConversationEntriesByDay(entries), [entries]);
  const timeline = useMemo(() => mergeDailyTimeline(captures, entries, records, friends), [captures, entries, records, friends]);

  useEffect(() => {
    if (!ready) return undefined;
    const jobs = timeline.map(({ dayKey, items }) => {
      const record = records[dayKey];
      const suppressed = new Set(record?.suppressedEntryIds || []);
      let textSize = 0;
      const sourceEntries = (entriesByDay.get(dayKey) || []).filter((entry) => !suppressed.has(entry.id) && entry.source !== "gameplay").slice(-60)
        .reverse().filter((entry) => { textSize += entry.text.length; return textSize <= 7500; }).reverse();
      const hasChild = sourceEntries.some((entry) => entry.role === "user");
      if (!hasChild && (!items.length || record?.moments?.length || record?.suppressedEntryIds?.length)) return null;
      const source = hasChild ? "dialogue" : "captures";
      const fingerprint = source === "dialogue" ? `dialogue:${createConversationFingerprint(sourceEntries)}` : `captures:${createCaptureFingerprint(items)}`;
      if (record?.fingerprint === fingerprint || attemptsRef.current.get(dayKey) === fingerprint) return null;
      return { dayKey, items, entries: hasChild ? sourceEntries : [], source, fingerprint, revision: Number(record?.revision || 0) };
    }).filter(Boolean).slice(0, 3);
    if (!jobs.length) return undefined;
    const controller = new AbortController();
    const epoch = epochRef.current;
    let finished = false;
    const timer = setTimeout(async () => {
      jobs.forEach((job) => attemptsRef.current.set(job.dayKey, job.fingerprint));
      setStates((current) => ({ ...current, ...Object.fromEntries(jobs.map(({ dayKey }) => [dayKey, "loading"])) }));
      try {
        const days = await Promise.all(jobs.map(async (job) => ({
          dayKey: job.dayKey, entries: job.entries,
          ...(job.source === "captures" ? { image: await createCaptureSummaryCollage(job.items) } : {}),
        })));
        if (controller.signal.aborted) return;
        const usable = days.filter((day) => day.entries.length || day.image);
        if (!usable.length) throw new Error("No summary sources");
        const response = await fetch(getConversationSummaryApiUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: usable }), signal: controller.signal });
        if (!response.ok) throw new Error("Summary unavailable");
        const result = await response.json();
        if (!result.ok || !Array.isArray(result.summaries)) throw new Error("Invalid summary");
        const savedRecords = [];
        for (const job of jobs) {
          const returned = result.summaries.find((record) => record.dayKey === job.dayKey);
          if (!returned || controller.signal.aborted || epoch !== epochRef.current) continue;
          const incoming = { ...returned, dayKey: job.dayKey, source: job.source, fingerprint: job.fingerprint, processedEntryIds: job.entries.map((entry) => entry.id), updatedAt: Date.now() };
          const saved = await storeConversationSummary(incoming, { expectedRevision: job.revision });
          if (!saved || controller.signal.aborted || epoch !== epochRef.current) continue;
          savedRecords.push({ job, incoming });
        }
        if (!controller.signal.aborted && epoch === epochRef.current) setRecords((current) => {
          const next = { ...current };
          for (const { job, incoming } of savedRecords) if (Number(current[job.dayKey]?.revision || 0) === job.revision) next[job.dayKey] = mergeJournalSummary(current[job.dayKey], incoming);
          return next;
        });
        finished = true;
        if (!controller.signal.aborted) setStates((current) => ({ ...current, ...Object.fromEntries(jobs.map(({ dayKey }) => [dayKey, "ready"])) }));
      } catch (error) {
        finished = error.name !== "AbortError";
        if (error.name !== "AbortError") setStates((current) => ({ ...current, ...Object.fromEntries(jobs.map(({ dayKey }) => [dayKey, "error"])) }));
      }
    }, libraryOpen ? 700 : sessionActive ? 12_000 : 1000);
    return () => {
      clearTimeout(timer); controller.abort();
      if (!finished) jobs.forEach((job) => { if (attemptsRef.current.get(job.dayKey) === job.fingerprint) attemptsRef.current.delete(job.dayKey); });
    };
  }, [entriesByDay, libraryOpen, ready, records, sessionActive, timeline]);

  const mutate = useCallback(async (dayKey, momentId, patch) => {
    epochRef.current += 1;
    const result = patch === null ? await forgetJournalMoment(dayKey, momentId) : await updateJournalMoment(dayKey, momentId, patch);
    if (!result) return null;
    const removed = new Set(result.removedEntryIds);
    const nextEntries = entriesRef.current.filter((entry) => !removed.has(entry.id));
    const nextRecords = { ...recordsRef.current, [dayKey]: result.record };
    entriesRef.current = nextEntries;
    recordsRef.current = nextRecords;
    setEntries(nextEntries);
    setRecords(nextRecords);
    memoryChangeRef.current?.(buildJournalContext(nextRecords, nextEntries), { reset: true });
    return result.record;
  }, []);
  const updateMoment = useCallback((dayKey, id, patch) => mutate(dayKey, id, patch), [mutate]);
  const forgetMoment = useCallback((dayKey, id) => mutate(dayKey, id, null), [mutate]);
  const retry = useCallback((dayKey) => { attemptsRef.current.delete(dayKey); setStates((current) => ({ ...current, [dayKey]: "idle" })); setRecords((current) => ({ ...current })); }, []);
  const getContext = useCallback(() => buildJournalContext(recordsRef.current, entriesRef.current), []);
  return { entries, records, states, ready, entriesByDay, timeline, recordMessage, updateMoment, forgetMoment, retry, getContext };
}
