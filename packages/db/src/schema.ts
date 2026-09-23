import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

// ── Enums (internal status, tidak hard-code "sepatu"/"pasang") ───────────
export const planEnum = pgEnum('plan', ['free', 'solo', 'outlet', 'multi', 'enterprise'])
export const userRoleEnum = pgEnum('user_role', ['owner', 'staff', 'tech'])
export const pricingUnitEnum = pgEnum('pricing_unit', ['per_item', 'per_pair', 'per_sqm', 'per_pcs'])
export const orderStatusEnum = pgEnum('order_status', [
  'received',
  'in_progress',
  'finishing',
  'ready',
  'completed',
  'abandoned',
])
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial', 'paid'])
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'qris', 'transfer'])
export const photoTypeEnum = pgEnum('photo_type', [
  'before',
  'after',
  'issue',
  'signature',
  'pickup_proof',
])
export const notifTypeEnum = pgEnum('notif_type', [
  'received',
  'ready',
  'reminder_14',
  'reminder_30',
  'payment',
  'review_request',
])

// ── tenants ──────────────────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  city: text('city'),
  logoUrl: text('logo_url'),
  whatsapp: text('whatsapp'),
  googleMapsReviewUrl: text('google_maps_review_url'),
  plan: planEnum('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  orderQuotaUsed: integer('order_quota_used').notNull().default(0),
  verticalPreset: text('vertical_preset').notNull().default('shoe'),
  // "pasang" | "pcs" | "unit" | "m²" — kunci ekspansi vertikal
  itemLabel: text('item_label').notNull().default('pasang'),
  itemLabelPlural: text('item_label_plural').notNull().default('pasang'),
  disclaimerText: text('disclaimer_text'),
  storagePhotoRetentionDays: integer('storage_photo_retention_days').notNull().default(60),
  requirePickupProof: boolean('require_pickup_proof').notNull().default(true),
  publishConsentDefault: boolean('publish_consent_default').notNull().default(true),
  shareCardConfig: jsonb('share_card_config').$type<{
    outletCounterOn: boolean
    counterLabel?: string
    badgeMap: Record<string, string>
  }>().notNull().default({ outletCounterOn: true, badgeMap: {} }),
  statusLabels: jsonb('status_labels').$type<Record<string, string>>().notNull().default({
    received: 'Diterima',
    in_progress: 'Dikerjakan',
    finishing: 'Finishing',
    ready: 'Siap Diambil',
    completed: 'Selesai',
    abandoned: 'Diikhlaskan',
  }),
  waTemplates: jsonb('wa_templates').$type<Record<string, string>>().notNull().default({
    received: 'Halo {customer_name}, {{outlet}} sudah menerima {item_label} Anda:\n{item}\nKode: *{order_code}*\nEstimasi siap: *{estimated_ready}*\nTotal: {total}\nLacak status di sini: {resi_url}',
    ready: 'Halo {customer_name} 👋\n{outlet} mengabari {item_label} Anda SUDAH SIAP DIAMBIL 🎉\n{item}\nKode: {order_code}\nLihat hasil & status: {resi_url}\nSisa bayar: {remaining}\nJam buka: {opening_hours}',
    reminder_14: 'Halo {customer_name}, {item_label} Anda di {outlet} sudah selesai sejak {ready_date} dan belum diambil. Mohon diambil ya 🙏 {resi_url}',
    reminder_30: 'Halo {customer_name}, mohon segera ambil {item_label} Anda di {outlet} (kode {order_code}). Sesuai kebijakan penitipan, biaya penitipan berlaku setelah 30 hari. {resi_url}',
    payment: 'Halo {customer_name}, terima kasih sudah mempercayakan {outlet}. Sisa pembayaran order {order_code}: *{remaining}*. Bisa dibayar via QRIS/transfer. {resi_url}',
    review_request: 'Halo {customer_name} 😊\nMakasih sudah mempercayakan {item} ke kami!\nLihat hasilnya di sini: {resi_url}\n\nKalau puas, boleh bantu kami lewat review singkat di Google Maps ⭐⭐⭐⭐⭐\n👉 {review_url}\n\n1 menit aja, artinya besar buat outlet kecil kami 🙏',
  }),
  openingHours: text('opening_hours'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── users ────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    role: userRoleEnum('role').notNull().default('staff'),
    pinHash: text('pin_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_tenant_phone_uq').on(t.tenantId, t.phone), index('users_tenant_idx').on(t.tenantId)],
)

// ── services (katalog konfigurabel) ──────────────────────────────────────
export const services = pgTable(
  'services',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    price: integer('price').notNull().default(0),
    durationDays: integer('duration_days').notNull().default(3),
    category: text('category').notNull().default('Cuci'),
    pricingUnit: pricingUnitEnum('pricing_unit').notNull().default('per_pair'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    badge: text('badge').notNull().default('✨ Glow Up Complete'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('services_tenant_idx').on(t.tenantId)],
)

// ── addons ───────────────────────────────────────────────────────────────
export const addons = pgTable(
  'addons',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    price: integer('price').notNull().default(0),
    extraDurationDays: integer('extra_duration_days').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('addons_tenant_idx').on(t.tenantId)],
)

