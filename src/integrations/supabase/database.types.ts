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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      arrangements: {
        Row: {
          created_at: string
          file_links: string[] | null
          genre: string | null
          id: string
          instrumentation: string | null
          key: string | null
          notes: string | null
          source_track: string | null
          status: string
          tempo: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_links?: string[] | null
          genre?: string | null
          id?: string
          instrumentation?: string | null
          key?: string | null
          notes?: string | null
          source_track?: string | null
          status?: string
          tempo?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_links?: string[] | null
          genre?: string | null
          id?: string
          instrumentation?: string | null
          key?: string | null
          notes?: string | null
          source_track?: string | null
          status?: string
          tempo?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      art_repository: {
        Row: {
          created_at: string
          id: string
          improvisation_id: string | null
          mode: string
          prompt: string | null
          public_url: string
          seed: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          improvisation_id?: string | null
          mode: string
          prompt?: string | null
          public_url: string
          seed?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          improvisation_id?: string | null
          mode?: string
          prompt?: string | null
          public_url?: string
          seed?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      default_page_mappings: {
        Row: {
          exercise_id: string
          label: string
          mode: string
          page_end: number
          page_start: number
          storage_path: string
          target_bpm: number
          time_signature: string
        }
        Insert: {
          exercise_id?: string
          label?: string
          mode?: string
          page_end: number
          page_start: number
          storage_path: string
          target_bpm?: number
          time_signature?: string
        }
        Update: {
          exercise_id?: string
          label?: string
          mode?: string
          page_end?: number
          page_start?: number
          storage_path?: string
          target_bpm?: number
          time_signature?: string
        }
        Relationships: []
      }
      exercise_mastery: {
        Row: {
          exercise_id: string
          highest_mastered_bpm: number
          id: string
          last_practiced_at: string | null
          user_id: string
        }
        Insert: {
          exercise_id: string
          highest_mastered_bpm?: number
          id?: string
          last_practiced_at?: string | null
          user_id: string
        }
        Update: {
          exercise_id?: string
          highest_mastered_bpm?: number
          id?: string
          last_practiced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          followed_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          followed_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      gig_sessions: {
        Row: {
          access_code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          setlist_id: string
          user_id: string
        }
        Insert: {
          access_code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          setlist_id: string
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_sessions_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
      improvisations: {
        Row: {
          analysis_data: Json | null
          artwork_prompt: string | null
          artwork_url: string | null
          created_at: string | null
          description: string | null
          file_name: string | null
          generated_name: string | null
          has_explicit_lyrics: boolean | null
          id: string
          insight_audience_age: Json | null
          insight_audience_level: string | null
          insight_benefits: Json | null
          insight_content_type: string | null
          insight_language: string | null
          insight_practices: string | null
          insight_primary_use: string | null
          insight_themes: Json | null
          insight_voice: string | null
          is_improvisation: boolean | null
          is_instrumental: boolean | null
          is_metadata_confirmed: boolean | null
          is_original_song: boolean | null
          is_piano: boolean | null
          is_ready_for_release: boolean | null
          is_submitted_to_distrokid: boolean | null
          is_submitted_to_insight_timer: boolean | null
          logic_project_path: string | null
          nas_folder_path: string | null
          notes: Json | null
          original_name: string | null
          primary_genre: string | null
          secondary_genre: string | null
          show_on_portfolio: boolean | null
          sound_choice: string | null
          status: string
          storage_path: string | null
          template_used: string | null
          user_id: string
          user_tags: Json | null
          video_path: string | null
          workflow_mode: string | null
        }
        Insert: {
          analysis_data?: Json | null
          artwork_prompt?: string | null
          artwork_url?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          generated_name?: string | null
          has_explicit_lyrics?: boolean | null
          id?: string
          insight_audience_age?: Json | null
          insight_audience_level?: string | null
          insight_benefits?: Json | null
          insight_content_type?: string | null
          insight_language?: string | null
          insight_practices?: string | null
          insight_primary_use?: string | null
          insight_themes?: Json | null
          insight_voice?: string | null
          is_improvisation?: boolean | null
          is_instrumental?: boolean | null
          is_metadata_confirmed?: boolean | null
          is_original_song?: boolean | null
          is_piano?: boolean | null
          is_ready_for_release?: boolean | null
          is_submitted_to_distrokid?: boolean | null
          is_submitted_to_insight_timer?: boolean | null
          logic_project_path?: string | null
          nas_folder_path?: string | null
          notes?: Json | null
          original_name?: string | null
          primary_genre?: string | null
          secondary_genre?: string | null
          show_on_portfolio?: boolean | null
          sound_choice?: string | null
          status?: string
          storage_path?: string | null
          template_used?: string | null
          user_id: string
          user_tags?: Json | null
          video_path?: string | null
          workflow_mode?: string | null
        }
        Update: {
          analysis_data?: Json | null
          artwork_prompt?: string | null
          artwork_url?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          generated_name?: string | null
          has_explicit_lyrics?: boolean | null
          id?: string
          insight_audience_age?: Json | null
          insight_audience_level?: string | null
          insight_benefits?: Json | null
          insight_content_type?: string | null
          insight_language?: string | null
          insight_practices?: string | null
          insight_primary_use?: string | null
          insight_themes?: Json | null
          insight_voice?: string | null
          is_improvisation?: boolean | null
          is_instrumental?: boolean | null
          is_metadata_confirmed?: boolean | null
          is_original_song?: boolean | null
          is_piano?: boolean | null
          is_ready_for_release?: boolean | null
          is_submitted_to_distrokid?: boolean | null
          is_submitted_to_insight_timer?: boolean | null
          logic_project_path?: string | null
          nas_folder_path?: string | null
          notes?: Json | null
          original_name?: string | null
          primary_genre?: string | null
          secondary_genre?: string | null
          show_on_portfolio?: boolean | null
          sound_choice?: string | null
          status?: string
          storage_path?: string | null
          template_used?: string | null
          user_id?: string
          user_tags?: Json | null
          video_path?: string | null
          workflow_mode?: string | null
        }
        Relationships: []
      }
      metronome_inputs: {
        Row: {
          created_at: string | null
          id: string
          input_text: string
          sequence: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_text: string
          sequence: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_text?: string
          sequence?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      metronome_scores: {
        Row: {
          accuracy_percent: number
          actual_bpm: number
          created_at: string | null
          id: string
          taps_count: number
          target_bpm: number
          user_id: string | null
        }
        Insert: {
          accuracy_percent: number
          actual_bpm: number
          created_at?: string | null
          id?: string
          taps_count: number
          target_bpm: number
          user_id?: string | null
        }
        Update: {
          accuracy_percent?: number
          actual_bpm?: number
          created_at?: string | null
          id?: string
          taps_count?: number
          target_bpm?: number
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          is_read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_documents: {
        Row: {
          created_at: string
          id: string
          last_viewed_page: number
          mode: string
          page_count: number
          storage_path: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_viewed_page?: number
          mode?: string
          page_count?: number
          storage_path: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_viewed_page?: number
          mode?: string
          page_count?: number
          storage_path?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_page_mappings: {
        Row: {
          document_id: string
          exercise_id: string
          id: string
          label: string
          mode: string
          page_end: number
          page_start: number
          target_bpm: number
          time_signature: string
          user_id: string
        }
        Insert: {
          document_id: string
          exercise_id?: string
          id?: string
          label?: string
          mode?: string
          page_end: number
          page_start: number
          target_bpm?: number
          time_signature?: string
          user_id: string
        }
        Update: {
          document_id?: string
          exercise_id?: string
          id?: string
          label?: string
          mode?: string
          page_end?: number
          page_start?: number
          target_bpm?: number
          time_signature?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_page_mappings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pdf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_logs: {
        Row: {
          created_at: string | null
          duration_minutes: number
          id: string
          notes: string | null
          scales_practiced: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes: number
          id?: string
          notes?: string | null
          scales_practiced?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          scales_practiced?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      practice_streaks: {
        Row: {
          current_streak: number
          id: string
          last_practice_date: string
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_practice_date?: string
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_practice_date?: string
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pro_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          custom_colors: Json | null
          custom_theme: string | null
          default_dashboard_view: string | null
          disable_portrait_pdf_scroll: boolean | null
          first_name: string | null
          goal_highest_note_count: number | null
          goal_lyrics_count: number | null
          goal_original_key_count: number | null
          goal_pdfs_count: number | null
          goal_target_key_count: number | null
          goal_ug_chords_count: number | null
          goal_ug_links_count: number | null
          id: string
          is_goal_tracker_enabled: boolean | null
          is_repertoire_public: boolean | null
          is_safe_pitch_enabled: boolean | null
          key_preference: string | null
          last_name: string | null
          link_size: string | null
          prevent_stage_key_overwrite: boolean | null
          repertoire_bio: string | null
          repertoire_slug: string | null
          repertoire_threshold: number | null
          safe_pitch_max_note: string | null
          ug_chords_chord_bold: boolean | null
          ug_chords_chord_color: string | null
          ug_chords_font_family: string | null
          ug_chords_font_size: number | null
          ug_chords_line_spacing: number | null
          ug_chords_text_align: string | null
          updated_at: string | null
          wizard_mode: boolean | null
          youtube_api_key: string | null
        }
        Insert: {
          avatar_url?: string | null
          custom_colors?: Json | null
          custom_theme?: string | null
          default_dashboard_view?: string | null
          disable_portrait_pdf_scroll?: boolean | null
          first_name?: string | null
          goal_highest_note_count?: number | null
          goal_lyrics_count?: number | null
          goal_original_key_count?: number | null
          goal_pdfs_count?: number | null
          goal_target_key_count?: number | null
          goal_ug_chords_count?: number | null
          goal_ug_links_count?: number | null
          id: string
          is_goal_tracker_enabled?: boolean | null
          is_repertoire_public?: boolean | null
          is_safe_pitch_enabled?: boolean | null
          key_preference?: string | null
          last_name?: string | null
          link_size?: string | null
          prevent_stage_key_overwrite?: boolean | null
          repertoire_bio?: string | null
          repertoire_slug?: string | null
          repertoire_threshold?: number | null
          safe_pitch_max_note?: string | null
          ug_chords_chord_bold?: boolean | null
          ug_chords_chord_color?: string | null
          ug_chords_font_family?: string | null
          ug_chords_font_size?: number | null
          ug_chords_line_spacing?: number | null
          ug_chords_text_align?: string | null
          updated_at?: string | null
          wizard_mode?: boolean | null
          youtube_api_key?: string | null
        }
        Update: {
          avatar_url?: string | null
          custom_colors?: Json | null
          custom_theme?: string | null
          default_dashboard_view?: string | null
          disable_portrait_pdf_scroll?: boolean | null
          first_name?: string | null
          goal_highest_note_count?: number | null
          goal_lyrics_count?: number | null
          goal_original_key_count?: number | null
          goal_pdfs_count?: number | null
          goal_target_key_count?: number | null
          goal_ug_chords_count?: number | null
          goal_ug_links_count?: number | null
          id?: string
          is_goal_tracker_enabled?: boolean | null
          is_repertoire_public?: boolean | null
          is_safe_pitch_enabled?: boolean | null
          key_preference?: string | null
          last_name?: string | null
          link_size?: string | null
          prevent_stage_key_overwrite?: boolean | null
          repertoire_bio?: string | null
          repertoire_slug?: string | null
          repertoire_threshold?: number | null
          safe_pitch_max_note?: string | null
          ug_chords_chord_bold?: boolean | null
          ug_chords_chord_color?: string | null
          ug_chords_font_family?: string | null
          ug_chords_font_size?: number | null
          ug_chords_line_spacing?: number | null
          ug_chords_text_align?: string | null
          updated_at?: string | null
          wizard_mode?: boolean | null
          youtube_api_key?: string | null
        }
        Relationships: []
      }
      repertoire: {
        Row: {
          apple_music_url: string | null
          artist: string
          audio_url: string | null
          auto_synced: boolean | null
          bpm: string | null
          chords_updated_at: string | null
          comfort_level: number | null
          created_at: string | null
          duration_seconds: number | null
          energy_level: string | null
          extraction_error: string | null
          extraction_status: string | null
          genre: string | null
          highest_note_original: string | null
          highest_note_updated_at: string | null
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          is_in_library: boolean | null
          is_key_confirmed: boolean | null
          is_metadata_confirmed: boolean | null
          is_pitch_linked: boolean | null
          is_ready_to_sing: boolean | null
          is_sheet_verified: boolean | null
          is_ug_chords_present: boolean | null
          key_preference: string | null
          last_extracted_at: string | null
          last_sync_log: string | null
          leadsheet_url: string | null
          lyrics: string | null
          lyrics_updated_at: string | null
          metadata_source: string | null
          needs_improvement: boolean | null
          notes: string | null
          original_key: string | null
          original_key_updated_at: string | null
          pdf_updated_at: string | null
          pdf_url: string | null
          pitch: number | null
          preferred_reader: string | null
          preview_url: string | null
          readiness_checklist: Json | null
          readiness_score: number | null
          resources: Json | null
          sheet_music_url: string | null
          source_type: string | null
          sync_status: string | null
          target_key: string | null
          target_key_updated_at: string | null
          title: string
          ug_chords_config: Json | null
          ug_chords_text: string | null
          ug_link_updated_at: string | null
          ug_url: string | null
          updated_at: string | null
          user_id: string
          user_tags: Json | null
          youtube_url: string | null
        }
        Insert: {
          apple_music_url?: string | null
          artist: string
          audio_url?: string | null
          auto_synced?: boolean | null
          bpm?: string | null
          chords_updated_at?: string | null
          comfort_level?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          energy_level?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          genre?: string | null
          highest_note_original?: string | null
          highest_note_updated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          is_in_library?: boolean | null
          is_key_confirmed?: boolean | null
          is_metadata_confirmed?: boolean | null
          is_pitch_linked?: boolean | null
          is_ready_to_sing?: boolean | null
          is_sheet_verified?: boolean | null
          is_ug_chords_present?: boolean | null
          key_preference?: string | null
          last_extracted_at?: string | null
          last_sync_log?: string | null
          leadsheet_url?: string | null
          lyrics?: string | null
          lyrics_updated_at?: string | null
          metadata_source?: string | null
          needs_improvement?: boolean | null
          notes?: string | null
          original_key?: string | null
          original_key_updated_at?: string | null
          pdf_updated_at?: string | null
          pdf_url?: string | null
          pitch?: number | null
          preferred_reader?: string | null
          preview_url?: string | null
          readiness_checklist?: Json | null
          readiness_score?: number | null
          resources?: Json | null
          sheet_music_url?: string | null
          source_type?: string | null
          sync_status?: string | null
          target_key?: string | null
          target_key_updated_at?: string | null
          title: string
          ug_chords_config?: Json | null
          ug_chords_text?: string | null
          ug_link_updated_at?: string | null
          ug_url?: string | null
          updated_at?: string | null
          user_id: string
          user_tags?: Json | null
          youtube_url?: string | null
        }
        Update: {
          apple_music_url?: string | null
          artist?: string
          audio_url?: string | null
          auto_synced?: boolean | null
          bpm?: string | null
          chords_updated_at?: string | null
          comfort_level?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          energy_level?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          genre?: string | null
          highest_note_original?: string | null
          highest_note_updated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          is_in_library?: boolean | null
          is_key_confirmed?: boolean | null
          is_metadata_confirmed?: boolean | null
          is_pitch_linked?: boolean | null
          is_ready_to_sing?: boolean | null
          is_sheet_verified?: boolean | null
          is_ug_chords_present?: boolean | null
          key_preference?: string | null
          last_extracted_at?: string | null
          last_sync_log?: string | null
          leadsheet_url?: string | null
          lyrics?: string | null
          lyrics_updated_at?: string | null
          metadata_source?: string | null
          needs_improvement?: boolean | null
          notes?: string | null
          original_key?: string | null
          original_key_updated_at?: string | null
          pdf_updated_at?: string | null
          pdf_url?: string | null
          pitch?: number | null
          preferred_reader?: string | null
          preview_url?: string | null
          readiness_checklist?: Json | null
          readiness_score?: number | null
          resources?: Json | null
          sheet_music_url?: string | null
          source_type?: string | null
          sync_status?: string | null
          target_key?: string | null
          target_key_updated_at?: string | null
          title?: string
          ug_chords_config?: Json | null
          ug_chords_text?: string | null
          ug_link_updated_at?: string | null
          ug_url?: string | null
          updated_at?: string | null
          user_id?: string
          user_tags?: Json | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      scale_permutations_mastery: {
        Row: {
          highest_mastered_bpm: number
          id: string
          last_practiced_at: string | null
          scale_permutation_id: string
          user_id: string | null
        }
        Insert: {
          highest_mastered_bpm?: number
          id?: string
          last_practiced_at?: string | null
          scale_permutation_id: string
          user_id?: string | null
        }
        Update: {
          highest_mastered_bpm?: number
          id?: string
          last_practiced_at?: string | null
          scale_permutation_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scales_profiles: {
        Row: {
          celebrated_milestones: Json
          created_at: string
          email: string | null
          id: string
          plan: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          celebrated_milestones?: Json
          created_at?: string
          email?: string | null
          id: string
          plan?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          celebrated_milestones?: Json
          created_at?: string
          email?: string | null
          id?: string
          plan?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setlist_songs: {
        Row: {
          created_at: string | null
          id: string
          is_confirmed: boolean | null
          isplayed: boolean | null
          isPlayed: boolean | null
          set_group: number | null
          setlist_id: string | null
          song_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          isplayed?: boolean | null
          isPlayed?: boolean | null
          set_group?: number | null
          setlist_id?: string | null
          song_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          isplayed?: boolean | null
          isPlayed?: boolean | null
          set_group?: number | null
          setlist_id?: string | null
          song_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "setlist_songs_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "repertoire"
            referencedColumns: ["id"]
          },
        ]
      }
      setlists: {
        Row: {
          created_at: string | null
          id: string
          name: string
          set_names: Json | null
          songs: Json
          stimulus_text: string | null
          time_goal: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          set_names?: Json | null
          songs?: Json
          stimulus_text?: string | null
          time_goal?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          set_names?: Json | null
          songs?: Json
          stimulus_text?: string | null
          time_goal?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sheet_links: {
        Row: {
          created_at: string | null
          id: string
          link_size: string
          song_id: string
          source_page: number
          source_x: number
          source_y: number
          target_page: number
          target_x: number
          target_y: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link_size?: string
          song_id: string
          source_page: number
          source_x: number
          source_y: number
          target_page: number
          target_x: number
          target_y: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link_size?: string
          song_id?: string
          source_page?: number
          source_x?: number
          source_y?: number
          target_page?: number
          target_x?: number
          target_y?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_links_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "repertoire"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          id: string
          practice_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          practice_id: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          practice_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_force_purge_storage: {
        Args: { days_old: number; target_bucket: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
