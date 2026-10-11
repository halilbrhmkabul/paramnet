export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
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
					cancelled_at: string | null;
					counterparty_contact_id: string;
					counterparty_profile_id: string | null;
					created_at: string;
					creator_id: string;
					creator_role: Database["public"]["Enums"]["party_role"];
					currency: string;
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
					cancelled_at?: string | null;
					counterparty_contact_id: string;
					counterparty_profile_id?: string | null;
					created_at?: string;
					creator_id: string;
					creator_role: Database["public"]["Enums"]["party_role"];
					currency?: string;
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
					cancelled_at?: string | null;
					counterparty_contact_id?: string;
					counterparty_profile_id?: string | null;
					created_at?: string;
					creator_id?: string;
					creator_role?: Database["public"]["Enums"]["party_role"];
					currency?: string;
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
					status: Database["public"]["Enums"]["invite_status"];
					target_phone_e164: string;
					token_hash: string;
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
					status?: Database["public"]["Enums"]["invite_status"];
					target_phone_e164: string;
					token_hash: string;
					version: number;
				};
				Update: {
					agreement_id?: string;
					consumed_at?: string | null;
					created_at?: string;
					expires_at?: string;
					id?: string;
					otp_attempts?: number;
					status?: Database["public"]["Enums"]["invite_status"];
					target_phone_e164?: string;
					token_hash?: string;
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
			profiles: {
				Row: {
					created_at: string;
					deleted_at: string | null;
					display_name: string;
					id: string;
					locale: string;
					phone_e164: string;
					timezone: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					deleted_at?: string | null;
					display_name: string;
					id: string;
					locale?: string;
					phone_e164: string;
					timezone?: string;
				};
				Update: {
					created_at?: string;
					deleted_at?: string | null;
					display_name?: string;
					id?: string;
					locale?: string;
					phone_e164?: string;
					timezone?: string;
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
			reminders: {
				Row: {
					agreement_id: string;
					created_at: string;
					fire_at: string;
					id: string;
					installment_id: string | null;
					kind: string;
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
						foreignKeyName: "reminders_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			cancel_agreement: { Args: { p_id: string; p_row_version: number }; Returns: Json };
			claim_notifications: { Args: { p_limit: number }; Returns: Json };
			complete_profile: {
				Args: { p_display_name: string; p_kvkk_version: string; p_terms_version: string };
				Returns: Json;
			};
			create_agreement: { Args: { idem_key: string; input: Json }; Returns: Json };
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
			finish_notifications: { Args: { p_results: Json }; Returns: Json };
			get_agreement_detail: { Args: { p_id: string }; Returns: Json };
			get_calendar: { Args: { p_month: string }; Returns: Json };
			get_contact_detail: { Args: { p_id: string }; Returns: Json };
			get_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
			list_contacts_with_balance: { Args: Record<PropertyKey, never>; Returns: Json };
			make_personal: { Args: { p_id: string }; Returns: Json };
			record_payment: {
				Args: {
					p_agreement_id: string;
					p_idempotency_key: string;
					p_input: Json;
					p_row_version: number;
				};
				Returns: Json;
			};
			register_push_token: { Args: { p_platform: string; p_token: string }; Returns: Json };
			share_agreement: {
				Args: { p_id: string; p_phone: string; p_row_version: number };
				Returns: Json;
			};
			unregister_push_token: { Args: { p_token: string }; Returns: Json };
			update_personal_agreement: {
				Args: { p_id: string; p_row_version: number; p_terms: Json };
				Returns: Json;
			};
			withdraw_share: { Args: { p_id: string }; Returns: Json };
		};
		Enums: {
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
			contact_kind: "person" | "merchant";
			event_channel: "app" | "web" | "system";
			invite_status: "active" | "consumed" | "revoked" | "expired" | "locked";
			party_role: "creditor" | "debtor";
			payment_kind: "payment" | "down_payment" | "discount";
			payment_method: "cash" | "transfer" | "card" | "other";
			payment_status: "reported" | "confirmed" | "rejected" | "withdrawn" | "voided";
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
			contact_kind: ["person", "merchant"],
			event_channel: ["app", "web", "system"],
			invite_status: ["active", "consumed", "revoked", "expired", "locked"],
			party_role: ["creditor", "debtor"],
			payment_kind: ["payment", "down_payment", "discount"],
			payment_method: ["cash", "transfer", "card", "other"],
			payment_status: ["reported", "confirmed", "rejected", "withdrawn", "voided"],
			version_status: ["draft", "proposed", "accepted", "rejected", "superseded"],
		},
	},
} as const;
