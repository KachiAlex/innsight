import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  DoorOpen,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Button,
  Field,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Stepper,
  TextInput,
  Textarea,
} from '../components/ui';
import type { Step } from '../components/ui';
import { formatMoney } from '../lib/money';
import styles from './OnboardingPage.module.css';

/* ------------------------------------------------------------------ types */

interface RoomTypeDraft {
  key: string;
  name: string;
  roomType: string;
  maxOccupancy: number;
  baseRate: string;
  perFloor: number;
}

interface HallDraft {
  key: string;
  name: string;
  capacity: string;
  location: string;
}

interface Existing {
  categories: { id: string; name: string }[];
  ratePlans: { id: string; name: string }[];
  rooms: { roomNumber: string }[];
  halls: { name: string }[];
}

interface RoomProgress {
  created: number;
  skipped: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const STEPS: Step[] = [
  { key: 'welcome', label: 'Welcome', description: 'Property basics' },
  { key: 'types', label: 'Room types', description: 'Categories & rates' },
  { key: 'rooms', label: 'Rooms', description: 'Generate inventory' },
  { key: 'facilities', label: 'Facilities', description: 'Amenities & halls' },
  { key: 'review', label: 'Finish', description: 'Review & launch' },
];

const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'suite', label: 'Suite' },
];

const AMENITY_OPTIONS = [
  'Free WiFi',
  'Swimming pool',
  'Gym / fitness centre',
  'Restaurant',
  'Bar / lounge',
  'Spa',
  'Parking',
  'Conference facilities',
  'Airport shuttle',
  'Laundry service',
  'Room service',
  '24-hour front desk',
];

const CATEGORY_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const DEFAULT_TYPES: RoomTypeDraft[] = [
  { key: uid(), name: 'Standard Single', roomType: 'single', maxOccupancy: 1, baseRate: '', perFloor: 4 },
  { key: uid(), name: 'Standard Double', roomType: 'double', maxOccupancy: 2, baseRate: '', perFloor: 3 },
  { key: uid(), name: 'Deluxe', roomType: 'deluxe', maxOccupancy: 3, baseRate: '', perFloor: 2 },
  { key: uid(), name: 'Suite', roomType: 'suite', maxOccupancy: 4, baseRate: '', perFloor: 1 },
];

