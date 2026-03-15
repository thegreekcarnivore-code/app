export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notification_prefs: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          late_threshold_days: number
          notify_late: boolean
          notify_photos: boolean
          notify_weight: boolean
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          late_threshold_days?: number
          notify_late?: boolean
          notify_photos?: boolean
          notify_weight?: boolean
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          late_threshold_days?: number
          notify_late?: boolean
          notify_photos?: boolean
          notify_weight?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_tasks: {
        Row: {
          admin_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          priority: string
          recurrence: string | null
          source: string
          source_call_id: string | null
          title: string
        }
        Insert: {
          admin_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          recurrence?: string | null
          source?: string
          source_call_id?: string | null
          title?: string
        }
        Update: {
          admin_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          recurrence?: string | null
          source?: string
          source_call_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_source_call_id_fkey"
            columns: ["source_call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          call_count: number
          created_at: string
          estimated_cost: number
          function_name: string
          id: string
          model: string | null
          service: string
          user_id: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          estimated_cost?: number
          function_name: string
          id?: string
          model?: string | null
          service: string
          user_id: string
        }
        Update: {
          call_count?: number
          created_at?: string
          estimated_cost?: number
          function_name?: string
          id?: string
          model?: string | null
          service?: string
          user_id?: string
        }
        Relationships: []
      }
      call_notifications_sent: {
        Row: {
          email: string
          id: string
          sent_at: string
          video_call_id: string
        }
        Insert: {
          email: string
          id?: string
          sent_at?: string
          video_call_id: string
        }
        Update: {
          email?: string
          id?: string
          sent_at?: string
          video_call_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notifications_sent_video_call_id_fkey"
            columns: ["video_call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reminders: {
        Row: {
          created_at: string
          id: string
          reminder_type: string
          send_at: string
          sent_at: string | null
          video_call_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_type: string
          send_at: string
          sent_at?: string | null
          video_call_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_type?: string
          send_at?: string
          sent_at?: string | null
          video_call_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reminders_video_call_id_fkey"
            columns: ["video_call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcript_history: {
        Row: {
          admin_id: string
          call_id: string
          created_at: string
          id: string
          summaries: Json
          transcript: string
        }
        Insert: {
          admin_id: string
          call_id: string
          created_at?: string
          id?: string
          summaries?: Json
          transcript?: string
        }
        Update: {
          admin_id?: string
          call_id?: string
          created_at?: string
          id?: string
          summaries?: Json
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcript_history_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      client_categories: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      client_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "client_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_form_signatures: {
        Row: {
          enrollment_id: string
          form_id: string
          full_name: string
          id: string
          ip_address: string | null
          signature_url: string
          signed_at: string
          user_id: string
        }
        Insert: {
          enrollment_id: string
          form_id: string
          full_name?: string
          id?: string
          ip_address?: string | null
          signature_url?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          enrollment_id?: string
          form_id?: string
          full_name?: string
          id?: string
          ip_address?: string | null
          signature_url?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_form_signatures_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_form_signatures_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "program_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      client_program_enrollments: {
        Row: {
          created_at: string
          created_by: string
          duration_weeks_override: number | null
          feature_access_override: Json | null
          id: string
          program_template_id: string
          start_date: string
          status: string
          user_id: string
          weekly_day: number
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_weeks_override?: number | null
          feature_access_override?: Json | null
          id?: string
          program_template_id: string
          start_date?: string
          status?: string
          user_id: string
          weekly_day?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_weeks_override?: number | null
          feature_access_override?: Json | null
          id?: string
          program_template_id?: string
          start_date?: string
          status?: string
          user_id?: string
          weekly_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_program_enrollments_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_programs: {
        Row: {
          agreement_notes: string | null
          amount_paid: number
          created_at: string
          end_date: string | null
          id: string
          installments_paid: number
          installments_total: number
          payment_method: string | null
          payment_status: string
          program_name: string
          program_template_id: string | null
          prospect_email: string | null
          start_date: string
          stripe_checkout_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agreement_notes?: string | null
          amount_paid?: number
          created_at?: string
          end_date?: string | null
          id?: string
          installments_paid?: number
          installments_total?: number
          payment_method?: string | null
          payment_status?: string
          program_name?: string
          program_template_id?: string | null
          prospect_email?: string | null
          start_date?: string
          stripe_checkout_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agreement_notes?: string | null
          amount_paid?: number
          created_at?: string
          end_date?: string | null
          id?: string
          installments_paid?: number
          installments_total?: number
          payment_method?: string | null
          payment_status?: string
          program_name?: string
          program_template_id?: string | null
          prospect_email?: string | null
          start_date?: string
          stripe_checkout_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_programs_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tasks: {
        Row: {
          completed_at: string | null
          description: string
          due_date: string
          enrollment_id: string
          id: string
          linked_content_id: string | null
          source_task_id: string | null
          task_type: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          description?: string
          due_date?: string
          enrollment_id: string
          id?: string
          linked_content_id?: string | null
          source_task_id?: string | null
          task_type?: string
          title?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          description?: string
          due_date?: string
          enrollment_id?: string
          id?: string
          linked_content_id?: string | null
          source_task_id?: string | null
          task_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tasks_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "program_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_video_progress: {
        Row: {
          completed_at: string
          enrollment_id: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed_at?: string
          enrollment_id: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed_at?: string
          enrollment_id?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_video_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "client_program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "program_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      email_invitations: {
        Row: {
          created_at: string
          created_by: string
          email: string
          feature_access: Json
          group_id: string | null
          id: string
          language: string
          measurement_day: number | null
          program_template_id: string | null
          resent_at: string | null
          start_date: string | null
          status: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          feature_access?: Json
          group_id?: string | null
          id?: string
          language?: string
          measurement_day?: number | null
          program_template_id?: string | null
          resent_at?: string | null
          start_date?: string | null
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          feature_access?: Json
          group_id?: string | null
          id?: string
          language?: string
          measurement_day?: number | null
          program_template_id?: string | null
          resent_at?: string | null
          start_date?: string | null
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_invitations_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          admin_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          type?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          admin_id: string
          amount: number
          category: string
          created_at: string
          currency: string
          description: string
          entry_date: string
          id: string
          receipt_url: string | null
          sheet_row_number: number | null
          type: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string
          entry_date?: string
          id?: string
          receipt_url?: string | null
          sheet_row_number?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string
          entry_date?: string
          id?: string
          receipt_url?: string | null
          sheet_row_number?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          admin_id: string
          created_at: string
          google_sheet_id: string | null
          google_sheet_tab: string | null
          id: string
          last_synced_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: string
          last_synced_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: string
          last_synced_at?: string | null
        }
        Relationships: []
      }
      food_journal: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          id: string
          meal_type: string
          notes: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          meal_type: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          meal_type?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "group_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          media_urls: string[] | null
          mentions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          group_id: string
          id?: string
          media_urls?: string[] | null
          mentions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          media_urls?: string[] | null
          mentions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      health_integrations: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          feature_access: Json
          id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          feature_access?: Json
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          feature_access?: Json
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      measurement_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          measurement_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          measurement_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          measurement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_comments_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          arm_cm: number | null
          breathing_health: number | null
          cravings: number | null
          created_at: string
          digestion: number | null
          energy: number | null
          fat_kg: number | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          left_arm_cm: number | null
          left_leg_cm: number | null
          leg_cm: number | null
          measured_at: string
          mental_health: number | null
          mood: number | null
          muscle_kg: number | null
          pain: number | null
          right_arm_cm: number | null
          right_leg_cm: number | null
          skin_health: number | null
          stress: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          breathing_health?: number | null
          cravings?: number | null
          created_at?: string
          digestion?: number | null
          energy?: number | null
          fat_kg?: number | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_leg_cm?: number | null
          leg_cm?: number | null
          measured_at?: string
          mental_health?: number | null
          mood?: number | null
          muscle_kg?: number | null
          pain?: number | null
          right_arm_cm?: number | null
          right_leg_cm?: number | null
          skin_health?: number | null
          stress?: number | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          breathing_health?: number | null
          cravings?: number | null
          created_at?: string
          digestion?: number | null
          energy?: number | null
          fat_kg?: number | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_leg_cm?: number | null
          leg_cm?: number | null
          measured_at?: string
          mental_health?: number | null
          mood?: number | null
          muscle_kg?: number | null
          pain?: number | null
          right_arm_cm?: number | null
          right_leg_cm?: number | null
          skin_health?: number | null
          stress?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string
          id: string
          is_automated: boolean
          message_type: string
          read_at: string | null
          receiver_id: string
          sender_id: string
          transcript: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_automated?: boolean
          message_type?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          transcript?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_automated?: boolean
          message_type?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          transcript?: string | null
        }
        Relationships: []
      }
      policy_signatures: {
        Row: {
          full_name: string
          id: string
          ip_address: string | null
          policy_version: string
          signature_url: string
          signed_at: string
          user_id: string
        }
        Insert: {
          full_name: string
          id?: string
          ip_address?: string | null
          policy_version?: string
          signature_url?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          full_name?: string
          id?: string
          ip_address?: string | null
          policy_version?: string
          signature_url?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          feature_access: Json
          height_cm: number | null
          id: string
          language: string
          last_login_at: string | null
          onboarding_tour_completed: boolean
          sex: string | null
          stripe_customer_id: string | null
          timezone: string | null
          updated_at: string
          vocative_name_el: string | null
        }
        Insert: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          feature_access?: Json
          height_cm?: number | null
          id: string
          language?: string
          last_login_at?: string | null
          onboarding_tour_completed?: boolean
          sex?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          vocative_name_el?: string | null
        }
        Update: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          feature_access?: Json
          height_cm?: number | null
          id?: string
          language?: string
          last_login_at?: string | null
          onboarding_tour_completed?: boolean
          sex?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          vocative_name_el?: string | null
        }
        Relationships: []
      }
      program_documents: {
        Row: {
          category: string
          description: string
          document_url: string
          id: string
          program_template_id: string
          sort_order: number
          title: string
        }
        Insert: {
          category?: string
          description?: string
          document_url?: string
          id?: string
          program_template_id: string
          sort_order?: number
          title?: string
        }
        Update: {
          category?: string
          description?: string
          document_url?: string
          id?: string
          program_template_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_documents_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      program_forms: {
        Row: {
          content: string
          id: string
          program_template_id: string
          requires_signature: boolean
          sort_order: number
          title: string
        }
        Insert: {
          content?: string
          id?: string
          program_template_id: string
          requires_signature?: boolean
          sort_order?: number
          title?: string
        }
        Update: {
          content?: string
          id?: string
          program_template_id?: string
          requires_signature?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_forms_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      program_messages: {
        Row: {
          also_send_email: boolean
          day_offset: number
          id: string
          message_content: string
          program_template_id: string
          recurrence: string | null
          recurrence_end_day: number | null
          send_hour: number
          send_minute: number
          sort_order: number
        }
        Insert: {
          also_send_email?: boolean
          day_offset?: number
          id?: string
          message_content?: string
          program_template_id: string
          recurrence?: string | null
          recurrence_end_day?: number | null
          send_hour?: number
          send_minute?: number
          sort_order?: number
        }
        Update: {
          also_send_email?: boolean
          day_offset?: number
          id?: string
          message_content?: string
          program_template_id?: string
          recurrence?: string | null
          recurrence_end_day?: number | null
          send_hour?: number
          send_minute?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_messages_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tasks: {
        Row: {
          day_offset: number
          description: string
          id: string
          linked_content_id: string | null
          program_template_id: string
          recurrence: string | null
          recurrence_end_day: number | null
          sort_order: number
          task_type: string
          title: string
        }
        Insert: {
          day_offset?: number
          description?: string
          id?: string
          linked_content_id?: string | null
          program_template_id: string
          recurrence?: string | null
          recurrence_end_day?: number | null
          sort_order?: number
          task_type?: string
          title?: string
        }
        Update: {
          day_offset?: number
          description?: string
          id?: string
          linked_content_id?: string | null
          program_template_id?: string
          recurrence?: string | null
          recurrence_end_day?: number | null
          sort_order?: number
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tasks_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string
          duration_weeks: number
          feature_access: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          duration_weeks?: number
          feature_access?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          duration_weeks?: number
          feature_access?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_videos: {
        Row: {
          category: string
          description: string
          id: string
          module_id: string | null
          program_template_id: string
          sequence_order: number
          thumbnail_url: string | null
          title: string
          unlock_after_days: number | null
          unlock_after_video_id: string | null
          youtube_url: string
        }
        Insert: {
          category?: string
          description?: string
          id?: string
          module_id?: string | null
          program_template_id: string
          sequence_order?: number
          thumbnail_url?: string | null
          title?: string
          unlock_after_days?: number | null
          unlock_after_video_id?: string | null
          youtube_url?: string
        }
        Update: {
          category?: string
          description?: string
          id?: string
          module_id?: string | null
          program_template_id?: string
          sequence_order?: number
          thumbnail_url?: string | null
          title?: string
          unlock_after_days?: number | null
          unlock_after_video_id?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_videos_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "video_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_videos_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_videos_unlock_after_video_id_fkey"
            columns: ["unlock_after_video_id"]
            isOneToOne: false
            referencedRelation: "program_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          angle: string
          created_at: string
          id: string
          notes: string | null
          photo_url: string
          taken_at: string
          user_id: string
        }
        Insert: {
          angle?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url: string
          taken_at?: string
          user_id: string
        }
        Update: {
          angle?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_categories: {
        Row: {
          color_from: string
          color_to: string
          cover_image_url: string | null
          created_at: string
          id: string
          key: string
          label_el: string
          label_en: string
          sort_order: number
        }
        Insert: {
          color_from?: string
          color_to?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          key: string
          label_el?: string
          label_en?: string
          sort_order?: number
        }
        Update: {
          color_from?: string
          color_to?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          key?: string
          label_el?: string
          label_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      recipe_favorites: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string
          ingredients_el: string
          ingredients_en: string
          instructions_el: string
          instructions_en: string
          program_template_id: string | null
          sort_order: number
          tip_el: string
          tip_en: string
          title_el: string
          title_en: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          ingredients_el?: string
          ingredients_en?: string
          instructions_el?: string
          instructions_en?: string
          program_template_id?: string | null
          sort_order?: number
          tip_el?: string
          tip_en?: string
          title_el?: string
          title_en?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          ingredients_el?: string
          ingredients_en?: string
          instructions_el?: string
          instructions_en?: string
          program_template_id?: string | null
          sort_order?: number
          tip_el?: string
          tip_en?: string
          title_el?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_history: {
        Row: {
          created_at: string
          id: string
          location_name: string
          request_params: Json
          response_data: Json
          tab: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_name?: string
          request_params?: Json
          response_data?: Json
          tab: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_name?: string
          request_params?: Json
          response_data?: Json
          tab?: string
          user_id?: string
        }
        Relationships: []
      }
      reference_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          key: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_feedback: {
        Row: {
          admin_id: string
          created_at: string
          feedback: string | null
          id: string
          is_accepted: boolean
          report_content: string
          scope: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_accepted?: boolean
          report_content: string
          scope?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_accepted?: boolean
          report_content?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      report_instructions: {
        Row: {
          created_at: string
          id: string
          instruction: string
          scope: string
          source_feedback_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          scope?: string
          source_feedback_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          scope?: string
          source_feedback_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_instructions_source_feedback_id_fkey"
            columns: ["source_feedback_id"]
            isOneToOne: false
            referencedRelation: "report_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_ai_prompts: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          label: string
          prompt: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          label?: string
          prompt?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          prompt?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          action_count: number
          created_at: string
          id: string
          last_inquiry_at: string | null
          user_id: string
        }
        Insert: {
          action_count?: number
          created_at?: string
          id?: string
          last_inquiry_at?: string | null
          user_id: string
        }
        Update: {
          action_count?: number
          created_at?: string
          id?: string
          last_inquiry_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_call_participants: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_call_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_call_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_call_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_call_participants_video_call_id_fkey"
            columns: ["video_call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      video_calls: {
        Row: {
          call_type: string
          created_at: string
          created_by: string
          duration_minutes: number
          guest_emails: string[]
          id: string
          meeting_url: string
          notes: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          guest_emails?: string[]
          id?: string
          meeting_url?: string
          notes?: string | null
          scheduled_at: string
          title?: string
        }
        Update: {
          call_type?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          guest_emails?: string[]
          id?: string
          meeting_url?: string
          notes?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: []
      }
      video_modules: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_sequential: boolean
          program_template_id: string
          sequence_order: number
          title: string
          unlock_after_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_sequential?: boolean
          program_template_id: string
          sequence_order?: number
          title?: string
          unlock_after_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_sequential?: boolean
          program_template_id?: string
          sequence_order?: number
          title?: string
          unlock_after_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_modules_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_journal: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_user_activity: {
        Args: { _user_id: string }
        Returns: undefined
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      log_api_usage: {
        Args: {
          _call_count?: number
          _estimated_cost: number
          _function_name: string
          _model: string
          _service: string
          _user_id: string
        }
        Returns: undefined
      }
      use_invite_token: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
