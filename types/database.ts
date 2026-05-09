export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type GroupStatus = 'forming' | 'confirmed' | 'completed' | 'cancelled'
export type MemberStatus = 'pending' | 'confirmed' | 'declined'
export type EventStatus = 'planning' | 'confirmed' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          bio: string | null
          avatar_url: string | null
          skill_level: SkillLevel | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      sports: {
        Row: {
          id: string
          name: string
          icon: string
          min_players: number
          max_players: number
          is_outdoor: boolean
        }
        Insert: Omit<Database['public']['Tables']['sports']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sports']['Insert']>
      }
      user_sports: {
        Row: {
          id: string
          user_id: string
          sport_id: string
          skill_level: SkillLevel
        }
        Insert: Omit<Database['public']['Tables']['user_sports']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['user_sports']['Insert']>
      }
      availability: {
        Row: {
          id: string
          user_id: string
          date: string
          is_available: boolean
          sport_ids: string[]
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['availability']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['availability']['Insert']>
      }
      groups: {
        Row: {
          id: string
          sport_id: string
          captain_id: string
          status: GroupStatus
          event_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          status: MemberStatus
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['group_members']['Insert']>
      }
      events: {
        Row: {
          id: string
          group_id: string
          created_by: string
          title: string
          venue_name: string | null
          venue_address: string | null
          location_lat: number | null
          location_lng: number | null
          scheduled_at: string | null
          status: EventStatus
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      messages: {
        Row: {
          id: string
          group_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: never
      }
      votes: {
        Row: {
          id: string
          event_id: string
          question: string
          options: string[]
          created_by: string
          ends_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['votes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['votes']['Insert']>
      }
      user_votes: {
        Row: {
          id: string
          vote_id: string
          user_id: string
          choice: string
          voted_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_votes']['Row'], 'id' | 'voted_at'>
        Update: never
      }
      achievements: {
        Row: {
          id: string
          user_id: string
          type: string
          awarded_at: string
        }
        Insert: Omit<Database['public']['Tables']['achievements']['Row'], 'id' | 'awarded_at'>
        Update: never
      }
    }
  }
}
