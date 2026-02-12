export interface SheetLink {
  id: string;
  user_id: string;
  song_id: string;
  source_page: number;
  source_x: number;
  source_y: number;
  target_page: number;
  target_x: number;
  target_y: number;
  link_size: 'small' | 'medium' | 'large' | 'extra-large';
  created_at?: string;
}