// ── customers ────────────────────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    address: text('address'),
    totalOrders: integer('total_orders').notNull().default(0),
    totalSpent: integer('total_spent').notNull().default(0),
    lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_tenant_phone_uq').on(t.tenantId, t.phone), index('customers_tenant_idx').on(t.tenantId)],
)

// ── orders ───────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderCode: text('order_code').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    status: orderStatusEnum('status').notNull().default('received'),
    subtotal: integer('subtotal').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull().default(0),
    paidAmount: integer('paid_amount').notNull().default(0),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    estimatedReadyAt: timestamp('estimated_ready_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    pickedUpByName: text('picked_up_by_name'),
    pickupConfirmedByUserId: text('pickup_confirmed_by_user_id').references(() => users.id),
    disclaimerAcceptedAt: timestamp('disclaimer_accepted_at', { withTimezone: true }),
    disclaimerAcceptedBy: text('disclaimer_accepted_by'),
    signatureUrl: text('signature_url'),
    publishConsent: boolean('publish_consent').notNull().default(false),
    reviewRequestSentAt: timestamp('review_request_sent_at', { withTimezone: true }),
    reviewRequestSentByUserId: text('review_request_sent_by_user_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_tenant_code_uq').on(t.tenantId, t.orderCode),
    index('orders_tenant_status_idx').on(t.tenantId, t.status),
    index('orders_tenant_received_idx').on(t.tenantId, t.receivedAt),
    index('orders_tenant_payment_idx').on(t.tenantId, t.paymentStatus),
  ],
)

// ── order_items ──────────────────────────────────────────────────────────
export const orderItems = pgTable(
  'order_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull().default(''),
    model: text('model'),
    color: text('color'),
    conditionTags: jsonb('condition_tags').$type<string[]>().notNull().default([]),
    conditionNotes: text('condition_notes'),
    quantity: integer('quantity').notNull().default(1),
    unitValue: integer('unit_value').notNull().default(0),
    lineTotal: integer('line_total').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
)

// ── order_item_services (price snapshot) ─────────────────────────────────
export const orderItemServices = pgTable(
  'order_item_services',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderItemId: text('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    serviceId: text('service_id').references(() => services.id),
    serviceName: text('service_name').notNull(),
    priceSnapshot: integer('price_snapshot').notNull().default(0),
    addonSnapshot: jsonb('addon_snapshot').$type<{ id: string; name: string; price: number; extraDurationDays: number }[]>().notNull().default([]),
  },
  (t) => [index('order_item_services_item_idx').on(t.orderItemId)],
)

// ── photos ───────────────────────────────────────────────────────────────
export const photos = pgTable(
  'photos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderItemId: text('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
    type: photoTypeEnum('type').notNull(),
    url: text('url').notNull(),
    thumbUrl: text('thumb_url'),
    sizeBytes: integer('size_bytes'),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
    uploadedByUserId: text('uploaded_by_user_id').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('photos_order_idx').on(t.orderId, t.type),
    index('photos_expires_idx').on(t.expiresAt),
  ],
)

// ── status_logs ──────────────────────────────────────────────────────────
export const statusLogs = pgTable(
  'status_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    userId: text('user_id').references(() => users.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('status_logs_order_idx').on(t.orderId)],
)

// ── payments ─────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    method: paymentMethodEnum('method').notNull().default('cash'),
    receivedByUserId: text('received_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (t) => [index('payments_order_idx').on(t.orderId)],
)

// ── notifications_log ────────────────────────────────────────────────────
export const notificationsLog = pgTable(
  'notifications_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: notifTypeEnum('type').notNull(),
    channel: text('channel').notNull().default('wa_deeplink'),
    sentByUserId: text('sent_by_user_id').references(() => users.id),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_log_order_idx').on(t.orderId)],
)

// ── share_events (bukti ROI gamifikasi) ──────────────────────────────────
export const shareEvents = pgTable(
  'share_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    actor: text('actor').notNull().default('customer'), // 'customer' | 'staff'
    format: text('format').notNull().default('1:1'), // '1:1' | '9:16'
    method: text('method').notNull().default('web_share'), // 'web_share' | 'download'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('share_events_tenant_idx').on(t.tenantId, t.createdAt)],
)

// ── subscriptions ────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    plan: planEnum('plan').notNull(),
    period: text('period').notNull().default('month'),
    amount: integer('amount').notNull().default(0),
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    paymentRef: text('payment_ref'),
  },
  (t) => [index('subscriptions_tenant_idx').on(t.tenantId)],
)

// ── resi_views ───────────────────────────────────────────────────────────
export const resiViews = pgTable(
  'resi_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    viewedByUserId: text('viewed_by_user_id'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (t) => [index('resi_views_order_idx').on(t.orderId)],
)

// ── offline_queue (sinkronisasi PWA saat online) ─────────────────────────
export const offlineQueue = pgTable(
  'offline_queue',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('offline_queue_tenant_client_uq').on(t.tenantId, t.clientId)],
)

export type Tenant = typeof tenants.$inferSelect
export type User = typeof users.$inferSelect
export type Order = typeof orders.$inferSelect
export type Customer = typeof customers.$inferSelect