/* ------------------------------------------------------------------ page */

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.tenantId;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<Existing>({
    categories: [],
    ratePlans: [],
    rooms: [],
    halls: [],
  });

  // Step 1 — property basics
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [propertyDesc, setPropertyDesc] = useState('');

  // Step 2 — room types
  const [roomTypes, setRoomTypes] = useState<RoomTypeDraft[]>(DEFAULT_TYPES);
  const [savedTypes, setSavedTypes] = useState(false);

  // Step 3 — rooms
  const [startFloor, setStartFloor] = useState('1');
  const [endFloor, setEndFloor] = useState('3');
  const [roomProgress, setRoomProgress] = useState<RoomProgress | null>(null);

  // Step 4 — facilities
  const [amenities, setAmenities] = useState<string[]>(['Free WiFi', 'Parking', '24-hour front desk']);
  const [halls, setHalls] = useState<HallDraft[]>([]);

  /* ------------------------------------------------------- initial fetch */

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const [cats, plans, rooms, hallList, settings] = await Promise.all([
          api.get(`/tenants/${tenantId}/room-categories`).catch(() => ({ data: { data: [] } })),
          api.get(`/tenants/${tenantId}/rate-plans`).catch(() => ({ data: { data: [] } })),
          api.get(`/tenants/${tenantId}/rooms?limit=500`).catch(() => ({ data: { data: [] } })),
          api.get(`/tenants/${tenantId}/halls`).catch(() => ({ data: { data: [] } })),
          api.get(`/tenants/${tenantId}/settings`).catch(() => ({ data: { data: {} } })),
        ]);
        setExisting({
          categories: cats.data?.data ?? [],
          ratePlans: plans.data?.data ?? [],
          rooms: rooms.data?.data ?? [],
          halls: hallList.data?.data ?? [],
        });
        const other = settings.data?.data?.otherSettings;
        if (other?.checkInTime) setCheckInTime(other.checkInTime);
        if (other?.checkOutTime) setCheckOutTime(other.checkOutTime);
        if (other?.propertyDescription) setPropertyDesc(other.propertyDescription);
        if (Array.isArray(other?.amenities)) setAmenities(other.amenities);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  /* -------------------------------------------------------------- helpers */

  const sf = parseInt(startFloor, 10);
  const ef = parseInt(endFloor, 10);
  const floorsValid = Number.isInteger(sf) && Number.isInteger(ef) && sf >= 1 && ef >= sf;
  const floorCount = floorsValid ? ef - sf + 1 : 0;

  const activeTypes = roomTypes.filter((t) => t.name.trim() && t.perFloor > 0);

  const roomPlan = useMemo(() => {
    // floor*100 + sequential position, types packed in order per floor
    const plan: { type: RoomTypeDraft; numbers: string[] }[] = [];
    for (const t of activeTypes) plan.push({ type: t, numbers: [] });
    for (let f = sf; f <= ef; f++) {
      let seq = 1;
      for (const p of plan) {
        for (let i = 0; i < p.type.perFloor; i++) {
          p.numbers.push(`${f * 100 + seq++}`);
        }
      }
    }
    return plan;
  }, [activeTypes, sf, ef]);

  const totalRooms = roomPlan.reduce((sum, p) => sum + p.numbers.length, 0);
  const existingNumbers = useMemo(() => new Set(existing.rooms.map((r) => r.roomNumber)), [existing]);

  const typeColor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

  const patchOtherSettings = async (patch: Record<string, unknown>) => {
    const res = await api.get(`/tenants/${tenantId}/settings`);
    const current = res.data?.data?.otherSettings ?? {};
    await api.patch(`/tenants/${tenantId}/settings`, {
      otherSettings: { ...current, ...patch },
    });
  };

  /* --------------------------------------------------------- step savers */

  const saveProperty = async () => {
    await patchOtherSettings({ checkInTime, checkOutTime, propertyDescription: propertyDesc });
  };

  /** Find-or-create categories + a rate plan per room type. */
  const saveRoomTypes = async () => {
    if (savedTypes) return;
    const cats = [...existing.categories];
    const plans = [...existing.ratePlans];
    const missingRates = activeTypes.filter((t) => !t.baseRate || Number(t.baseRate) <= 0);
    if (missingRates.length > 0) {
      throw new Error(`Set a nightly rate for: ${missingRates.map((t) => t.name).join(', ')}`);
    }

    for (let i = 0; i < activeTypes.length; i++) {
      const t = activeTypes[i];
      if (!cats.some((c) => c.name.toLowerCase() === t.name.trim().toLowerCase())) {
        const res = await api.post(`/tenants/${tenantId}/room-categories`, {
          name: t.name.trim(),
          color: typeColor(i),
        });
        cats.push({ id: res.data?.data?.id, name: t.name.trim() });
      }
      const catId = cats.find((c) => c.name.toLowerCase() === t.name.trim().toLowerCase())?.id;
      const planName = `${t.name.trim()} Rate`;
      if (!plans.some((p) => p.name.toLowerCase() === planName.toLowerCase())) {
        const res = await api.post(`/tenants/${tenantId}/rate-plans`, {
          name: planName,
          baseRate: Number(t.baseRate),
          currency: 'NGN',
          categoryId: catId,
        });
        plans.push({ id: res.data?.data?.id, name: planName });
      }
    }
    setExisting((e) => ({ ...e, categories: cats, ratePlans: plans }));
    setSavedTypes(true);
  };

  const saveRooms = async () => {
    let created = 0;
    let skipped = 0;
    for (const p of roomPlan) {
      const numbers = p.numbers.filter((n) => !existingNumbers.has(n));
      skipped += p.numbers.length - numbers.length;
      if (numbers.length === 0) continue;
      const catId = existing.categories.find(
        (c) => c.name.toLowerCase() === p.type.name.trim().toLowerCase()
      )?.id;
      const planId = existing.ratePlans.find(
        (r) => r.name.toLowerCase() === `${p.type.name.trim()} rate`
      )?.id;
      const res = await api.post(`/tenants/${tenantId}/rooms/bulk`, {
        roomNumbers: numbers,
        roomType: p.type.roomType,
        maxOccupancy: p.type.maxOccupancy,
        categoryId: catId ?? null,
        ratePlanId: planId ?? null,
      });
      created += res.data?.data?.created ?? 0;
      skipped += res.data?.data?.skipped ?? 0;
    }
    setRoomProgress({ created, skipped });
    setExisting((e) => ({
      ...e,
      rooms: [...e.rooms, ...roomPlan.flatMap((p) => p.numbers.map((n) => ({ roomNumber: n })))],
    }));
  };

  const saveFacilities = async () => {
    await patchOtherSettings({ amenities });
    const hallNames = new Set(existing.halls.map((h) => h.name.toLowerCase()));
    for (const h of halls) {
      if (!h.name.trim() || hallNames.has(h.name.trim().toLowerCase())) continue;
      await api.post(`/tenants/${tenantId}/halls`, {
        name: h.name.trim(),
        capacity: Number(h.capacity) || 1,
        location: h.location.trim() || undefined,
      });
      hallNames.add(h.name.trim().toLowerCase());
    }
  };

  const finish = async () => {
    await patchOtherSettings({
      onboarding: { completed: true, completedAt: new Date().toISOString() },
    });
    toast.success('Hotel setup complete — welcome aboard!');
    navigate('/dashboard');
  };

  /* -------------------------------------------------------------- nav */

  const next = async () => {
    setSaving(true);
    try {
      if (step === 0) await saveProperty();
      else if (step === 1) await saveRoomTypes();
      else if (step === 2) await saveRooms();
      else if (step === 3) await saveFacilities();
      else if (step === 4) {
        await finish();
        return;
      }
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || e?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const skip = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const updateType = (key: string, patch: Partial<RoomTypeDraft>) => {
    setSavedTypes(false);
    setRoomTypes((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  };
  const updateHall = (key: string, patch: Partial<HallDraft>) =>
    setHalls((hs) => hs.map((h) => (h.key === key ? { ...h, ...patch } : h)));

  /* -------------------------------------------------------------- render */

  if (!tenantId) return null;

  return (
    <Layout>
      <PageHeader
        title="Hotel setup wizard"
        subtitle="Get your property ready to take bookings in a few guided steps"
      />
      <div className={styles.wizard}>
        <Stepper steps={STEPS} current={step} onStepClick={(i) => i < step && setStep(i)} />

        {loading ? (
          <Panel>
            <Skeleton height={200} />
          </Panel>
        ) : (
          <>
            {/* -------------------------------------------------- step 0 */}
            {step === 0 && (
              <Panel title="Welcome to InnSight" subtitle="A few basics before we build your inventory">
                <div className={styles.intro}>
                  <p>
                    This wizard walks you through <strong>room types</strong>, <strong>room
                    inventory</strong>, and <strong>facilities</strong>. Everything you configure
                    here can be changed later in Hotel Settings — nothing is permanent.
                  </p>
                </div>
                <div className={styles.formGrid}>
                  <Field label="Check-in time" hint="Default arrival time for guests">
                    <TextInput type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
                  </Field>
                  <Field label="Check-out time" hint="Default departure time">
                    <TextInput type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
                  </Field>
                </div>
                <Field label="About your property" hint="Optional — shown on your guest microsite">
                  <Textarea
                    rows={3}
                    value={propertyDesc}
                    onChange={(e) => setPropertyDesc(e.target.value)}
                    placeholder="A boutique hotel in the heart of the city…"
                  />
                </Field>
                {existing.rooms.length > 0 && (
                  <div className={styles.notice}>
                    <Check size={14} /> You already have <strong>{existing.rooms.length}</strong> rooms
                    configured — the wizard will skip numbers that exist and only add what's missing.
                  </div>
                )}
              </Panel>
            )}

            {/* -------------------------------------------------- step 1 */}
            {step === 1 && (
              <Panel
                title="Define your room types"
                subtitle="Each type becomes a category with its own nightly rate plan"
                actions={
                  <Button
                    variant="secondary"
                    icon={<Plus size={14} />}
                    onClick={() =>
                      setRoomTypes((ts) => [
                        ...ts,
                        { key: uid(), name: '', roomType: 'double', maxOccupancy: 2, baseRate: '', perFloor: 2 },
                      ])
                    }
                  >
                    Add type
                  </Button>
                }
              >
                <div className={styles.typeList}>
                  {roomTypes.map((t) => (
                    <div key={t.key} className={styles.typeRow}>
                      <Field label="Type name" required>
                        <TextInput
                          value={t.name}
                          placeholder="e.g. Ocean View Suite"
                          onChange={(e) => updateType(t.key, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Kind">
                        <Select value={t.roomType} onChange={(e) => updateType(t.key, { roomType: e.target.value })}>
                          {ROOM_TYPES.map((rt) => (
                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Sleeps">
                        <TextInput
                          type="number"
                          min={1}
                          max={10}
                          value={t.maxOccupancy}
                          onChange={(e) => updateType(t.key, { maxOccupancy: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </Field>
                      <Field label="Nightly rate (₦)" required>
                        <TextInput
                          type="number"
                          min={0}
                          value={t.baseRate}
                          placeholder="25000"
                          onChange={(e) => updateType(t.key, { baseRate: e.target.value })}
                        />
                      </Field>
                      <Field label="Rooms per floor">
                        <TextInput
                          type="number"
                          min={0}
                          max={50}
                          value={t.perFloor}
                          onChange={(e) => updateType(t.key, { perFloor: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </Field>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label={`Remove ${t.name || 'room type'}`}
                        onClick={() => setRoomTypes((ts) => ts.filter((x) => x.key !== t.key))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {activeTypes.length === 0 && (
                  <div className={styles.notice}>Add at least one room type to continue.</div>
                )}
              </Panel>
            )}

            {/* -------------------------------------------------- step 2 */}
            {step === 2 && (
              <Panel title="Generate your rooms" subtitle="Rooms are numbered floor × 100 + position">
                <div className={styles.formGrid}>
                  <Field label="Start floor" required>
                    <TextInput type="number" min={1} value={startFloor} onChange={(e) => setStartFloor(e.target.value)} />
                  </Field>
                  <Field label="End floor" required>
                    <TextInput type="number" min={1} value={endFloor} onChange={(e) => setEndFloor(e.target.value)} />
                  </Field>
                </div>
                {floorsValid && totalRooms > 0 && (
                  <div className={styles.preview}>
                    <p className={styles.previewTitle}>
                      <DoorOpen size={15} /> {totalRooms} rooms across {floorCount} floor{floorCount !== 1 ? 's' : ''}
                    </p>
                    <div className={styles.previewTypes}>
                      {roomPlan.map((p) => (
                        <span key={p.type.key} className={styles.previewChip}>
                          {p.numbers.length} × {p.type.name}
                          <em>{p.numbers[0]}–{p.numbers[p.numbers.length - 1]}</em>
                        </span>
                      ))}
                    </div>
                    {existing.rooms.length > 0 && (
                      <p className={styles.previewNote}>
                        Numbers already in your inventory are skipped automatically.
                      </p>
                    )}
                  </div>
                )}
                {floorsValid && totalRooms === 0 && (
                  <div className={styles.notice}>Go back and give at least one type a "rooms per floor" count.</div>
                )}
                {!floorsValid && <div className={styles.notice}>Enter a valid floor range (start ≤ end).</div>}
                {roomProgress && (
                  <div className={styles.notice}>
                    <Check size={14} /> Created <strong>{roomProgress.created}</strong> rooms
                    {roomProgress.skipped > 0 && `, skipped ${roomProgress.skipped} existing`}.
                    Click Next to continue.
                  </div>
                )}
              </Panel>
            )}

            {/* -------------------------------------------------- step 3 */}
            {step === 3 && (
              <Panel title="Facilities" subtitle="Amenities guests see, plus bookable spaces like halls">
                <Field label="Property amenities" hint="Tick everything your property offers">
                  <div className={styles.amenityGrid}>
                    {AMENITY_OPTIONS.map((a) => (
                      <label key={a} className={`${styles.amenity} ${amenities.includes(a) ? styles.amenityOn : ''}`}>
                        <input
                          type="checkbox"
                          checked={amenities.includes(a)}
                          onChange={(e) =>
                            setAmenities((list) =>
                              e.target.checked ? [...list, a] : list.filter((x) => x !== a)
                            )
                          }
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </Field>

                <div className={styles.hallHeader}>
                  <h3>
                    <Users size={15} /> Event spaces <span>(optional)</span>
                  </h3>
                  <Button
                    variant="secondary"
                    icon={<Plus size={14} />}
                    onClick={() => setHalls((hs) => [...hs, { key: uid(), name: '', capacity: '', location: '' }])}
                  >
                    Add hall
                  </Button>
                </div>
                {halls.length === 0 && (
                  <p className={styles.muted}>No event spaces — you can add halls later from Group Bookings.</p>
                )}
                <div className={styles.typeList}>
                  {halls.map((h) => (
                    <div key={h.key} className={styles.hallRow}>
                      <Field label="Hall name">
                        <TextInput value={h.name} placeholder="Grand Ballroom" onChange={(e) => updateHall(h.key, { name: e.target.value })} />
                      </Field>
                      <Field label="Capacity">
                        <TextInput type="number" min={1} value={h.capacity} placeholder="200" onChange={(e) => updateHall(h.key, { capacity: e.target.value })} />
                      </Field>
                      <Field label="Location">
                        <TextInput value={h.location} placeholder="Ground floor" onChange={(e) => updateHall(h.key, { location: e.target.value })} />
                      </Field>
                      <button type="button" className={styles.removeBtn} aria-label="Remove hall" onClick={() => setHalls((hs) => hs.filter((x) => x.key !== h.key))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* -------------------------------------------------- step 4 */}
            {step === 4 && (
              <Panel title="You're all set" subtitle="Here's what your property looks like now">
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <Building2 size={20} />
                    <strong>{existing.categories.length || activeTypes.length}</strong>
                    <span>Room types</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <DoorOpen size={20} />
                    <strong>{existing.rooms.length}</strong>
                    <span>Rooms</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <Sparkles size={20} />
                    <strong>{amenities.length}</strong>
                    <span>Amenities</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <Users size={20} />
                    <strong>{existing.halls.length + halls.filter((h) => h.name.trim()).length}</strong>
                    <span>Event spaces</span>
                  </div>
                </div>
                <div className={styles.rateList}>
                  {activeTypes.map((t) => (
                    <div key={t.key} className={styles.rateRow}>
                      <span className={styles.dot} style={{ background: typeColor(roomTypes.indexOf(t)) }} />
                      <span className={styles.rateName}>{t.name}</span>
                      <span className={styles.muted}>sleeps {t.maxOccupancy}</span>
                      <strong>{t.baseRate ? formatMoney(Number(t.baseRate)) : '—'}/night</strong>
                    </div>
                  ))}
                </div>
                <div className={styles.notice}>
                  <Check size={14} /> Finish marks your setup complete. You can always adjust everything
                  under <strong>Hotel Settings</strong>, <strong>Rooms</strong>, and <strong>Rate Plans</strong>.
                </div>
              </Panel>
            )}

            {/* --------------------------------------------------- footer */}
            <div className={styles.footer}>
              <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={back} disabled={step === 0 || saving}>
                Back
              </Button>
              <div className={styles.footerRight}>
                {step > 0 && step < STEPS.length - 1 && (
                  <Button variant="ghost" onClick={skip} disabled={saving}>
                    Skip
                  </Button>
                )}
                <Button
                  variant="primary"
                  loading={saving}
                  disabled={
                    (step === 1 && activeTypes.length === 0) ||
                    (step === 2 && (!floorsValid || totalRooms === 0))
                  }
                  onClick={next}
                >
                  {step === STEPS.length - 1 ? 'Finish setup' : 'Save & continue'}
                  {step < STEPS.length - 1 && <ArrowRight size={15} style={{ marginLeft: 6 }} />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
