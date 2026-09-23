CREATE TYPE "public"."notif_type" AS ENUM('received', 'ready', 'reminder_14', 'reminder_30', 'payment', 'review_request');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('received', 'in_progress', 'finishing', 'ready', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'qris', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."photo_type" AS ENUM('before', 'after', 'issue', 'signature', 'pickup_proof');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'solo', 'outlet', 'multi', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."pricing_unit" AS ENUM('per_item', 'per_pair', 'per_sqm', 'per_pcs');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'staff', 'tech');--> statement-breakpoint
CREATE TABLE "addons" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"extra_duration_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"last_order_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"type" "notif_type" NOT NULL,
	"channel" text DEFAULT 'wa_deeplink' NOT NULL,
	"sent_by_user_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_services" (
	"id" text PRIMARY KEY NOT NULL,
	"order_item_id" text NOT NULL,
	"service_id" text,
	"service_name" text NOT NULL,
	"price_snapshot" integer DEFAULT 0 NOT NULL,
	"addon_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text,
	"color" text,
	"condition_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition_notes" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_value" integer DEFAULT 0 NOT NULL,
	"line_total" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"order_code" text NOT NULL,
	"customer_id" text NOT NULL,
	"created_by_user_id" text,
	"status" "order_status" DEFAULT 'received' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_ready_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"picked_up_by_name" text,
	"pickup_confirmed_by_user_id" text,
	"disclaimer_accepted_at" timestamp with time zone,
	"disclaimer_accepted_by" text,
	"signature_url" text,
	"publish_consent" boolean DEFAULT false NOT NULL,
	"review_request_sent_at" timestamp with time zone,
	"review_request_sent_by_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"received_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" text,
	"type" "photo_type" NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text,
	"size_bytes" integer,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by_user_id" text,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resi_views" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"viewed_by_user_id" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 3 NOT NULL,
	"category" text DEFAULT 'Cuci' NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'per_pair' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"badge" text DEFAULT '✨ Glow Up Complete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"order_id" text NOT NULL,
	"actor" text DEFAULT 'customer' NOT NULL,
	"format" text DEFAULT '1:1' NOT NULL,
	"method" text DEFAULT 'web_share' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"plan" "plan" NOT NULL,
	"period" text DEFAULT 'month' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"payment_ref" text
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"city" text,
	"logo_url" text,
	"whatsapp" text,
	"google_maps_review_url" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"order_quota_used" integer DEFAULT 0 NOT NULL,
	"vertical_preset" text DEFAULT 'shoe' NOT NULL,
	"item_label" text DEFAULT 'pasang' NOT NULL,
	"item_label_plural" text DEFAULT 'pasang' NOT NULL,
	"disclaimer_text" text,
	"storage_photo_retention_days" integer DEFAULT 60 NOT NULL,
	"require_pickup_proof" boolean DEFAULT true NOT NULL,
	"publish_consent_default" boolean DEFAULT true NOT NULL,
	"share_card_config" jsonb DEFAULT '{"outletCounterOn":true,"badgeMap":{}}'::jsonb NOT NULL,
	"status_labels" jsonb DEFAULT '{"received":"Diterima","in_progress":"Dikerjakan","finishing":"Finishing","ready":"Siap Diambil","completed":"Selesai","abandoned":"Diikhlaskan"}'::jsonb NOT NULL,
	"wa_templates" jsonb DEFAULT '{"received":"Halo {customer_name}, {{outlet}} sudah menerima {item_label} Anda:\n{item}\nKode: *{order_code}*\nEstimasi siap: *{estimated_ready}*\nTotal: {total}\nLacak status di sini: {resi_url}","ready":"Halo {customer_name} 👋\n{outlet} mengabari {item_label} Anda SUDAH SIAP DIAMBIL 🎉\n{item}\nKode: {order_code}\nLihat hasil & status: {resi_url}\nSisa bayar: {remaining}\nJam buka: {opening_hours}","reminder_14":"Halo {customer_name}, {item_label} Anda di {outlet} sudah selesai sejak {ready_date} dan belum diambil. Mohon diambil ya 🙏 {resi_url}","reminder_30":"Halo {customer_name}, mohon segera ambil {item_label} Anda di {outlet} (kode {order_code}). Sesuai kebijakan penitipan, biaya penitipan berlaku setelah 30 hari. {resi_url}","payment":"Halo {customer_name}, terima kasih sudah mempercayakan {outlet}. Sisa pembayaran order {order_code}: *{remaining}*. Bisa dibayar via QRIS/transfer. {resi_url}","review_request":"Halo {customer_name} 😊\nMakasih sudah mempercayakan {item} ke kami!\nLihat hasilnya di sini: {resi_url}\n\nKalau puas, boleh bantu kami lewat review singkat di Google Maps ⭐⭐⭐⭐⭐\n👉 {review_url}\n\n1 menit aja, artinya besar buat outlet kecil kami 🙏"}'::jsonb NOT NULL,
	"opening_hours" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"pin_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_queue" ADD CONSTRAINT "offline_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_services" ADD CONSTRAINT "order_item_services_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_services" ADD CONSTRAINT "order_item_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("pickup_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_review_request_sent_by_user_id_users_id_fk" FOREIGN KEY ("review_request_sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resi_views" ADD CONSTRAINT "resi_views_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addons_tenant_idx" ON "addons" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_uq" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_log_order_idx" ON "notifications_log" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_queue_tenant_client_uq" ON "offline_queue" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "order_item_services_item_idx" ON "order_item_services" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_code_uq" ON "orders" USING btree ("tenant_id","order_code");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_tenant_received_idx" ON "orders" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "orders_tenant_payment_idx" ON "orders" USING btree ("tenant_id","payment_status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "photos_order_idx" ON "photos" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "photos_expires_idx" ON "photos" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "resi_views_order_idx" ON "resi_views" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "services_tenant_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "share_events_tenant_idx" ON "share_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "status_logs_order_idx" ON "status_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_phone_uq" ON "users" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");
-- Guard integritas (PRD §10): order tidak boleh 'completed' tanpa >=1 foto
-- pickup_proof selama tenant.require_pickup_proof aktif.
CREATE OR REPLACE FUNCTION rawatin_guard_completed_pickup_proof() RETURNS trigger AS $$
DECLARE
  req_p boolean;
  has_p int;
BEGIN
  SELECT require_pickup_proof INTO req_p FROM tenants WHERE id = NEW.tenant_id;
  IF NEW.status = 'completed' AND COALESCE(req_p, TRUE) THEN
    SELECT count(*) INTO has_p FROM photos WHERE order_id = NEW.id AND type = 'pickup_proof';
    IF has_p < 1 THEN
      RAISE EXCEPTION 'order tidak bisa completed tanpa foto bukti pengambilan (pickup_proof)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_completed_pickup_proof
BEFORE INSERT OR UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION rawatin_guard_completed_pickup_proof();
