# Driver Allocation Logic

Implemented in `domain/driver/allocation.ts`:
`rankCandidateDrivers(job: DriverJobInput, candidates: DriverCandidate[]): RankedDriver[]`.
Pure function — no DB access — so it's fully unit-testable; the service layer
(`services/driverService.ts`) is responsible for fetching candidates and
persisting the resulting offer.

## Driver job

Fields (see `02-database-schema.md` → `DriverJob`): massage worker, pickup
location, client destination, appointment start time, estimated travel time,
estimated waiting time, return-trip flag, driver payment, special
instructions, safety requirements (derived from active `ClientRestriction`s
on the client, e.g. `DRIVER_MUST_REMAIN_NEARBY`), trip status.

## Trip statuses

`UNASSIGNED` → `OFFERED` → (`ACCEPTED` | `DECLINED` → re-offer) →
`EN_ROUTE_TO_WORKER` → `WORKER_COLLECTED` → `ARRIVED_AT_DESTINATION` →
`WAITING` (optional) → `RETURN_TRIP_STARTED` (only if `returnTripRequired`) →
`WORKER_RETURNED` → `COMPLETED`; `CANCELLED` reachable from any
non-terminal state. Full transition table lives alongside the booking one in
`domain/driver/statusMachine.ts`, same append-only history pattern
(`DriverStatusHistory`).

## Candidate scoring

Each candidate driver gets a weighted score; higher is better. All weights
are configurable per business (`Business.driverScoringWeights` JSON) with the
defaults below:

| Factor | Signal | Default weight |
|---|---|---|
| Availability | Is the driver free for the full job window (+buffer)? Hard filter — unavailable drivers are excluded, not just down-weighted. | filter |
| Distance | Distance from driver's current/starting location to pickup — closer scores higher (inverse-distance, capped). | 0.25 |
| Service area | Is the pickup/destination inside the driver's configured service area? Hard filter. | filter |
| Expected trip duration | Shorter total commitment (pickup→drop→return) scores slightly higher, to favour efficient allocation. | 0.10 |
| Driver rating | Normalised 0–1 historical rating. | 0.20 |
| Worker preference | Boost if this worker has a recorded preference for this driver (`WorkerDriverPreference`), penalty if the worker has flagged them as not-preferred. | 0.20 |
| Cost | Lower expected driver payment for an equivalent job scores higher (normalised against the job's typical cost band). | 0.15 |
| Can remain nearby | If the job requires "driver must remain nearby" (from a client restriction), only candidates who indicate willingness/ability count; otherwise neutral. | filter when required, else 0.05 |
| Current load | Fewer existing assigned/accepted jobs in the same window scores higher (avoids overloading one driver). | 0.05 |

`rankCandidateDrivers` first applies the hard filters (availability, service
area, remain-nearby-if-required), then computes
`score = Σ(weight_i * normalisedFactor_i)` for survivors, and returns them
sorted descending. Ties are broken by driver rating, then by id for
determinism (important for reproducible tests).

## Assignment modes

- **Manual**: admin or worker picks directly from the ranked list
  (`services/driverService.assignManually()`), always allowed regardless of
  score, since local knowledge can outrank the algorithm.
- **Auto-offer**: business setting `Business.autoOfferTopDriver = true` sends
  an `OFFERED` push/SMS to the top-ranked candidate; a decline advances to
  the next candidate automatically; after a configurable timeout with no
  response the job is treated as a decline and re-offered.

## Data minimisation for drivers

A driver's view of a `DriverJob` (`services/driverService.getJobForDriver()`)
strips everything except: pickup location, destination, appointment time
window, special instructions relevant to safety/access, whether a return
trip is required, and their own payment amount — never the client's full
profile, contact details beyond what's needed for the pickup, or any survey/
safety-note content. This is enforced by a dedicated DTO
(`DriverJobView`), not by trusting the caller to under-select fields.
