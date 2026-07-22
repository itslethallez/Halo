"use client";

import { useState, useTransition } from "react";
import { askAssistantAction, getIntroMessage, searchSlotsAction, submitBookingRequestAction, type SlotOption } from "./actions";

interface WorkerOption {
  id: string;
  displayName: string;
  bio: string | null;
  services: { id: string; name: string; durationMinutes: number; priceCents: number }[];
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function BookingFlow({ workers }: { workers: WorkerOption[] }) {
  const [workerId, setWorkerId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [confirmation, setConfirmation] = useState<{ bookingId: string; status: string } | null>(null);
  const [assistantLog, setAssistantLog] = useState<{ from: "assistant" | "you"; text: string }[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [pending, startTransition] = useTransition();

  const worker = workers.find((w) => w.id === workerId);

  async function loadIntro(id: string) {
    const intro = await getIntroMessage(id);
    setAssistantLog([{ from: "assistant", text: intro }]);
  }

  async function loadSlots(wId: string, sId: string) {
    const results = await searchSlotsAction(wId, sId);
    setSlots(results);
  }

  async function sendToAssistant() {
    if (!assistantInput.trim() || !workerId) return;
    const message = assistantInput;
    setAssistantLog((log) => [...log, { from: "you", text: message }]);
    setAssistantInput("");
    const result = await askAssistantAction(workerId, message);
    setAssistantLog((log) => [...log, { from: "assistant", text: result.reply }]);
  }

  if (confirmation) {
    return (
      <div className="card mt-8 p-6">
        <h2 className="text-lg font-semibold text-accent">Request sent!</h2>
        <p className="mt-2 text-sm text-text-muted">
          Your booking request is now <strong className="text-text">{confirmation.status.replaceAll("_", " ").toLowerCase()}</strong>. We&apos;ll be
          in touch shortly to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="card p-5">
        <label className="text-sm font-medium text-text-muted">Choose a therapist</label>
        <select
          className={inputClass}
          value={workerId}
          onChange={(e) => {
            setWorkerId(e.target.value);
            setServiceId("");
            setSlots([]);
            setSelectedSlot(null);
            void loadIntro(e.target.value);
          }}
        >
          <option value="">Select...</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.displayName}
            </option>
          ))}
        </select>

        {worker && (
          <>
            <label className="mt-4 block text-sm font-medium text-text-muted">Choose a service</label>
            <select
              className={inputClass}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSelectedSlot(null);
                startTransition(() => void loadSlots(workerId, e.target.value));
              }}
            >
              <option value="">Select...</option>
              {worker.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.durationMinutes} min — ${(s.priceCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </>
        )}

        {serviceId && (
          <>
            <p className="mt-4 text-sm font-medium text-text-muted">Available times</p>
            {pending && <p className="mt-1 text-sm text-text-muted">Checking real availability...</p>}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.startIso}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    selectedSlot?.startIso === slot.startIso
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-text hover:border-accent"
                  }`}
                >
                  {new Date(slot.startIso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
              {!pending && slots.length === 0 && <p className="col-span-full text-sm text-text-muted">No genuinely available slots found in the next two weeks.</p>}
            </div>
          </>
        )}
      </div>

      {selectedSlot && (
        <form
          className="card space-y-3 p-5"
          action={async (formData) => {
            const result = await submitBookingRequestAction(formData);
            setConfirmation(result);
          }}
        >
          <input type="hidden" name="workerId" value={workerId} />
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="startIso" value={selectedSlot.startIso} />
          <input type="hidden" name="endIso" value={selectedSlot.endIso} />

          <p className="text-sm font-medium text-text">Your details</p>
          <input name="fullName" required placeholder="Full name" className={inputClass.replace("mt-1 ", "")} />
          <input name="phone" required placeholder="Mobile number" className={inputClass.replace("mt-1 ", "")} />
          <input name="email" type="email" placeholder="Email" className={inputClass.replace("mt-1 ", "")} />
          <input name="suburb" required placeholder="Suburb" className={inputClass.replace("mt-1 ", "")} />

          <button className="btn-primary w-full text-sm">
            Request this appointment
          </button>
        </form>
      )}

      {workerId && (
        <div className="card p-5">
          <p className="text-sm font-medium text-text">Ask the booking assistant</p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-surface-raised p-3">
            {assistantLog.map((entry, i) => (
              <p key={i} className={entry.from === "assistant" ? "text-sm text-text" : "text-right text-sm text-accent"}>
                {entry.text}
              </p>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendToAssistant()}
              placeholder="Type a question..."
              className={`flex-1 ${inputClass.replace("mt-1 ", "")}`}
            />
            <button onClick={sendToAssistant} className="btn-primary text-sm">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
