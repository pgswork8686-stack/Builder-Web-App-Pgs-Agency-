import { createClient } from '@supabase/supabase-js';

// Đọc các giá trị biến môi trường từ .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL hoặc Anon Key chưa được cấu hình đầy đủ trong file .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
