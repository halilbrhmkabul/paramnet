export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			accounts: {
				Row: {
					archived_at: string | null;
					bank_name: string | null;
					created_at: string;
					id: string;
					idempotency_key: string | null;
					include_in_total: boolean;
					kind: Database["public"]["Enums"]["account_kind"];
					name: string;
					opening_balance_minor: number;
					owner_id: string;
					row_version: number;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					archived_at?: string | null;
					bank_name?: string | null;
					created_at?: string;
					id?: string;
					idempotency_key?: string | null;
					include_in_total?: boolean;
					kind: Database["public"]["Enums"]["account_kind"];
					name: string;
					opening_balance_minor?: number;
					owner_id: string;
					row_version?: number;
					updated_at?: string;
				};
				Update: {
					archived_at?: string | null;
					bank_name?: string | null;
					created_at?: string;
					id?: string;
					idempotency_key?: string | null;
					include_in_total?: boolean;
					kind?: Database["public"]["Enums"]["account_kind"];
					name?: string;
					opening_balance_minor?: number;
					owner_id?: string;
					row_version?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "accounts_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			agreement_events: {
				Row: {
					actor_id: string | null;
					actor_phone_e164: string | null;
					agreement_id: string;
					channel: Database["public"]["Enums"]["event_channel"];
					created_at: string;
					id: number;
					ip_hash: string | null;
					payload: NonNullable<Json>;
					type: string;
					user_agent: string | null;
					version: number | null;
				};
				ComputedFields: never;
				Insert: {
					actor_id?: string | null;
					actor_phone_e164?: string | null;
					agreement_id: string;
					channel: Database["public"]["Enums"]["event_channel"];
					created_at?: string;
					id?: never;
					ip_hash?: string | null;
					payload?: NonNullable<Json>;
					type: string;
					user_agent?: string | null;
					version?: number | null;
				};
				Update: {
					actor_id?: string | null;
					actor_phone_e164?: string | null;
					agreement_id?: string;
					channel?: Database["public"]["Enums"]["event_channel"];
					created_at?: string;
					id?: never;
					ip_hash?: string | null;
					payload?: NonNullable<Json>;
					type?: string;
					user_agent?: string | null;
					version?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: "agreement_events_actor_id_fkey";
						columns: ["actor_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "agreement_events_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: false;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
				];
			};
			agreement_versions: {
				Row: {
					agreement_id: string;
					created_at: string;
					proposed_by: string;
					reason: string | null;
					status: Database["public"]["Enums"]["version_status"];
					terms: NonNullable<Json>;
					terms_hash: string;
					version: number;
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					created_at?: string;
					proposed_by: string;
					reason?: string | null;
					status: Database["public"]["Enums"]["version_status"];
					terms: NonNullable<Json>;
					terms_hash: string;
					version: number;
				};
				Update: {
					agreement_id?: string;
					created_at?: string;
					proposed_by?: string;
					reason?: string | null;
					status?: Database["public"]["Enums"]["version_status"];
					terms?: NonNullable<Json>;
					terms_hash?: string;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: "agreement_versions_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: false;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "agreement_versions_proposed_by_fkey";
						columns: ["proposed_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			agreements: {
				Row: {
					active_version: number;
					cancel_requested_at: string | null;
					cancel_requested_by: string | null;
					cancelled_at: string | null;
					counterparty_contact_id: string;
					counterparty_profile_id: string | null;
					created_at: string;
					creator_id: string;
					creator_role: Database["public"]["Enums"]["party_role"];
					currency: string;
					delivery_confirmed_at: string | null;
					delivery_reported_at: string | null;
					delivery_required: boolean;
					description: string | null;
					id: string;
					idempotency_key: string | null;
					kind: Database["public"]["Enums"]["agreement_kind"];
					outstanding_minor: number;
					pending_version: number | null;
					principal_minor: number;
					row_version: number;
					settled_at: string | null;
					started_on: string | null;
					status: Database["public"]["Enums"]["agreement_status"];
					title: string;
				};
				ComputedFields: never;
				Insert: {
					active_version?: number;
					cancel_requested_at?: string | null;
					cancel_requested_by?: string | null;
					cancelled_at?: string | null;
					counterparty_contact_id: string;
					counterparty_profile_id?: string | null;
					created_at?: string;
					creator_id: string;
					creator_role: Database["public"]["Enums"]["party_role"];
					currency?: string;
					delivery_confirmed_at?: string | null;
					delivery_reported_at?: string | null;
					delivery_required?: boolean;
					description?: string | null;
					id?: string;
					idempotency_key?: string | null;
					kind: Database["public"]["Enums"]["agreement_kind"];
					outstanding_minor: number;
					pending_version?: number | null;
					principal_minor: number;
					row_version?: number;
					settled_at?: string | null;
					started_on?: string | null;
					status?: Database["public"]["Enums"]["agreement_status"];
					title: string;
				};
				Update: {
					active_version?: number;
					cancel_requested_at?: string | null;
					cancel_requested_by?: string | null;
					cancelled_at?: string | null;
					counterparty_contact_id?: string;
					counterparty_profile_id?: string | null;
					created_at?: string;
					creator_id?: string;
					creator_role?: Database["public"]["Enums"]["party_role"];
					currency?: string;
					delivery_confirmed_at?: string | null;
					delivery_reported_at?: string | null;
					delivery_required?: boolean;
					description?: string | null;
					id?: string;
					idempotency_key?: string | null;
					kind?: Database["public"]["Enums"]["agreement_kind"];
					outstanding_minor?: number;
					pending_version?: number | null;
					principal_minor?: number;
					row_version?: number;
					settled_at?: string | null;
					started_on?: string | null;
					status?: Database["public"]["Enums"]["agreement_status"];
					title?: string;
				};
				Relationships: [
					{
						foreignKeyName: "agreements_cancel_requested_by_fkey";
						columns: ["cancel_requested_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "agreements_counterparty_contact_id_fkey";
						columns: ["counterparty_contact_id"];
						isOneToOne: false;
						referencedRelation: "contacts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "agreements_counterparty_profile_id_fkey";
						columns: ["counterparty_profile_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "agreements_creator_id_fkey";
						columns: ["creator_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			analytics_events: {
				Row: {
					created_at: string;
					id: number;
					invite_id: string | null;
					name: string;
					props: NonNullable<Json>;
					user_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					id?: never;
					invite_id?: string | null;
					name: string;
					props?: NonNullable<Json>;
					user_id?: string | null;
				};
				Update: {
					created_at?: string;
					id?: never;
					invite_id?: string | null;
					name?: string;
					props?: NonNullable<Json>;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "analytics_events_invite_id_fkey";
						columns: ["invite_id"];
						isOneToOne: false;
						referencedRelation: "invites";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "analytics_events_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			budgets: {
				Row: {
					category: string;
					created_at: string;
					limit_minor: number;
					owner_id: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					category: string;
					created_at?: string;
					limit_minor: number;
					owner_id: string;
					updated_at?: string;
				};
				Update: {
					category?: string;
					created_at?: string;
					limit_minor?: number;
					owner_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "budgets_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			cards: {
				Row: {
					archived_at: string | null;
					bank_name: string;
					card_name: string | null;
					color: Database["public"]["Enums"]["card_color"];
					created_at: string;
					due_offset_days: number;
					id: string;
					idempotency_key: string | null;
					last4: string;
					limit_minor: number;
					min_payment_rate: number;
					opening_debt_minor: number;
					owner_id: string;
					row_version: number;
					statement_day: number;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					archived_at?: string | null;
					bank_name: string;
					card_name?: string | null;
					color?: Database["public"]["Enums"]["card_color"];
					created_at?: string;
					due_offset_days?: number;
					id?: string;
					idempotency_key?: string | null;
					last4: string;
					limit_minor: number;
					min_payment_rate?: number;
					opening_debt_minor?: number;
					owner_id: string;
					row_version?: number;
					statement_day: number;
					updated_at?: string;
				};
				Update: {
					archived_at?: string | null;
					bank_name?: string;
					card_name?: string | null;
					color?: Database["public"]["Enums"]["card_color"];
					created_at?: string;
					due_offset_days?: number;
					id?: string;
					idempotency_key?: string | null;
					last4?: string;
					limit_minor?: number;
					min_payment_rate?: number;
					opening_debt_minor?: number;
					owner_id?: string;
					row_version?: number;
					statement_day?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "cards_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			consents: {
				Row: {
					accepted_at: string;
					created_at: string;
					document: string;
					user_id: string;
					version: string;
				};
				ComputedFields: never;
				Insert: {
					accepted_at?: string;
					created_at?: string;
					document: string;
					user_id: string;
					version: string;
				};
				Update: {
					accepted_at?: string;
					created_at?: string;
					document?: string;
					user_id?: string;
					version?: string;
				};
				Relationships: [
					{
						foreignKeyName: "consents_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			contacts: {
				Row: {
					created_at: string;
					display_name: string;
					id: string;
					kind: Database["public"]["Enums"]["contact_kind"];
					linked_profile_id: string | null;
					owner_id: string;
					phone_e164: string | null;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					display_name: string;
					id?: string;
					kind?: Database["public"]["Enums"]["contact_kind"];
					linked_profile_id?: string | null;
					owner_id: string;
					phone_e164?: string | null;
				};
				Update: {
					created_at?: string;
					display_name?: string;
					id?: string;
					kind?: Database["public"]["Enums"]["contact_kind"];
					linked_profile_id?: string | null;
					owner_id?: string;
					phone_e164?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "contacts_linked_profile_id_fkey";
						columns: ["linked_profile_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "contacts_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			disputes: {
				Row: {
					agreement_id: string;
					created_at: string;
					id: string;
					opened_by: string;
					payment_id: string | null;
					reason: string;
					resolved_at: string | null;
					status: string;
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					created_at?: string;
					id?: string;
					opened_by: string;
					payment_id?: string | null;
					reason: string;
					resolved_at?: string | null;
					status?: string;
				};
				Update: {
					agreement_id?: string;
					created_at?: string;
					id?: string;
					opened_by?: string;
					payment_id?: string | null;
					reason?: string;
					resolved_at?: string | null;
					status?: string;
				};
				Relationships: [
					{
						foreignKeyName: "disputes_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: false;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "disputes_opened_by_fkey";
						columns: ["opened_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "disputes_payment_id_fkey";
						columns: ["payment_id"];
						isOneToOne: false;
						referencedRelation: "payments";
						referencedColumns: ["id"];
					},
				];
			};
			installments: {
				Row: {
					agreement_id: string;
					amount_minor: number;
					created_at: string;
					due_date: string | null;
					id: string;
					paid_minor: number;
					seq: number;
					version: number;
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					amount_minor: number;
					created_at?: string;
					due_date?: string | null;
					id?: string;
					paid_minor?: number;
					seq: number;
					version: number;
				};
				Update: {
					agreement_id?: string;
					amount_minor?: number;
					created_at?: string;
					due_date?: string | null;
					id?: string;
					paid_minor?: number;
					seq?: number;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: "installments_agreement_id_version_fkey";
						columns: ["agreement_id", "version"];
						isOneToOne: false;
						referencedRelation: "agreement_versions";
						referencedColumns: ["agreement_id", "version"];
					},
				];
			};
			invites: {
				Row: {
					agreement_id: string;
					consumed_at: string | null;
					created_at: string;
					expires_at: string;
					id: string;
					otp_attempts: number;
					otp_expires_at: string | null;
					otp_hash: string | null;
					otp_last_sent_at: string | null;
					status: Database["public"]["Enums"]["invite_status"];
					target_phone_e164: string | null;
					target_profile_id: string | null;
					token_hash: string | null;
					version: number;
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					consumed_at?: string | null;
					created_at?: string;
					expires_at: string;
					id?: string;
					otp_attempts?: number;
					otp_expires_at?: string | null;
					otp_hash?: string | null;
					otp_last_sent_at?: string | null;
					status?: Database["public"]["Enums"]["invite_status"];
					target_phone_e164?: string | null;
					target_profile_id?: string | null;
					token_hash?: string | null;
					version: number;
				};
				Update: {
					agreement_id?: string;
					consumed_at?: string | null;
					created_at?: string;
					expires_at?: string;
					id?: string;
					otp_attempts?: number;
					otp_expires_at?: string | null;
					otp_hash?: string | null;
					otp_last_sent_at?: string | null;
					status?: Database["public"]["Enums"]["invite_status"];
					target_phone_e164?: string | null;
					target_profile_id?: string | null;
					token_hash?: string | null;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: "invites_agreement_id_version_fkey";
						columns: ["agreement_id", "version"];
						isOneToOne: false;
						referencedRelation: "agreement_versions";
						referencedColumns: ["agreement_id", "version"];
					},
					{
						foreignKeyName: "invites_target_profile_id_fkey";
						columns: ["target_profile_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			loans: {
				Row: {
					archived_at: string | null;
					bank_name: string;
					created_at: string;
					first_due_on: string;
					id: string;
					idempotency_key: string | null;
					installment_minor: number;
					loan_type: string;
					monthly_rate_bps: number;
					owner_id: string;
					payment_account_id: string | null;
					principal_minor: number;
					row_version: number;
					term_months: number;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					archived_at?: string | null;
					bank_name: string;
					created_at?: string;
					first_due_on: string;
					id?: string;
					idempotency_key?: string | null;
					installment_minor: number;
					loan_type: string;
					monthly_rate_bps: number;
					owner_id: string;
					payment_account_id?: string | null;
					principal_minor: number;
					row_version?: number;
					term_months: number;
					updated_at?: string;
				};
				Update: {
					archived_at?: string | null;
					bank_name?: string;
					created_at?: string;
					first_due_on?: string;
					id?: string;
					idempotency_key?: string | null;
					installment_minor?: number;
					loan_type?: string;
					monthly_rate_bps?: number;
					owner_id?: string;
					payment_account_id?: string | null;
					principal_minor?: number;
					row_version?: number;
					term_months?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "loans_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "loans_payment_account_id_fkey";
						columns: ["payment_account_id"];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
				];
			};
			notification_outbox: {
				Row: {
					attempts: number;
					created_at: string;
					id: number;
					next_attempt_at: string;
					payload: NonNullable<Json>;
					status: string;
					template: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					attempts?: number;
					created_at?: string;
					id?: never;
					next_attempt_at?: string;
					payload?: NonNullable<Json>;
					status?: string;
					template: string;
					user_id: string;
				};
				Update: {
					attempts?: number;
					created_at?: string;
					id?: never;
					next_attempt_at?: string;
					payload?: NonNullable<Json>;
					status?: string;
					template?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "notification_outbox_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			notifications: {
				Row: {
					agreement_id: string | null;
					category: string;
					created_at: string;
					id: number;
					payload: NonNullable<Json>;
					read_at: string | null;
					template: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					agreement_id?: string | null;
					category: string;
					created_at?: string;
					id?: never;
					payload?: NonNullable<Json>;
					read_at?: string | null;
					template: string;
					user_id: string;
				};
				Update: {
					agreement_id?: string | null;
					category?: string;
					created_at?: string;
					id?: never;
					payload?: NonNullable<Json>;
					read_at?: string | null;
					template?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "notifications_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			payment_allocations: {
				Row: {
					amount_minor: number;
					created_at: string;
					installment_id: string;
					payment_id: string;
				};
				ComputedFields: never;
				Insert: {
					amount_minor: number;
					created_at?: string;
					installment_id: string;
					payment_id: string;
				};
				Update: {
					amount_minor?: number;
					created_at?: string;
					installment_id?: string;
					payment_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "payment_allocations_installment_id_fkey";
						columns: ["installment_id"];
						isOneToOne: false;
						referencedRelation: "installments";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "payment_allocations_payment_id_fkey";
						columns: ["payment_id"];
						isOneToOne: false;
						referencedRelation: "payments";
						referencedColumns: ["id"];
					},
				];
			};
			payments: {
				Row: {
					agreement_id: string;
					amount_minor: number;
					attachment_path: string | null;
					created_at: string;
					decided_at: string | null;
					decided_by: string | null;
					id: string;
					idempotency_key: string;
					kind: Database["public"]["Enums"]["payment_kind"];
					method: Database["public"]["Enums"]["payment_method"];
					note: string | null;
					paid_on: string;
					reported_by: string;
					status: Database["public"]["Enums"]["payment_status"];
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					amount_minor: number;
					attachment_path?: string | null;
					created_at?: string;
					decided_at?: string | null;
					decided_by?: string | null;
					id?: string;
					idempotency_key: string;
					kind: Database["public"]["Enums"]["payment_kind"];
					method: Database["public"]["Enums"]["payment_method"];
					note?: string | null;
					paid_on: string;
					reported_by: string;
					status: Database["public"]["Enums"]["payment_status"];
				};
				Update: {
					agreement_id?: string;
					amount_minor?: number;
					attachment_path?: string | null;
					created_at?: string;
					decided_at?: string | null;
					decided_by?: string | null;
					id?: string;
					idempotency_key?: string;
					kind?: Database["public"]["Enums"]["payment_kind"];
					method?: Database["public"]["Enums"]["payment_method"];
					note?: string | null;
					paid_on?: string;
					reported_by?: string;
					status?: Database["public"]["Enums"]["payment_status"];
				};
				Relationships: [
					{
						foreignKeyName: "payments_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: false;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "payments_decided_by_fkey";
						columns: ["decided_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "payments_reported_by_fkey";
						columns: ["reported_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			pin_login_attempts: {
				Row: {
					created_at: string;
					failed_count: number;
					last_failed_at: string | null;
					locked_until: string | null;
					phone_hash: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					failed_count?: number;
					last_failed_at?: string | null;
					locked_until?: string | null;
					phone_hash: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					failed_count?: number;
					last_failed_at?: string | null;
					locked_until?: string | null;
					phone_hash?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					avatar_path: string | null;
					created_at: string;
					deleted_at: string | null;
					display_name: string;
					first_name: string | null;
					id: string;
					id_discoverable: boolean;
					last_name: string | null;
					locale: string;
					paramnet_id: string | null;
					paramnet_id_changed_at: string | null;
					phone_e164: string | null;
					reminder_before_days: number[];
					timezone: string;
					username: string | null;
				};
				ComputedFields: never;
				Insert: {
					avatar_path?: string | null;
					created_at?: string;
					deleted_at?: string | null;
					display_name: string;
					first_name?: string | null;
					id: string;
					id_discoverable?: boolean;
					last_name?: string | null;
					locale?: string;
					paramnet_id?: string | null;
					paramnet_id_changed_at?: string | null;
					phone_e164?: string | null;
					reminder_before_days?: number[];
					timezone?: string;
					username?: string | null;
				};
				Update: {
					avatar_path?: string | null;
					created_at?: string;
					deleted_at?: string | null;
					display_name?: string;
					first_name?: string | null;
					id?: string;
					id_discoverable?: boolean;
					last_name?: string | null;
					locale?: string;
					paramnet_id?: string | null;
					paramnet_id_changed_at?: string | null;
					phone_e164?: string | null;
					reminder_before_days?: number[];
					timezone?: string;
					username?: string | null;
				};
				Relationships: [];
			};
			push_tokens: {
				Row: {
					created_at: string;
					expo_token: string;
					id: string;
					last_seen_at: string;
					platform: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					expo_token: string;
					id?: string;
					last_seen_at?: string;
					platform: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					expo_token?: string;
					id?: string;
					last_seen_at?: string;
					platform?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "push_tokens_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			rate_limits: {
				Row: {
					count: number;
					created_at: string;
					key: string;
					window_start: string;
				};
				ComputedFields: never;
				Insert: {
					count?: number;
					created_at?: string;
					key: string;
					window_start: string;
				};
				Update: {
					count?: number;
					created_at?: string;
					key?: string;
					window_start?: string;
				};
				Relationships: [];
			};
			recurring_occurrences: {
				Row: {
					created_at: string;
					idempotency_key: string | null;
					occurrence_on: string;
					rule_id: string;
					status: string;
					transaction_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					idempotency_key?: string | null;
					occurrence_on: string;
					rule_id: string;
					status: string;
					transaction_id?: string | null;
				};
				Update: {
					created_at?: string;
					idempotency_key?: string | null;
					occurrence_on?: string;
					rule_id?: string;
					status?: string;
					transaction_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "recurring_occurrences_rule_id_fkey";
						columns: ["rule_id"];
						isOneToOne: false;
						referencedRelation: "recurring_rules";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_occurrences_transaction_id_fkey";
						columns: ["transaction_id"];
						isOneToOne: false;
						referencedRelation: "transactions";
						referencedColumns: ["id"];
					},
				];
			};
			recurring_rules: {
				Row: {
					account_id: string;
					amount_minor: number;
					category: string;
					confirm_each: boolean;
					created_at: string;
					frequency: Database["public"]["Enums"]["recurrence_frequency"];
					id: string;
					idempotency_key: string | null;
					kind: Database["public"]["Enums"]["transaction_kind"];
					name: string;
					owner_id: string;
					paused_at: string | null;
					row_version: number;
					start_on: string;
					tracking_from: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					account_id: string;
					amount_minor: number;
					category: string;
					confirm_each?: boolean;
					created_at?: string;
					frequency: Database["public"]["Enums"]["recurrence_frequency"];
					id?: string;
					idempotency_key?: string | null;
					kind: Database["public"]["Enums"]["transaction_kind"];
					name: string;
					owner_id: string;
					paused_at?: string | null;
					row_version?: number;
					start_on: string;
					tracking_from: string;
					updated_at?: string;
				};
				Update: {
					account_id?: string;
					amount_minor?: number;
					category?: string;
					confirm_each?: boolean;
					created_at?: string;
					frequency?: Database["public"]["Enums"]["recurrence_frequency"];
					id?: string;
					idempotency_key?: string | null;
					kind?: Database["public"]["Enums"]["transaction_kind"];
					name?: string;
					owner_id?: string;
					paused_at?: string | null;
					row_version?: number;
					start_on?: string;
					tracking_from?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "recurring_rules_account_id_fkey";
						columns: ["account_id"];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_rules_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			reminders: {
				Row: {
					agreement_id: string;
					created_at: string;
					fire_at: string;
					id: string;
					installment_id: string | null;
					kind: string;
					payment_id: string | null;
					status: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					agreement_id: string;
					created_at?: string;
					fire_at: string;
					id?: string;
					installment_id?: string | null;
					kind: string;
					payment_id?: string | null;
					status?: string;
					user_id: string;
				};
				Update: {
					agreement_id?: string;
					created_at?: string;
					fire_at?: string;
					id?: string;
					installment_id?: string | null;
					kind?: string;
					payment_id?: string | null;
					status?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "reminders_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: false;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "reminders_installment_id_fkey";
						columns: ["installment_id"];
						isOneToOne: false;
						referencedRelation: "installments";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "reminders_payment_id_fkey";
						columns: ["payment_id"];
						isOneToOne: false;
						referencedRelation: "payments";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "reminders_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			retired_paramnet_ids: {
				Row: {
					created_at: string;
					paramnet_id: string;
					retired_at: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					paramnet_id: string;
					retired_at?: string;
				};
				Update: {
					created_at?: string;
					paramnet_id?: string;
					retired_at?: string;
				};
				Relationships: [];
			};
			sms_usage: {
				Row: {
					count: number;
					day: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					count?: number;
					day: string;
					updated_at?: string;
				};
				Update: {
					count?: number;
					day?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			split_events: {
				Row: {
					actor_id: string | null;
					created_at: string;
					id: number;
					member_id: string | null;
					payload: NonNullable<Json>;
					split_id: string;
					type: string;
				};
				ComputedFields: never;
				Insert: {
					actor_id?: string | null;
					created_at?: string;
					id?: never;
					member_id?: string | null;
					payload?: NonNullable<Json>;
					split_id: string;
					type: string;
				};
				Update: {
					actor_id?: string | null;
					created_at?: string;
					id?: never;
					member_id?: string | null;
					payload?: NonNullable<Json>;
					split_id?: string;
					type?: string;
				};
				Relationships: [
					{
						foreignKeyName: "split_events_actor_id_fkey";
						columns: ["actor_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "split_events_member_id_fkey";
						columns: ["member_id"];
						isOneToOne: false;
						referencedRelation: "split_members";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "split_events_split_id_fkey";
						columns: ["split_id"];
						isOneToOne: false;
						referencedRelation: "splits";
						referencedColumns: ["id"];
					},
				];
			};
			split_members: {
				Row: {
					agreement_id: string | null;
					created_at: string;
					display_name: string;
					id: string;
					is_owner: boolean;
					join_state: Database["public"]["Enums"]["split_join_state"];
					joined_via: string | null;
					profile_id: string | null;
					requested_at: string | null;
					seq: number;
					share_minor: number;
					split_id: string;
				};
				ComputedFields: never;
				Insert: {
					agreement_id?: string | null;
					created_at?: string;
					display_name: string;
					id?: string;
					is_owner?: boolean;
					join_state?: Database["public"]["Enums"]["split_join_state"];
					joined_via?: string | null;
					profile_id?: string | null;
					requested_at?: string | null;
					seq: number;
					share_minor: number;
					split_id: string;
				};
				Update: {
					agreement_id?: string | null;
					created_at?: string;
					display_name?: string;
					id?: string;
					is_owner?: boolean;
					join_state?: Database["public"]["Enums"]["split_join_state"];
					joined_via?: string | null;
					profile_id?: string | null;
					requested_at?: string | null;
					seq?: number;
					share_minor?: number;
					split_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "split_members_agreement_id_fkey";
						columns: ["agreement_id"];
						isOneToOne: true;
						referencedRelation: "agreements";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "split_members_profile_id_fkey";
						columns: ["profile_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "split_members_split_id_fkey";
						columns: ["split_id"];
						isOneToOne: false;
						referencedRelation: "splits";
						referencedColumns: ["id"];
					},
				];
			};
			splits: {
				Row: {
					created_at: string;
					id: string;
					idempotency_key: string;
					join_code: string;
					join_expires_at: string;
					mode: Database["public"]["Enums"]["split_mode"];
					owner_id: string;
					row_version: number;
					spent_on: string;
					title: string;
					total_minor: number;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					id?: string;
					idempotency_key: string;
					join_code: string;
					join_expires_at: string;
					mode: Database["public"]["Enums"]["split_mode"];
					owner_id: string;
					row_version?: number;
					spent_on: string;
					title: string;
					total_minor: number;
				};
				Update: {
					created_at?: string;
					id?: string;
					idempotency_key?: string;
					join_code?: string;
					join_expires_at?: string;
					mode?: Database["public"]["Enums"]["split_mode"];
					owner_id?: string;
					row_version?: number;
					spent_on?: string;
					title?: string;
					total_minor?: number;
				};
				Relationships: [
					{
						foreignKeyName: "splits_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			transaction_events: {
				Row: {
					changes: NonNullable<Json>;
					created_at: string;
					id: number;
					owner_id: string;
					transaction_id: string;
					type: string;
				};
				ComputedFields: never;
				Insert: {
					changes?: NonNullable<Json>;
					created_at?: string;
					id?: never;
					owner_id: string;
					transaction_id: string;
					type: string;
				};
				Update: {
					changes?: NonNullable<Json>;
					created_at?: string;
					id?: never;
					owner_id?: string;
					transaction_id?: string;
					type?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transaction_events_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transaction_events_transaction_id_fkey";
						columns: ["transaction_id"];
						isOneToOne: false;
						referencedRelation: "transactions";
						referencedColumns: ["id"];
					},
				];
			};
			transactions: {
				Row: {
					account_id: string | null;
					amount_minor: number;
					card_id: string | null;
					category: string | null;
					created_at: string;
					deleted_at: string | null;
					id: string;
					idempotency_key: string;
					installments: number;
					kind: Database["public"]["Enums"]["transaction_kind"];
					note: string | null;
					occurred_on: string;
					owner_id: string;
					row_version: number;
					title: string | null;
					to_account_id: string | null;
					to_card_id: string | null;
					to_loan_id: string | null;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					account_id?: string | null;
					amount_minor: number;
					card_id?: string | null;
					category?: string | null;
					created_at?: string;
					deleted_at?: string | null;
					id?: string;
					idempotency_key: string;
					installments?: number;
					kind: Database["public"]["Enums"]["transaction_kind"];
					note?: string | null;
					occurred_on: string;
					owner_id: string;
					row_version?: number;
					title?: string | null;
					to_account_id?: string | null;
					to_card_id?: string | null;
					to_loan_id?: string | null;
					updated_at?: string;
				};
				Update: {
					account_id?: string | null;
					amount_minor?: number;
					card_id?: string | null;
					category?: string | null;
					created_at?: string;
					deleted_at?: string | null;
					id?: string;
					idempotency_key?: string;
					installments?: number;
					kind?: Database["public"]["Enums"]["transaction_kind"];
					note?: string | null;
					occurred_on?: string;
					owner_id?: string;
					row_version?: number;
					title?: string | null;
					to_account_id?: string | null;
					to_card_id?: string | null;
					to_loan_id?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transactions_account_id_fkey";
						columns: ["account_id"];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_card_id_fkey";
						columns: ["card_id"];
						isOneToOne: false;
						referencedRelation: "cards";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_to_account_id_fkey";
						columns: ["to_account_id"];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_to_card_id_fkey";
						columns: ["to_card_id"];
						isOneToOne: false;
						referencedRelation: "cards";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_to_loan_id_fkey";
						columns: ["to_loan_id"];
						isOneToOne: false;
						referencedRelation: "loans";
						referencedColumns: ["id"];
					},
				];
			};
			user_pins: {
				Row: {
					created_at: string;
					pin_set_at: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					pin_set_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					pin_set_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			adjust_account_balance: {
				Args: { p_id: string; p_idempotency_key: string; p_target_balance_minor: number };
				Returns: Json;
			};
			archive_account: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			archive_card: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			archive_loan: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			assign_split_member: {
				Args: { p_member_id: string; p_paramnet_id: string };
				Returns: Json;
			};
			cancel_agreement: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			check_username: { Args: { p_username: string }; Returns: Json };
			claim_notifications: { Args: { p_limit: number }; Returns: Json };
			complete_profile: {
				Args: { p_display_name: string; p_kvkk_version: string; p_terms_version: string };
				Returns: Json;
			};
			confirm_delivery: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			confirm_recurring: {
				Args: { p_idempotency_key: string; p_occurrence_on: string; p_rule_id: string };
				Returns: Json;
			};
			create_account: { Args: { p_idempotency_key: string; p_input: Json }; Returns: Json };
			create_agreement: { Args: { idem_key: string; input: Json }; Returns: Json };
			create_agreement_with_paid: {
				Args: { idem_key: string; input: Json; p_paid_count: number };
				Returns: Json;
			};
			create_card: { Args: { p_idempotency_key: string; p_input: Json }; Returns: Json };
			create_loan: { Args: { p_idempotency_key: string; p_input: Json }; Returns: Json };
			create_recurring: { Args: { p_idempotency_key: string; p_input: Json }; Returns: Json };
			create_split: { Args: { p_idempotency_key: string; p_input: Json }; Returns: Json };
			create_transaction: {
				Args: { p_idempotency_key: string; p_input: Json };
				Returns: Json;
			};
			decide_agreement: {
				Args: {
					p_counter_terms: Json;
					p_decision: string;
					p_id: string;
					p_terms_hash: string;
					p_version: number;
				};
				Returns: Json;
			};
			decide_amendment: {
				Args: { p_decision: string; p_id: string; p_terms_hash: string; p_version: number };
				Returns: Json;
			};
			decide_cancel: { Args: { p_decision: string; p_id: string }; Returns: Json };
			decide_counter: {
				Args: {
					p_counter_terms: Json;
					p_decision: string;
					p_id: string;
					p_terms_hash: string;
					p_version: number;
				};
				Returns: Json;
			};
			decide_payment: { Args: { p_decision: string; p_payment_id: string }; Returns: Json };
			decide_split_join: { Args: { p_decision: string; p_member_id: string }; Returns: Json };
			delete_account_data: { Args: { p_uid: string }; Returns: Json };
			delete_recurring: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			delete_transaction: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
			find_by_paramnet_id: { Args: { p_paramnet_id: string }; Returns: Json };
			finish_notifications: { Args: { p_results: Json }; Returns: Json };
			forgive_remaining: {
				Args: {
					p_amount_minor: number;
					p_id: string;
					p_idempotency_key: string;
					p_row_version: number;
				};
				Returns: Json;
			};
			get_agreement_detail: { Args: { p_id: string }; Returns: Json };
			get_calendar: { Args: { p_month: string }; Returns: Json };
			get_card: { Args: { p_id: string }; Returns: Json };
			get_cash_summary: { Args: { p_month: string }; Returns: Json };
			get_contact_detail: { Args: { p_id: string }; Returns: Json };
			get_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
			get_delivery: { Args: { p_id: string }; Returns: Json };
			get_loan: { Args: { p_id: string }; Returns: Json };
			get_metrics: { Args: { p_days: number }; Returns: Json };
			get_monthly_report: { Args: { p_month: string }; Returns: Json };
			get_my_profile: { Args: Record<PropertyKey, never>; Returns: Json };
			get_pending_decision: { Args: { p_id: string }; Returns: Json };
			get_split: { Args: { p_id: string }; Returns: Json };
			get_split_invite: { Args: { p_code: string }; Returns: Json };
			get_transaction: { Args: { p_id: string }; Returns: Json };
			has_pin: { Args: Record<PropertyKey, never>; Returns: boolean };
			invite_decide: {
				Args: {
					p_counter_terms: Json;
					p_decision: string;
					p_invite_id: string;
					p_ip_hash: string;
					p_phone: string;
					p_terms_hash: string;
					p_user_agent: string;
					p_version: number;
				};
				Returns: Json;
			};
			invite_details: { Args: { p_invite_id: string }; Returns: Json };
			invite_open: { Args: { p_token: string }; Returns: Json };
			invite_send_otp: {
				Args: { p_code: string; p_ip_hash: string; p_phone: string; p_token: string };
				Returns: Json;
			};
			invite_verify_otp: {
				Args: { p_code: string; p_phone: string; p_token: string };
				Returns: Json;
			};
			list_accounts: { Args: Record<PropertyKey, never>; Returns: Json };
			list_agreements: { Args: Record<PropertyKey, never>; Returns: Json };
			list_budgets: { Args: { p_month: string }; Returns: Json };
			list_cards: { Args: Record<PropertyKey, never>; Returns: Json };
			list_contacts_with_balance: { Args: Record<PropertyKey, never>; Returns: Json };
			list_loans: { Args: Record<PropertyKey, never>; Returns: Json };
			list_notifications: {
				Args: { p_before_id: number; p_category: string; p_limit: number };
				Returns: Json;
			};
			list_recurring: { Args: Record<PropertyKey, never>; Returns: Json };
			list_requests: { Args: Record<PropertyKey, never>; Returns: Json };
			list_splits: { Args: Record<PropertyKey, never>; Returns: Json };
			list_transactions: { Args: { p_account_id: string; p_month: string }; Returns: Json };
			make_personal: { Args: { p_id: string }; Returns: Json };
			mark_notifications_read: { Args: { p_ids: number[] }; Returns: Json };
			open_dispute: {
				Args: {
					p_id: string;
					p_payment_id: string;
					p_reason: string;
					p_row_version: number;
				};
				Returns: Json;
			};
			pin_login_check: { Args: { p_phone: string }; Returns: Json };
			pin_login_record: { Args: { p_ok: boolean; p_phone: string }; Returns: Json };
			pin_mark_set: { Args: { p_phone: string; p_uid: string }; Returns: undefined };
			propose_amendment: {
				Args: { p_id: string; p_reason: string; p_row_version: number; p_terms: Json };
				Returns: Json;
			};
			record_loan_payment: {
				Args: {
					p_account_id: string;
					p_idempotency_key: string;
					p_loan_id: string;
					p_paid_on: string;
				};
				Returns: Json;
			};
			record_payment: {
				Args: {
					p_agreement_id: string;
					p_idempotency_key: string;
					p_input: Json;
					p_row_version: number;
				};
				Returns: Json;
			};
			regenerate_paramnet_id: { Args: Record<PropertyKey, never>; Returns: Json };
			register_push_token: { Args: { p_platform: string; p_token: string }; Returns: Json };
			remind_split_member: { Args: { p_member_id: string }; Returns: Json };
			report_delivery: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			request_cancel: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			request_money: {
				Args: { p_idempotency_key: string; p_input: Json; p_paramnet_id: string };
				Returns: Json;
			};
			request_split_join: {
				Args: { p_code: string; p_member_id: string; p_via: string };
				Returns: Json;
			};
			resolve_dispute: { Args: { p_id: string }; Returns: Json };
			resolve_invite: { Args: { p_token: string }; Returns: Json };
			restore_transaction: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			set_avatar: { Args: { p_path: string }; Returns: Json };
			set_budget: { Args: { p_category: string; p_limit_minor: number }; Returns: Json };
			set_id_discoverable: { Args: { p_on: boolean }; Returns: Json };
			set_recurring_paused: {
				Args: { p_id: string; p_paused: boolean; p_row_version: number };
				Returns: Json;
			};
			set_reminder_prefs: { Args: { p_days: number[] }; Returns: Json };
			share_agreement: {
				Args: { p_id: string; p_phone: string; p_row_version: number };
				Returns: Json;
			};
			share_agreement_by_id: {
				Args: { p_id: string; p_paramnet_id: string; p_row_version: number };
				Returns: Json;
			};
			skip_recurring: { Args: { p_occurrence_on: string; p_rule_id: string }; Returns: Json };
			split_for_agreement: { Args: { p_agreement_id: string }; Returns: Json };
			take_sms_budget: {
				Args: { p_channel: string; p_daily_limit: number; p_phone: string };
				Returns: Json;
			};
			track_event: { Args: { p_name: string; p_props: Json }; Returns: Json };
			unregister_push_token: { Args: { p_token: string }; Returns: Json };
			update_account: {
				Args: { p_id: string; p_input: Json; p_row_version: number };
				Returns: Json;
			};
			update_card: {
				Args: { p_id: string; p_input: Json; p_row_version: number };
				Returns: Json;
			};
			update_loan: {
				Args: { p_id: string; p_input: Json; p_row_version: number };
				Returns: Json;
			};
			update_personal_agreement: {
				Args: { p_id: string; p_row_version: number; p_terms: Json };
				Returns: Json;
			};
			update_profile: {
				Args: { p_first_name: string; p_last_name: string; p_username: string };
				Returns: Json;
			};
			update_recurring: {
				Args: { p_id: string; p_input: Json; p_row_version: number };
				Returns: Json;
			};
			update_transaction: {
				Args: { p_id: string; p_input: Json; p_row_version: number };
				Returns: Json;
			};
			withdraw_amendment: { Args: { p_id: string }; Returns: Json };
			withdraw_payment: { Args: { p_payment_id: string }; Returns: Json };
			withdraw_share: { Args: { p_id: string }; Returns: Json };
		};
		Enums: {
			account_kind: "bank" | "cash" | "savings" | "other";
			agreement_kind: "loan" | "installment_purchase";
			agreement_status:
				| "personal"
				| "pending"
				| "countered"
				| "active"
				| "amendment_pending"
				| "disputed"
				| "rejected"
				| "settled"
				| "cancelled";
			card_color: "navy" | "graphite" | "midnight" | "bordeaux";
			contact_kind: "person" | "merchant";
			event_channel: "app" | "web" | "system";
			invite_status: "active" | "consumed" | "revoked" | "expired" | "locked";
			party_role: "creditor" | "debtor";
			payment_kind: "payment" | "down_payment" | "discount";
			payment_method: "cash" | "transfer" | "card" | "other";
			payment_status: "reported" | "confirmed" | "rejected" | "withdrawn" | "voided";
			recurrence_frequency: "weekly" | "monthly" | "yearly";
			split_join_state: "none" | "requested" | "approved";
			split_mode: "equal" | "amount" | "percent";
			transaction_kind: "expense" | "income" | "transfer" | "adjustment";
			version_status: "draft" | "proposed" | "accepted" | "rejected" | "superseded";
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {
			account_kind: ["bank", "cash", "savings", "other"],
			agreement_kind: ["loan", "installment_purchase"],
			agreement_status: [
				"personal",
				"pending",
				"countered",
				"active",
				"amendment_pending",
				"disputed",
				"rejected",
				"settled",
				"cancelled",
			],
			card_color: ["navy", "graphite", "midnight", "bordeaux"],
			contact_kind: ["person", "merchant"],
			event_channel: ["app", "web", "system"],
			invite_status: ["active", "consumed", "revoked", "expired", "locked"],
			party_role: ["creditor", "debtor"],
			payment_kind: ["payment", "down_payment", "discount"],
			payment_method: ["cash", "transfer", "card", "other"],
			payment_status: ["reported", "confirmed", "rejected", "withdrawn", "voided"],
			recurrence_frequency: ["weekly", "monthly", "yearly"],
			split_join_state: ["none", "requested", "approved"],
			split_mode: ["equal", "amount", "percent"],
			transaction_kind: ["expense", "income", "transfer", "adjustment"],
			version_status: ["draft", "proposed", "accepted", "rejected", "superseded"],
		},
	},
} as const;
